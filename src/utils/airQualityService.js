/**
 * Air-Quality Exposure Service
 *
 * Estimates how much air pollution a traveller is exposed to along a route.
 *
 * Pipeline:
 *  1. Sample the travel path roughly every 500 m.
 *  2. Pull AQI + PM2.5 + PM10 at each sample from the Open-Meteo Air-Quality API
 *     (free, no key — backed by the Copernicus CAMS global model).
 *  3. Average along the path → "per-500 m" intensity the user is constantly exposed to.
 *  4. Combine intensity x trip duration → cumulative inhaled-dose (the health-accurate
 *     measure: dirtier air AND longer trips both raise it).
 *  5. Classify into Low / Medium / High / Very High with colour + advice.
 *
 * Note on resolution: the CAMS global grid is ~40 km, so within a single Surat trip
 * AQI is nearly uniform — which is exactly why "constantly exposed to X" is apt here.
 * Sampling still matters for longer routes that cross grid cells.
 */

import { fetchNearestStation, aqiToPm25Concentration } from './waqiService.js';
import { fetchRegionalStations, concentrationToAqi } from './cpcbService.js';

const AQI_API = 'https://air-quality-api.open-meteo.com/v1/air-quality';

// Use a real WAQI ground station only when one is within this distance of the
// route; otherwise the model is more representative than a far-away sensor.
const STATION_MAX_KM = 25;

// CPCB in-city stations are the best source; use them when any monitor sits
// within this distance of the route (covers all of Surat).
const CPCB_MAX_KM = 30;

// Light-commuting ventilation rate (m³/h) used to turn concentration into an
// intuitive "micrograms actually inhaled" figure. ~0.84 m³/h ≈ seated/active travel.
const BREATHING_RATE_M3_PER_H = 0.84;

const SEGMENT_METERS = 500; // "per 500 m" resolution requested
const MAX_SAMPLES = 12;     // keep the API URL short; AQI barely varies intra-city

// ---- Distance helpers -------------------------------------------------------

const toRad = (d) => (d * Math.PI) / 180;

const haversineMeters = ([lat1, lng1], [lat2, lng2]) => {
  const R = 6371000;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
};

const pathLengthMeters = (positions) => {
  let total = 0;
  for (let i = 1; i < positions.length; i++) {
    total += haversineMeters(positions[i - 1], positions[i]);
  }
  return total;
};

/**
 * Walks the polyline and emits a point every `intervalM` metres (capped at
 * `maxPoints`, always including start and end).
 */
export const samplePathPoints = (positions, intervalM = SEGMENT_METERS, maxPoints = MAX_SAMPLES) => {
  if (!positions || positions.length < 2) return positions || [];

  const total = pathLengthMeters(positions);
  // If the path is shorter than one segment, just use the endpoints.
  if (total <= intervalM) return [positions[0], positions[positions.length - 1]];

  // Use a coarser interval if 500 m would exceed the sample cap.
  const effectiveInterval = Math.max(intervalM, total / maxPoints);

  const samples = [positions[0]];
  let nextMark = effectiveInterval;
  let walked = 0;

  for (let i = 1; i < positions.length; i++) {
    const segLen = haversineMeters(positions[i - 1], positions[i]);
    while (walked + segLen >= nextMark && samples.length < maxPoints - 1) {
      const ratio = (nextMark - walked) / segLen;
      const lat = positions[i - 1][0] + ratio * (positions[i][0] - positions[i - 1][0]);
      const lng = positions[i - 1][1] + ratio * (positions[i][1] - positions[i - 1][1]);
      samples.push([lat, lng]);
      nextMark += effectiveInterval;
    }
    walked += segLen;
  }
  samples.push(positions[positions.length - 1]);
  return samples;
};

// ---- Classification (official US-EPA AQI guideline) -------------------------

/**
 * The six official US-EPA AQI categories with their exact guideline colours,
 * names and health advice. WAQI and Open-Meteo both report on this scale.
 */
