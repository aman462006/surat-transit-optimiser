/**
 * OpenAQ ground-sensor proxy (air quality).
 *
 * The app's primary air source is India's CPCB ground-monitor network. We now
 * read it through OpenAQ (api.openaq.org), which ingests the official CPCB /
 * SMC station feeds and exposes a modern, reliable API.
 *
 * Why a serverless proxy instead of calling OpenAQ from the browser:
 *  - OpenAQ requires the key in an X-API-Key header. Browsers send a CORS
 *    preflight for custom headers WITHOUT the key, and OpenAQ's preflight
 *    endpoint answers 401, so direct browser calls can never work.
 *  - data.gov.in (the legacy direct CPCB source) rejects foreign IPs, so a
 *    server-side fetch must run somewhere it is reachable — and it must hide
 *    the key from the client bundle anyway.
 *
 * GET /api/air?lat=21.17&lng=72.83&radius=25000
 *   → { source: 'openaq', stations: [ { station, city: null, lat, lng,
 *       lastUpdate, pollutants: { pm25, pm10, ... } } ] }
 *
 * Readings older than STALE_AFTER_HOURS are dropped so the app's "measured"
 * layer never presents week-old numbers as live ground truth.
 */

const OPENAQ_API_KEY = (process.env.OPENAQ_API_KEY || '').trim();
const OPENAQ_BASE = 'https://api.openaq.org/v3';
const DEFAULT_RADIUS_M = 25000; // OpenAQ caps radius at 25,000 m.
const STALE_AFTER_HOURS = 48;   // CPCB feeds can lag ~24h; beyond 48h is not "live".

// 10-minute server cache per query: one user session across route changes
// should not multiply our OpenAQ call volume. Only success is cached.
const CACHE_TTL_MS = 10 * 60 * 1000;
const cache = new Map();

const fetchOpenAQ = async (url) => {
  const res = await fetch(url, {
    headers: {
      'X-API-Key': OPENAQ_API_KEY,
      'Accept': 'application/json',
      'User-Agent': 'surat-transit-optimiser'
    }
  });
  if (!res.ok) throw new Error(`OpenAQ status ${res.status}`);
  return res.json();
};

const parseISO = (v) => {
  const t = Date.parse(v);
  return Number.isFinite(t) ? t : null;
};

/**
 * All stations with fresh PM readings within `radius` metres of (lat, lng).
 * Calls: 1 × locations search + 1 × latest-measurements per location found.
 */
const stationsNear = async (lat, lng, radius) => {
  const locJson = await fetchOpenAQ(
    `${OPENAQ_BASE}/locations?coordinates=${lat},${lng}&radius=${radius}&limit=100`
  );
  const locations = Array.isArray(locJson.results) ? locJson.results : [];
  const stations = [];

  for (const loc of locations) {
    if (!loc || !loc.coordinates) continue;
    // Map sensorId → parameter name (needed to label the latest readings).
    const sensorMap = new Map(
      (Array.isArray(loc.sensors) ? loc.sensors : []).map((s) => [s.id, (s.parameter || {}).name])
    );

    let latestJson;
    try {
      latestJson = await fetchOpenAQ(`${OPENAQ_BASE}/locations/${loc.id}/latest`);
    } catch {
      continue; // one dead station must not sink the rest
    }

    const pollutants = {};
    let newestMs = 0;
    for (const m of (Array.isArray(latestJson.results) ? latestJson.results : [])) {
      const param = sensorMap.get(m.sensorsId);
      const t = m && m.datetime ? parseISO(m.datetime.utc) : null;
      if (!param || typeof m.value !== 'number' || t == null) continue;
      if (Date.now() - t > STALE_AFTER_HOURS * 60 * 60 * 1000) continue;
      pollutants[param] = m.value;
      if (t > newestMs) newestMs = t;
    }

    // The app interpolates PM from ground stations; without PM there is nothing usable.
    if (pollutants.pm25 == null && pollutants.pm10 == null) continue;

    stations.push({
      station: loc.name || `OpenAQ station ${loc.id}`,
      city: null, // filled in by the caller, which knows which anchor city it asked for
      lat: loc.coordinates.latitude,
      lng: loc.coordinates.longitude,
      lastUpdate: newestMs ? new Date(newestMs).toISOString() : null,
      pollutants
    });
  }

  return stations;
};

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  const lat = parseFloat(req.query.lat);
  const lng = parseFloat(req.query.lng);
  const radius = Math.min(25000, Math.max(1000, parseInt(req.query.radius, 10) || DEFAULT_RADIUS_M));
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    res.status(400).json({ error: 'lat and lng are required and must be numbers' });
    return;
  }

  if (!OPENAQ_API_KEY) {
    // Config gap, not an outage — say so, so the UI never blames the network.
    res.status(200).json({
      source: 'openaq',
      keyConfigured: false,
      reason: 'OPENAQ_API_KEY is not set on the server. Add it in Vercel → Settings → Environment Variables.',
      stations: []
    });
    return;
  }

  const key = `${lat.toFixed(3)},${lng.toFixed(3)},${radius}`;
  const cached = cache.get(key);
  if (cached && Date.now() - cached.at < CACHE_TTL_MS) {
    res.status(200).json({ ...cached.data, cached: true });
    return;
  }

  try {
    const stations = await stationsNear(lat, lng, radius);
    const data = { source: 'openaq', keyConfigured: true, stations };
    if (stations.length > 0) cache.set(key, { at: Date.now(), data }); // never cache an empty miss
    res.status(200).json(data);
  } catch (err) {
    // Fail soft: the client falls back to WAQI → CAMS, same as before.
    res.status(200).json({
      source: 'openaq',
      keyConfigured: true,
      error: String((err && err.message) || err),
      stations: []
    });
  }
}
