/**
 * Ground-sensor air-quality service (CPCB network).
 *
 * PRIMARY: official CPCB / SMC station feeds via OpenAQ (api.openaq.org),
 * fetched through our own /api/air serverless proxy. OpenAQ requires an
 * X-API-Key header whose CORS preflight browsers cannot pass, and data.gov.in
 * (the legacy direct source) rejects foreign IPs, so this layer is proxied.
 *
 * FALLBACK: the legacy data.gov.in resource API, now fetched through our own
 * /api/cpcb serverless proxy (api/cpcb.js). The data.gov.in key is a
 * SERVER-ONLY env var (DATAGOV_KEY) — it must never be a VITE_ variable,
 * because Vite bakes every VITE_ value into the public client bundle. Kept
 * for the case where OpenAQ has no coverage near an anchor city but
 * data.gov.in still answers.
 *
 * Unlike WAQI (whose nearest Surat station is ~50 km away in Ankleshwar), the
 * CPCB network has real stations inside Surat itself (e.g. Science Center,
 * Katargam), so this remains the most accurate source available — actual
 * ground sensors on the route.
 *
 * The APIs return raw concentrations (µg/m³ for PM), not AQI, so we convert
 * to the US-EPA AQI scale to stay consistent with the rest of the app.
 */

// Same-origin by default: on Vercel, /api/air is the serverless function in
// api/air.js (mirrors how the traffic layer resolves /api/traffic).
const BACKEND_URL =
  (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.VITE_BACKEND_URL) || '';

// CPCB "Real time Air Quality Index from various locations" resource.
const RESOURCE_ID = '3b01bcb8-0b14-4abf-b6f2-c1bfd384ba69';

// US-EPA breakpoints [Clow, Chigh, Ilow, Ihigh] per pollutant (µg/m³ ↔ AQI).
const BREAKPOINTS = {
  pm25: [
    [0.0, 12.0, 0, 50], [12.1, 35.4, 51, 100], [35.5, 55.4, 101, 150],
    [55.5, 150.4, 151, 200], [150.5, 250.4, 201, 300], [250.5, 350.4, 301, 400], [350.5, 500.4, 401, 500]
  ],
  pm10: [
    [0, 54, 0, 50], [55, 154, 51, 100], [155, 254, 101, 150],
    [255, 354, 151, 200], [355, 424, 201, 300], [425, 504, 301, 400], [505, 604, 401, 500]
  ]
};

/** Forward-converts a pollutant concentration (µg/m³) to its US-EPA AQI sub-index. */
export const concentrationToAqi = (pollutant, conc) => {
  const bp = BREAKPOINTS[pollutant];
  if (!bp || typeof conc !== 'number' || conc < 0) return null;
  for (const [cLow, cHigh, iLow, iHigh] of bp) {
    if (conc >= cLow && conc <= cHigh) {
      return Math.round(((iHigh - iLow) / (cHigh - cLow)) * (conc - cLow) + iLow);
    }
  }
  return 500; // above the top breakpoint
};

const POLLUTANT_KEY = {
  'PM2.5': 'pm25', 'PM10': 'pm10', 'NO2': 'no2', 'SO2': 'so2',
  'CO': 'co', 'NH3': 'nh3', 'OZONE': 'o3', 'O3': 'o3'
};

// South/Central Gujarat cities queried as interpolation anchors. Surat is the
// primary source; the rest only matter via 1/distance² weighting (a station
// 50 km away barely shifts a Surat result) or if Surat's monitors drop offline.
// NOTE: these are DATA anchors only — none of them are drawn on the map.
// OpenAQ is searched by coordinates (it has no city filter), so each anchor
// carries its centre point; the legacy data.gov path still queries by name.
const ANCHOR_CITIES = [
  { name: 'Surat', lat: 21.1702, lng: 72.8311 },
  { name: 'Navsari', lat: 20.9493, lng: 72.9338 },
  { name: 'Ankleshwar', lat: 21.6333, lng: 73.0083 },
  { name: 'Bharuch', lat: 21.7050, lng: 72.9970 },
  { name: 'Vadodara', lat: 22.3072, lng: 73.1812 }
];