export const AQI_BANDS = [
  { max: 50,  level: 'good',           name: 'Good', short: 'Good', range: '0–50',
    color: '#00E400', advice: 'Air quality is satisfactory and poses little or no health risk.' },
  { max: 100, level: 'moderate',       name: 'Moderate', short: 'Moderate', range: '51–100',
    color: '#FFFF00', advice: 'Acceptable; unusually sensitive people should limit prolonged outdoor exertion.' },
  { max: 150, level: 'usg',            name: 'Unhealthy for Sensitive Groups', short: 'Sensitive', range: '101–150',
    color: '#FF7E00', advice: 'Sensitive groups (asthma, children, elderly) should limit prolonged open-air travel.' },
  { max: 200, level: 'unhealthy',      name: 'Unhealthy', short: 'Unhealthy', range: '151–200',
    color: '#FF0000', advice: 'Everyone may feel effects. Wear an N95 and keep open-air time short.' },
  { max: 300, level: 'very-unhealthy', name: 'Very Unhealthy', short: 'Very Unhealthy', range: '201–300',
    color: '#8F3F97', advice: 'Health alert. Avoid open-air travel; wear an N95.' },
  { max: Infinity, level: 'hazardous', name: 'Hazardous', short: 'Hazardous', range: '301+',
    color: '#7E0023', advice: 'Emergency conditions — entire population affected. Avoid all outdoor activity.' }
];

/** Classifies a US-EPA AQI value into its official band. */
export const classifyAqi = (aqi) => AQI_BANDS.find((b) => aqi <= b.max) || AQI_BANDS[AQI_BANDS.length - 1];

// EPA PM2.5 concentration breakpoints (µg/m³) aligned to the same six bands.
const PM25_THRESHOLDS = [12, 35.4, 55.4, 150.4, 250.4, Infinity];

/** Classifies a PM2.5 concentration (µg/m³) into the official AQI band. */
export const classifyPm25 = (conc) => {
  const idx = PM25_THRESHOLDS.findIndex((t) => conc <= t);
  return AQI_BANDS[idx === -1 ? AQI_BANDS.length - 1 : idx];
};

const avg = (nums) => (nums.length ? nums.reduce((s, n) => s + n, 0) / nums.length : 0);

// ---- Model source (Open-Meteo / CAMS) --------------------------------------

/**
 * Fetches modelled AQI/PM2.5/PM10 averaged over the sampled path points.
 * @returns {Promise<{avgAqi,peakAqi,avgPm25,avgPm10}|null>}
 */
const fetchModelExposure = async (samples) => {
  const lat = samples.map((p) => p[0].toFixed(4)).join(',');
  const lng = samples.map((p) => p[1].toFixed(4)).join(',');
  const url = `${AQI_API}?latitude=${lat}&longitude=${lng}&current=pm2_5,pm10,us_aqi&domains=cams_global`;

  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`Air-quality API status ${res.status}`);
    let data = await res.json();
    if (!Array.isArray(data)) data = [data]; // single-point responses are objects

    const aqis = data.map((d) => d?.current?.us_aqi).filter((v) => typeof v === 'number');
    const pm25s = data.map((d) => d?.current?.pm2_5).filter((v) => typeof v === 'number');
    const pm10s = data.map((d) => d?.current?.pm10).filter((v) => typeof v === 'number');
    if (aqis.length === 0 || pm25s.length === 0) throw new Error('No usable model data');

    return {
      avgAqi: Math.round(avg(aqis)),
      peakAqi: Math.round(Math.max(...aqis)),
      avgPm25: +avg(pm25s).toFixed(1),
      avgPm10: +avg(pm10s).toFixed(1)
    };
  } catch (err) {
    console.warn('Model exposure lookup failed:', err.message);
    return null;
  }
};

// ---- CPCB source (real in-city stations, IDW-interpolated along the path) ---

