/**
 * Exposure-Aware Road Routing
 *
 * For open-road travel (private car, shared auto) there is usually more than one
 * sensible way to drive from A to B. This module enumerates many real-road
 * corridors via a breadth-first search (bfsRouteGenerator), scores each one's
 * live air quality with the existing exposure pipeline, and ranks them three ways:
 *
 *   • Fastest      — shortest traffic-aware travel time (TomTom routed per corridor).
 *   • Cleanest Air — lowest AVERAGE PM2.5 concentration along the path (the
 *                    cleanest air you breathe), regardless of trip time.
 *   • Balanced     — half time + half average PM2.5 (each min–max normalised); min wins.
 *
 * Why concentration, not dose: dose (concentration × time) is the most
 * health-accurate measure, but when the air is roughly uniform across the city
 * dose is driven almost entirely by trip time — so the "cleanest" route collapses
 * onto the fastest one and all three options coincide. Ranking on the average
 * concentration the route passes through keeps "Cleanest Air" a meaningfully
 * distinct choice (the route through the least-polluted air, even if slower). The
 * selected mode's personal inhaled dose is still computed downstream via
 * computeModeExposure() for the exposure panel.
 *
 * Note on resolution: ambient AQI comes from CPCB stations interpolated across
 * the Surat metro, so longer cross-city paths genuinely differ; short trips near
 * a single sensor barely do. `negligible` flags when the concentration spread is
 * tiny so the UI can say the "cleaner" route is only marginally cleaner.
 */

import { generateBfsRoadRoutes, routeSignature } from './bfsRouteGenerator.js';
import { findFastestRoadRoute } from './roadAStar.js';
import { fetchRouteExposure } from './airQualityService.js';
import { getTrafficEta } from './googleMapsService.js';

/**
 * Picks up to `n` intermediate points (excluding the endpoints) evenly along a
 * corridor. Passed to the traffic service so TomTom is pinned to THIS corridor
 * and returns its own traffic-aware ETA, not just TomTom's own fastest path.
 */
const sampleWaypoints = (coordinates, n = 3) => {
  if (!coordinates || coordinates.length <= 2) return [];
  const out = [];
  for (let i = 1; i <= n; i++) {
    const idx = Math.round((coordinates.length - 1) * (i / (n + 1)));
    const [lat, lng] = coordinates[idx];
    out.push({ lat, lng });
  }
  return out;
};