// 10-minute in-memory cache per anchor city. Only successful, non-empty
// results are cached — a blip must not blank the air-quality layer for the
// next 10 minutes.
const CACHE_TTL_MS = 10 * 60 * 1000;
const anchorCache = new Map();

/**
 * PRIMARY path: ground stations near one anchor via the /api/air proxy.
 * Returns [] when the proxy is unconfigured, unreachable, or has no fresh
 * coverage — callers fall back to the legacy data.gov.in path.
 */
const fetchAnchorViaOpenAQ = async (anchor) => {
  const cached = anchorCache.get(anchor.name);
  if (cached && Date.now() - cached.at < CACHE_TTL_MS) return cached.data;

  try {
    const url = `${BACKEND_URL}/api/air?lat=${anchor.lat}&lng=${anchor.lng}&radius=25000`;
    const res = await fetch(url);
    if (!res.ok) throw new Error(`/api/air status ${res.status}`);
    const json = await res.json();
    const stations = Array.isArray(json.stations) ? json.stations : [];

    // Tag each station with the anchor it came from (proxy leaves city null).
    for (const s of stations) s.city = anchor.name;

    if (stations.length > 0) anchorCache.set(anchor.name, { at: Date.now(), data: stations });
    return stations;
  } catch (err) {
    console.warn(`OpenAQ proxy fetch failed for ${anchor.name}:`, err.message);
    return []; // never cache failures
  }
};

/**
 * FALLBACK path: legacy data.gov.in resource API for one city (by name).
 */
const fetchAnchorViaDataGov = async (city) => {
  // Same-origin proxy: the data.gov.in key lives only on the server.
  const url = `${BACKEND_URL}/api/cpcb?city=${encodeURIComponent(city)}`;
  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`/api/cpcb status ${res.status}`);
    const json = await res.json();
    const records = Array.isArray(json.records) ? json.records : [];

    const byStation = new Map();
    for (const r of records) {
      const lat = parseFloat(r.latitude);
      const lng = parseFloat(r.longitude);
      const value = parseFloat(r.avg_value);
      if (!Number.isFinite(lat) || !Number.isFinite(lng) || !Number.isFinite(value)) continue;

      if (!byStation.has(r.station)) {
        byStation.set(r.station, { station: r.station, city, lat, lng, lastUpdate: r.last_update, pollutants: {} });
      }
      const pk = POLLUTANT_KEY[r.pollutant_id];
      if (pk) byStation.get(r.station).pollutants[pk] = value;
    }
    return Array.from(byStation.values());
  } catch (err) {
    console.warn(`data.gov.in fetch failed for ${city}:`, err.message);
    return [];
  }
};

/** Fetches ground stations for one anchor: OpenAQ first, data.gov.in second. */
const fetchAnchorStations = async (anchor) => {
  const viaOpenAQ = await fetchAnchorViaOpenAQ(anchor);
  if (viaOpenAQ.length > 0) return viaOpenAQ;
  return fetchAnchorViaDataGov(anchor.name);
};

let _regionalStationsPromise = null;

/**
 * Fetches live ground stations across Surat + nearby Gujarat cities (parallel),
 * grouped into { station, city, lat, lng, lastUpdate, pollutants:{ pm25, ... } }.
 * Cached for the session (the monitor network refreshes hourly).
 *
 * @returns {Promise<Array>} Station list (empty array on failure).
 */
export const fetchRegionalStations = async () => {
  if (_regionalStationsPromise) return _regionalStationsPromise;

  _regionalStationsPromise = (async () => {
    const lists = await Promise.all(ANCHOR_CITIES.map(fetchAnchorStations));
    const merged = lists.flat();
    // De-dupe by station name (a city occasionally appears in two pulls).
    const seen = new Map();
    for (const s of merged) if (!seen.has(s.station)) seen.set(s.station, s);
    const result = Array.from(seen.values());
    if (result.length === 0) _regionalStationsPromise = null; // allow retry if all failed
    return result;
  })();

  return _regionalStationsPromise;
};