/**
 * Distance-weighted (IDW) interpolation of CPCB station concentrations at each
 * path sample — gives a genuine per-500 m AQI profile from real sensors.
 * @returns {{avgAqi,peakAqi,avgPm25,avgPm10}|null}
 */
const interpolateCpcb = (samples, stations) => {
  const idwAt = (pt, key) => {
    let wSum = 0;
    let vSum = 0;
    for (const s of stations) {
      const v = s.pollutants[key];
      if (typeof v !== 'number') continue;
      const dKm = haversineMeters(pt, [s.lat, s.lng]) / 1000;
      const w = 1 / (dKm * dKm + 0.01); // +eps so a point on a station doesn't divide by zero
      wSum += w;
      vSum += w * v;
    }
    return wSum > 0 ? vSum / wSum : null;
  };

  const perSample = samples.map((pt) => {
    const pm25 = idwAt(pt, 'pm25');
    const pm10 = idwAt(pt, 'pm10');
    const aqiCandidates = [
      pm25 != null ? concentrationToAqi('pm25', pm25) : null,
      pm10 != null ? concentrationToAqi('pm10', pm10) : null
    ].filter((v) => typeof v === 'number');
    return { pm25, pm10, aqi: aqiCandidates.length ? Math.max(...aqiCandidates) : null };
  });

  const pm25s = perSample.map((s) => s.pm25).filter((v) => typeof v === 'number');
  const pm10s = perSample.map((s) => s.pm10).filter((v) => typeof v === 'number');
  const aqis = perSample.map((s) => s.aqi).filter((v) => typeof v === 'number');
  if (pm25s.length === 0 || aqis.length === 0) return null;

  return {
    avgAqi: Math.round(avg(aqis)),
    peakAqi: Math.max(...aqis),
    avgPm25: +avg(pm25s).toFixed(1),
    avgPm10: pm10s.length ? +avg(pm10s).toFixed(1) : null
  };
};

/**
 * Estimates the percentage uncertainty of an AQI/PM2.5 reading so the UI can
 * show an honest "±X%" next to the number. This is an ESTIMATE (not a live
 * measured error — there's no second ground-truth source to diff against),
 * derived from how the value was sourced and how far the nearest sensor is:
 *  - CPCB live sensors: most trustworthy; uncertainty grows with interpolation
 *    distance from the nearest monitor.
 *  - WAQI single station: slightly higher base, grows with distance.
 *  - CAMS model: a coarse ~40 km grid, so a flat, higher baseline.
 */
export const estimateAqiUncertaintyPct = (source, stationDistanceKm) => {
  if (source === 'model') return 30;            // coarse modelled grid
  const d = stationDistanceKm || 0;
  if (source === 'cpcb') return Math.min(40, Math.round(8 + 1.2 * d));
  if (source === 'station') return Math.min(45, Math.round(12 + 1.5 * d));
  return null;
};

/** Assembles the AMBIENT exposure summary (route air quality, mode-independent). */
const buildResult = (base) => {
  const { avgAqi, peakAqi, avgPm25, avgPm10, segments, totalMeters } = base;
  return {
    ok: true,
    source: base.source,                 // 'cpcb' | 'station' | 'model'
    stationName: base.stationName || null,
    stationDistanceKm: base.stationDistanceKm ?? null,
    stationsUsed: base.stationsUsed ?? null,
    measuredAt: base.measuredAt || null,
    dominant: base.dominant || null,
    avgAqi,
    peakAqi,
    avgPm25,
    avgPm10,
    segments,
    distanceKm: +(totalMeters / 1000).toFixed(2),
    aqiClass: classifyAqi(avgAqi),
    pm25Class: classifyPm25(avgPm25),
    // Honest ±% uncertainty estimate (source + sensor distance based).
    uncertaintyPct: estimateAqiUncertaintyPct(base.source, base.stationDistanceKm)
  };
};

