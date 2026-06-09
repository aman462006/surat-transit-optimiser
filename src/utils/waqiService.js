/**
 * WAQI (World Air Quality Index) Ground-Station Service
 *
 * Fetches REAL measurements from the nearest physical monitoring station via the
 * WAQI API (aqicn.org). Note: WAQI station coverage is sparse — for Surat the
 * nearest station is ~50 km away in Ankleshwar — so callers should check the
 * returned `distanceKm` and fall back to a model when no station is close.
 *
 * WAQI reports pollutants as AQI sub-indices (US-EPA scale), NOT raw µg/m³, so
 * `aqiToPm25Concentration` inverts the EPA breakpoints to recover concentration.
 */

// WAQI token — supplied via the VITE_WAQI_TOKEN env var (see .env.example).
// Never hard-code real tokens in source; without one, WAQI is skipped and the
// exposure feature falls back to CPCB / CAMS.
const WAQI_TOKEN = (import.meta.env && import.meta.env.VITE_WAQI_TOKEN) || '';

const toRad = (d) => (d * Math.PI) / 180;

const haversineKm = (lat1, lng1, lat2, lng2) => {
  const R = 6371;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
};

// US-EPA PM2.5 breakpoints: [Clow, Chigh, Ilow, Ihigh] (24-hr µg/m³ ↔ AQI).
const PM25_BREAKPOINTS = [
  [0.0, 12.0, 0, 50],
  [12.1, 35.4, 51, 100],
  [35.5, 55.4, 101, 150],
  [55.5, 150.4, 151, 200],
  [150.5, 250.4, 201, 300],
  [250.5, 350.4, 301, 400],
  [350.5, 500.4, 401, 500]
];

/**
 * Inverts an AQI sub-index back to a PM2.5 concentration (µg/m³) using the EPA
 * piecewise-linear breakpoints — needed because WAQI gives AQI, not µg/m³.
 */
export const aqiToPm25Concentration = (aqi) => {
  if (typeof aqi !== 'number' || aqi < 0) return null;
  for (const [cLow, cHigh, iLow, iHigh] of PM25_BREAKPOINTS) {
    if (aqi >= iLow && aqi <= iHigh) {
      const conc = ((cHigh - cLow) / (iHigh - iLow)) * (aqi - iLow) + cLow;
      return +conc.toFixed(1);
    }
  }
  return +(((500.4 - 350.5) / (500 - 401)) * (aqi - 401) + 350.5).toFixed(1);
};

const _stationCache = new Map();

/**
 * Fetches the nearest WAQI ground station to a coordinate.
 *
 * @param {number} lat
 * @param {number} lng
 * @returns {Promise<Object|null>} { aqi, pm25Index, pm10Index, pm25Conc,
 *   dominant, stationName, stationGeo:[lat,lng], distanceKm, time } or null.
 */
export const fetchNearestStation = async (lat, lng) => {
  if (!WAQI_TOKEN) return null; // no token configured → skip WAQI
  const key = `${lat.toFixed(3)},${lng.toFixed(3)}`;
  if (_stationCache.has(key)) return _stationCache.get(key);

  const url = `https://api.waqi.info/feed/geo:${lat};${lng}/?token=${WAQI_TOKEN}`;
  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`WAQI status ${res.status}`);
    const json = await res.json();
    if (json.status !== 'ok' || !json.data || typeof json.data.aqi !== 'number') {
      throw new Error('WAQI returned no usable station');
    }

    const d = json.data;
    const geo = Array.isArray(d.city?.geo) ? d.city.geo.map(Number) : null;
    const distanceKm = geo ? +haversineKm(lat, lng, geo[0], geo[1]).toFixed(1) : null;
    const pm25Index = typeof d.iaqi?.pm25?.v === 'number' ? d.iaqi.pm25.v : null;

    const station = {
      aqi: d.aqi,
      pm25Index,
      pm10Index: typeof d.iaqi?.pm10?.v === 'number' ? d.iaqi.pm10.v : null,
      pm25Conc: pm25Index != null ? aqiToPm25Concentration(pm25Index) : null,
      dominant: d.dominentpol || null,
      stationName: d.city?.name || 'Unknown station',
      stationGeo: geo,
      distanceKm,
      time: d.time?.s || null
    };
    _stationCache.set(key, station);
    return station;
  } catch (err) {
    console.warn('WAQI nearest-station lookup failed:', err.message);
    _stationCache.set(key, null);
    return null;
  }
};
