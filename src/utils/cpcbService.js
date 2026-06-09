/**
 * CPCB Real-Time Air-Quality Service (data.gov.in)
 *
 * Fetches LIVE, in-city pollutant readings from India's Central Pollution
 * Control Board continuous monitoring stations, published on data.gov.in.
 *
 * Unlike WAQI (whose nearest Surat station is ~50 km away in Ankleshwar), CPCB
 * has real stations inside Surat itself (e.g. Katargam, Science Center), so this
 * is the most accurate source available — actual ground sensors on the route.
 *
 * The API returns raw concentrations (µg/m³ for PM), not AQI, so we convert to
 * the US-EPA AQI scale to stay consistent with the rest of the app.
 */

// data.gov.in API key — public sample key by default; override with your own
// free key via VITE_DATAGOV_KEY (sample key is shared and rate-limited).
const DATAGOV_KEY =
  (import.meta.env && import.meta.env.VITE_DATAGOV_KEY) ||
  '579b464db66ec23bdd000001cdd3946e44ce4aad7209ff7b23ac571b';

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
const ANCHOR_CITIES = ['Surat', 'Navsari', 'Ankleshwar', 'Bharuch', 'Vadodara'];

/** Fetches and parses CPCB stations for a single city. */
const fetchCityStations = async (city) => {
  const url =
    `https://api.data.gov.in/resource/${RESOURCE_ID}` +
    `?api-key=${DATAGOV_KEY}&format=json&limit=200&filters%5Bcity%5D=${encodeURIComponent(city)}`;
  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`data.gov.in status ${res.status}`);
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
    console.warn(`CPCB fetch failed for ${city}:`, err.message);
    return [];
  }
};

let _regionalStationsPromise = null;

/**
 * Fetches live CPCB stations across Surat + nearby Gujarat cities (parallel),
 * grouped into { station, city, lat, lng, lastUpdate, pollutants:{ pm25, ... } }.
 * Cached for the session (CPCB data refreshes hourly).
 *
 * @returns {Promise<Array>} Station list (empty array on failure).
 */
export const fetchRegionalStations = async () => {
  if (_regionalStationsPromise) return _regionalStationsPromise;

  _regionalStationsPromise = (async () => {
    const lists = await Promise.all(ANCHOR_CITIES.map(fetchCityStations));
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