// ---- Per-mode exposure (microenvironment factor × time) ---------------------

/**
 * Relative inhaled-PM2.5 multipliers vs ambient roadside air, by travel
 * microenvironment. Walking in open roadside air is the 100% reference (×1.0);
 * every other mode is scaled to it. Each factor is the MIDPOINT of the measured
 * exposure range for that microenvironment, and `reason` explains in one line
 * why a single multiplier captures the whole picture for that mode.
 *
 * Source table (share of walking exposure), car assumed windows-closed:
 *   Walking 100% · Auto-rickshaw 70–95% · Bus (windows open) 60–90% ·
 *   Car (windows closed, AC) 20–60%.
 */
export const MODE_EXPOSURE_FACTORS = {
  'private-car': {
    factor: 0.40,            // midpoint of 20–60% (windows closed, AC on)
    range: [0.20, 0.60],
    label: 'windows closed, AC recirculation',
    reason: 'Sealed windows + AC recirculation and cabin filtration strip most roadside PM2.5, so one ×0.40 multiplier already nets enclosure, ventilation and filtered intake against a pedestrian.'
  },
  'auto-pool': {
    factor: 0.83,            // midpoint of 70–95% (fully open three-wheeler)
    range: [0.70, 0.95],
    label: 'open three-wheeler, in the traffic plume',
    reason: 'With no enclosure you breathe the exhaust plume almost like a pedestrian, so ×0.83 captures the only relief — slight dilution from the vehicle moving through the air.'
  },
  'electric-bus': {
    factor: 0.75,            // midpoint of 60–90% (city bus cabin)
    range: [0.60, 0.90],
    label: 'high-floor bus cabin',
    reason: 'A tall, large-volume cabin sits above and dilutes the kerbside plume to ×0.75, and the model time-blends this with the fully-exposed walk legs so first/last-mile breathing is still counted.'
  }
};
const WALK_FACTOR = 1.0;   // pedestrian in open roadside air — the 100% reference
const RIDE_FACTOR = 0.75;  // inside the bus cabin (matches electric-bus factor)
const DEFAULT_FACTOR = 1.0;

/**
 * Effective exposure factor for a mode. For BRTS it time-blends the enclosed
 * ride legs with the exposed first/last-mile walk legs using the itinerary.
 */
export const getModeExposureFactor = (modeId, itinerary) => {
  if (modeId === 'electric-bus' && itinerary && Array.isArray(itinerary.itinerary)) {
    let walkMin = 0;
    let rideMin = 0;
    for (const leg of itinerary.itinerary) {
      if (leg.type === 'walk') walkMin += leg.durationMins || 0;
      else if (leg.type === 'ride') rideMin += leg.durationMins || 0;
    }
    const total = walkMin + rideMin;
    if (total > 0) return +((walkMin * WALK_FACTOR + rideMin * RIDE_FACTOR) / total).toFixed(2);
  }
  return MODE_EXPOSURE_FACTORS[modeId]?.factor ?? DEFAULT_FACTOR;
};

/**
 * Computes mode-specific exposure from the ambient summary.
 *
 * @param {Object} ambient - Result of fetchRouteExposure (must be .ok).
 * @param {{modeId:string, durationMins:number, itinerary?:Object}} opts
 * @returns {Object|null} { factor, factorLabel, effectivePm25, dosePm25, inhaledPm25Ug, pm25Class }
 */