/** Great-circle distance (km) between two {lat,lng} points. */
const haversineKm = (a, b) => {
  const R = 6371;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((a.lat * Math.PI) / 180) * Math.cos((b.lat * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(s));
};

// Below this relative spread in average PM2.5 concentration, the alternatives
// pass through effectively the same air — the UI should say differences are
// minimal rather than imply a meaningful "cleaner" choice exists.
const NEGLIGIBLE_CONC_SPREAD = 0.05;

/** Min–max normalises a value to [0,1]; returns 0 when the range is degenerate. */
const normalise = (value, min, max) => (max > min ? (value - min) / (max - min) : 0);

const argmin = (items, score) => {
  let bestIdx = 0;
  let bestScore = Infinity;
  items.forEach((item, i) => {
    const s = score(item, i);
    if (s < bestScore) { bestScore = s; bestIdx = i; }
  });
  return bestIdx;
};

// "Worth it" guardrails — a cleaner-air detour only makes sense if the air is
// meaningfully cleaner for the extra distance it costs.
const SHORT_TRIP_KM = 1;       // trips under this: don't bother diverging at all
const WORTH_AIR_MIN_UG = 1;    // cleaner route must beat the fastest by MORE than this PM2.5…
const WORTH_DIST_MAX_KM = 1;   // …once it adds this much extra distance, else it's not worth it

/**
 * Pure ranking over already-scored route options. Separated from the async
 * fetching so it can be unit-tested without hitting the network.
 *
 * "Cleanest" = the route through the lowest average PM2.5 air (concentration),
 * regardless of how long it takes. "Balanced" weighs time and that concentration
 * half-and-half. BUT a cleaner route is only offered when it's actually worth it:
 *   • Trips shorter than ~1 km collapse all three to the single fastest route.
 *   • If the cleanest route is barely cleaner (≤1 µg/m³ PM2.5) yet ≥1 km longer
 *     than the fastest, the detour isn't worth it — all three collapse to fastest.
 *
 * @param {Array<{durationMins:number, distanceKm:number, concentration:number|null}>} options
 * @param {number} [tripDistanceKm] straight-line source→dest distance (for the short-trip rule)
 * @param {number|null} [fastestIdxOverride] index of the A*-solved fastest corridor;
 *        when supplied it is used verbatim instead of an argmin over the pool, so the
 *        "Fastest" choice is the A* search result. Cleanest/Balanced are unaffected.
 * @returns {{ fastestIdx:number, cleanestIdx:number, balancedIdx:number, negligible:boolean }}
 */
export const rankRouteOptions = (options, tripDistanceKm = null, fastestIdxOverride = null) => {
  // Fastest comes from the A* search when provided, else a plain argmin fallback.
  const fastestIdx = (fastestIdxOverride != null && fastestIdxOverride >= 0 && fastestIdxOverride < options.length)
    ? fastestIdxOverride
    : argmin(options, (o) => o.durationMins);
  const fastest = options[fastestIdx];

  const measured = options.filter((o) => o.concentration != null);
  const haveExposure = measured.length > 0;

  // Cleanest candidate = lowest average PM2.5. When the air ties (e.g. the uniform
  // CAMS model fallback), tie-break to the FASTER route.
  let cleanestCand = fastestIdx;
  if (haveExposure) {
    const minConc = Math.min(...measured.map((o) => o.concentration));
    cleanestCand = argmin(options, (o) =>
      o.concentration != null && o.concentration <= minConc + 1e-6 ? o.durationMins : Infinity
    );
  }

  // ---- Worth-it gate: decide whether a cleaner route should be offered at all ----
  const tripLenKm = tripDistanceKm != null ? tripDistanceKm : fastest.distanceKm;
  const shortTrip = tripLenKm < SHORT_TRIP_KM;

  const airGain = (haveExposure && fastest.concentration != null && options[cleanestCand].concentration != null)
    ? fastest.concentration - options[cleanestCand].concentration   // how much cleaner (µg/m³)
    : 0;
  const distCost = options[cleanestCand].distanceKm - fastest.distanceKm; // extra km vs fastest
  const notWorth = airGain <= WORTH_AIR_MIN_UG && distCost >= WORTH_DIST_MAX_KM;

  // Collapse all three onto the fastest route when diverging isn't justified.
  const collapse = !haveExposure || options.length < 2 || shortTrip || notWorth;

  if (collapse) {
    return { fastestIdx, cleanestIdx: fastestIdx, balancedIdx: fastestIdx, negligible: true };
  }

  const cleanestIdx = cleanestCand;

  // Balanced: half weight on time, half on average PM2.5 (both min–max normalised).
  // Distance is intentionally excluded — longer routes already cost more time.
  const durations = options.map((o) => o.durationMins);
  const concs = measured.map((o) => o.concentration);
  const tMin = Math.min(...durations), tMax = Math.max(...durations);
  const cMin = Math.min(...concs), cMax = Math.max(...concs);

  const balancedIdx = argmin(options, (o) => {
    const tN = normalise(o.durationMins, tMin, tMax);
    const cN = o.concentration == null ? 1 : normalise(o.concentration, cMin, cMax);
    return 0.5 * tN + 0.5 * cN;
  });

  // Flag near-identical air so the UI doesn't oversell a "cleaner" choice.
  const negligible = cMax <= 0 || (cMax - cMin) / cMax < NEGLIGIBLE_CONC_SPREAD;

  return { fastestIdx, cleanestIdx, balancedIdx, negligible };
};

/**
 * Builds the ranked set of road-route options between two points.
 *
 * @param {{lat:number,lng:number}} source
 * @param {{lat:number,lng:number}} destination
 * @returns {Promise<{
 *   options: Array<{ id:string, coordinates:Array<[number,number]>, distanceKm:number,
 *                    durationMins:number, ambient:Object|null, concentration:number|null,
 *                    dose:number|null }>,
 *   fastestIdx:number, cleanestIdx:number, balancedIdx:number, negligible:boolean
 * }|null>} null if no road geometry could be resolved.
 */
export const computeRoadRouteOptions = async (source, destination, departureTime = 'now') => {
  // BFS still enumerates the corridor pool (for Cleanest/Balanced); in parallel,
  // A* solves for the single fastest corridor over the same layered road graph.
  const [alternatives, astarFastest] = await Promise.all([
    generateBfsRoadRoutes(source, destination),
    findFastestRoadRoute(source, destination).catch(() => null)
  ]);
  if (!alternatives || alternatives.length === 0) return null;

  // Fold the A*-chosen fastest route into the pool so it's scored like any other
  // corridor; dedupe against BFS by geometry and remember its index. If A* failed
  // or returned a dud, fastestIdxOverride stays null and ranking falls back to argmin.
  let pool = alternatives;
  let fastestIdxOverride = null;
  if (astarFastest && astarFastest.coordinates && astarFastest.coordinates.length >= 2) {
    const sig = routeSignature(astarFastest);
    const existing = alternatives.findIndex((r) => routeSignature(r) === sig);
    if (existing >= 0) {
      fastestIdxOverride = existing;
    } else {
      pool = [astarFastest, ...alternatives];
      fastestIdxOverride = 0;
    }
  }

  // Per corridor, in parallel: (a) score its ambient air quality, and (b) get
  // its OWN traffic-aware ETA by routing TomTom through the corridor's waypoints
  // (falls back to OSRM free-flow time if the traffic service is unreachable).
  const [exposures, traffics] = await Promise.all([
    Promise.all(pool.map((alt) => fetchRouteExposure(alt.coordinates).catch(() => null))),
    Promise.all(pool.map((alt) =>
      getTrafficEta(source, destination, departureTime, alt.durationMins, alt.distanceKm, sampleWaypoints(alt.coordinates))
        .catch(() => null)
    ))
  ]);

  const options = pool.map((alt, i) => {
    const ambient = exposures[i] && exposures[i].ok ? exposures[i] : null;
    // Traffic-aware ETA when available, else OSRM free-flow — keeps these cards
    // consistent with the headline "Calibrated Urban ETA".
    const traffic = traffics[i];
    const durationMins = traffic && traffic.trafficDuration > 0 ? traffic.trafficDuration : alt.durationMins;
    const isLiveEta = !!(traffic && traffic.isSimulated === false);
    // Cleanest/Balanced rank by average PM2.5 concentration (the air breathed).
    const concentration = ambient ? ambient.avgPm25 : null;
    // Dose (concentration × hours) kept for reference/inspection — not ranked on.
    const dose = ambient ? +(ambient.avgPm25 * (durationMins / 60)).toFixed(2) : null;
    return {
      id: `route-${i}`,
      coordinates: alt.coordinates,
      distanceKm: alt.distanceKm,
      durationMins,
      freeFlowMins: alt.durationMins,
      isLiveEta,
      ambient,
      concentration,
      dose
    };
  });

  // Straight-line trip length, for the short-trip "don't bother diverging" rule.
  const tripDistanceKm = haversineKm(source, destination);

  return { options, ...rankRouteOptions(options, tripDistanceKm, fastestIdxOverride) };
};
