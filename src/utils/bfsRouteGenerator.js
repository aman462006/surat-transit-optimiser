/**
 * BFS Road-Route Generator
 *
 * The open road network is not stored as a graph in this app — OSRM hands back
 * one geometry per request. To still "BFS for as many routes as we can" between
 * two points, we BUILD a small graph and search it:
 *
 *   1. Lay a few COLUMNS of candidate waypoints across the corridor between
 *      source and destination, each column offset perpendicular to the straight
 *      line (left / centre / right).
 *   2. Breadth-first enumerate every path that picks one waypoint per column —
 *      source → col1 → col2 → … → colK → destination. This is the literal BFS
 *      over the layered graph; it yields Mᴷ candidate via-point sequences.
 *   3. Realize each sequence as a REAL street route via OSRM, so every candidate
 *      still follows actual roads (and keeps real distance / traffic ETA / CPCB
 *      exposure downstream). Many sequences snap onto the same roads, so we
 *      dedupe, and we cap the count to stay responsive on the public OSRM server.
 *
 * The result is the same shape fetchRoadAlternatives returns, so the exposure
 * ranking in roadExposureRouting.js consumes it unchanged.
 */

import { fetchRoadAlternatives, fetchRoadRoute } from './osrmService.js';

// Layered-graph shape. K columns × M lateral offsets ⇒ Mᴷ enumerated paths.
const K_COLUMNS = 3;
const M_OFFSETS = 3;          // left / centre / right per column
const MAX_ROUTES = 16;        // cap distinct realized routes (≈ OSRM call budget)
const OSRM_CONCURRENCY = 5;   // throttle realization to be kind to the demo server

// Perpendicular spread as a fraction of trip length, clamped to a sane km band
// so short hops still fan out and long trips don't detour absurdly.
const OFFSET_FRACTION = 0.12;
const OFFSET_MIN_KM = 0.4;
const OFFSET_MAX_KM = 2.5;

const KM_PER_DEG_LAT = 110.574;
const kmPerDegLng = (lat) => 111.320 * Math.cos((lat * Math.PI) / 180);

/**
 * Lays out the layered waypoint columns between source and destination (pure).
 * Returns `columns`: an array of K columns, each an array of M `{lat,lng}` nodes.
 * Returns [] when the two points are effectively coincident.
 */
export const buildWaypointColumns = (source, destination) => {
  const meanLat = (source.lat + destination.lat) / 2;
  const kLng = kmPerDegLng(meanLat);

  // Local equirectangular coords (km), origin at source.
  const Dx = (destination.lng - source.lng) * kLng;
  const Dy = (destination.lat - source.lat) * KM_PER_DEG_LAT;
  const L = Math.hypot(Dx, Dy);
  if (L < 0.2) return []; // too short to fan out meaningfully

  // Unit vector along the route, and its perpendicular.
  const ux = Dx / L, uy = Dy / L;
  const px = -uy, py = ux;

  const spread = Math.min(OFFSET_MAX_KM, Math.max(OFFSET_MIN_KM, L * OFFSET_FRACTION));
  // M offsets symmetric about 0, e.g. M=3 → [-spread, 0, +spread].
  const offsets = [];
  const half = (M_OFFSETS - 1) / 2;
  for (let j = 0; j < M_OFFSETS; j++) offsets.push(((j - half) / Math.max(1, half)) * spread);

  const toLatLng = (x, y) => ({
    lat: source.lat + y / KM_PER_DEG_LAT,
    lng: source.lng + x / kLng
  });

  const columns = [];
  for (let c = 1; c <= K_COLUMNS; c++) {
    const f = c / (K_COLUMNS + 1);        // fraction along the route
    const bx = f * Dx, by = f * Dy;       // centre of this column
    const col = offsets.map((o) => toLatLng(bx + o * px, by + o * py));
    columns.push(col);
  }
  return columns;
};

/**
 * Breadth-first enumeration of every path through the layered columns (pure):
 * one node per column, in order. Returns an array of paths, each a list of K
 * `{lat,lng}` via-points. With K columns of M nodes this yields Mᴷ paths.
 */
export const enumerateLayeredPaths = (columns) => {
  let frontier = [[]];
  for (const col of columns) {
    const next = [];
    for (const partial of frontier) {
      for (const node of col) next.push([...partial, node]);
    }
    frontier = next;
  }
  // Drop the empty path when there are no columns.
  return frontier.filter((p) => p.length > 0);
};

/** Runs async thunks in fixed-size batches to throttle outbound requests. */
const runThrottled = async (thunks, batchSize) => {
  const results = [];
  for (let i = 0; i < thunks.length; i += batchSize) {
    const batch = thunks.slice(i, i + batchSize);
    results.push(...(await Promise.all(batch.map((t) => t()))));
  }
  return results;
};

/** Stable dedupe key: a route is "the same" if it has near-identical length and midpoint. */
export const routeSignature = (route) => {
  const mid = route.coordinates[Math.floor(route.coordinates.length / 2)] || [0, 0];
  return `${route.distanceKm.toFixed(1)}|${mid[0].toFixed(3)},${mid[1].toFixed(3)}`;
};

/**
 * Generates a diverse set of real-road routes between two points via the layered
 * BFS above. Always seeds with OSRM's own alternatives so the direct/fastest
 * route is guaranteed present even if every detour fails.
 *
 * @param {{lat:number,lng:number}} source
 * @param {{lat:number,lng:number}} destination
 * @returns {Promise<Array<{coordinates:Array<[number,number]>,distanceKm:number,durationMins:number}>|null>}
 */
export const generateBfsRoadRoutes = async (source, destination) => {
  if (!source || !destination) return null;

  const seeds = (await fetchRoadAlternatives(source, destination)) || [];

  const columns = buildWaypointColumns(source, destination);
  const paths = enumerateLayeredPaths(columns);

  const realized = await runThrottled(
    paths.map((vias) => () => {
      const waypoints = [
        [source.lat, source.lng],
        ...vias.map((v) => [v.lat, v.lng]),
        [destination.lat, destination.lng]
      ];
      return fetchRoadRoute(waypoints).catch(() => null);
    }),
    OSRM_CONCURRENCY
  );

  // Merge seeds + realized detours, dedupe by geometry, cap.
  const all = [...seeds, ...realized.filter(Boolean)];
  const seen = new Set();
  const unique = [];
  for (const route of all) {
    if (!route || !route.coordinates || route.coordinates.length < 2) continue;
    const sig = routeSignature(route);
    if (seen.has(sig)) continue;
    seen.add(sig);
    unique.push(route);
  }

  const kept = unique.slice(0, MAX_ROUTES);
  console.info(
    `[BFS Routes] enumerated ${paths.length} layered paths + ${seeds.length} OSRM seed(s) → ` +
    `${unique.length} distinct route(s), kept ${kept.length}${unique.length > kept.length ? ` (capped at ${MAX_ROUTES})` : ''}.`
  );

  return kept.length > 0 ? kept : (seeds.length > 0 ? seeds : null);
};