export const computeModeExposure = (ambient, { modeId, durationMins, itinerary }) => {
  if (!ambient || !ambient.ok || !durationMins || durationMins <= 0) return null;
  const factor = getModeExposureFactor(modeId, itinerary);
  const effectivePm25 = +(ambient.avgPm25 * factor).toFixed(1);
  const hours = durationMins / 60;
  const isBlend = modeId === 'electric-bus' && itinerary;
  const spec = MODE_EXPOSURE_FACTORS[modeId];
  return {
    factor,
    factorLabel: isBlend ? 'bus cabin + exposed walk legs' : (spec?.label || 'open / exposed'),
    factorReason: isBlend
      ? 'Time-weighted blend of the high-floor bus cabin (≈0.75 of roadside air) and the fully-exposed first/last-mile walk legs (×1.0), so both the ride and the walking breathing are counted.'
      : (spec?.reason || 'Open / exposed travel, taken at full roadside air.'),
    factorRange: spec?.range || null,
    effectivePm25,
    durationMins: Math.round(durationMins),
    dosePm25: +(effectivePm25 * hours).toFixed(1),                         // µg·h/m³
    inhaledPm25Ug: +(effectivePm25 * BREATHING_RATE_M3_PER_H * hours).toFixed(1),
    pm25Class: classifyPm25(effectivePm25)
  };
};

// ---- Main entry -------------------------------------------------------------

/**
 * Computes AMBIENT route air quality (mode-independent), preferring live CPCB
 * stations, then a nearby WAQI station, then the CAMS model. Apply a mode's
 * personal dose afterwards with computeModeExposure(). The `source` field tells
 * the UI which data source was used.
 *
 * @param {Array<[number, number]>} positions - Route geometry as [lat, lng] pairs.
 * @returns {Promise<Object|null>} Ambient exposure summary, or null on failure.
 */
export const fetchRouteExposure = async (positions) => {
  if (!positions || positions.length < 2) return null;

  const samples = samplePathPoints(positions);
  const totalMeters = pathLengthMeters(positions);
  const segments = Math.max(1, Math.round(totalMeters / SEGMENT_METERS));
  const mid = samples[Math.floor(samples.length / 2)];
  const common = { segments, totalMeters };

  // 1. Best source: live CPCB stations inside Surat, interpolated along the path.
  const cpcbStations = await fetchRegionalStations();
  if (cpcbStations && cpcbStations.length > 0) {
    const withDist = cpcbStations
      .map((s) => ({ s, d: haversineMeters(mid, [s.lat, s.lng]) / 1000 }))
      .sort((a, b) => a.d - b.d);
    const nearest = withDist[0];
    if (nearest && nearest.d <= CPCB_MAX_KM) {
      const interp = interpolateCpcb(samples, cpcbStations);
      if (interp) {
        return buildResult({
          ...common,
          source: 'cpcb',
          ...interp,
          stationName: nearest.s.station,
          stationDistanceKm: +nearest.d.toFixed(1),
          stationsUsed: cpcbStations.length,
          measuredAt: nearest.s.lastUpdate,
          // Dominant = higher AQI sub-index (not raw µg/m³, since PM10 is always larger).
          dominant: (concentrationToAqi('pm25', nearest.s.pollutants.pm25) ?? 0) >=
                    (concentrationToAqi('pm10', nearest.s.pollutants.pm10) ?? 0) ? 'pm25' : 'pm10'
        });
      }
    }
  }

  // 2. Otherwise a real WAQI ground station near the route.
  const station = await fetchNearestStation(mid[0], mid[1]);
  if (station && station.distanceKm != null && station.distanceKm <= STATION_MAX_KM) {
    const pm25Conc = station.pm25Conc ?? aqiToPm25Concentration(station.pm25Index ?? station.aqi) ?? 0;
    return buildResult({
      ...common,
      source: 'station',
      avgAqi: station.aqi,
      peakAqi: station.aqi,
      avgPm25: pm25Conc,
      avgPm10: null,
      stationName: station.stationName,
      stationDistanceKm: station.distanceKm,
      measuredAt: station.time,
      dominant: station.dominant
    });
  }

  // 3. Fall back to the CAMS model.
  const model = await fetchModelExposure(samples);
  if (!model) {
    return { ok: false, source: 'none', nearestStation: station };
  }
  return buildResult({ ...common, source: 'model', ...model });
};
