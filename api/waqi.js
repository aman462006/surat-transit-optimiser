/**
 * WAQI (aqicn.org) proxy — nearest ground station to a coordinate.
 *
 * WHY THIS EXISTS: the WAQI token used to be a VITE_WAQI_TOKEN frontend
 * variable, which Vite bakes into the public client bundle — anyone could
 * read it from the shipped JavaScript. The token now lives ONLY on the
 * server as WAQI_TOKEN. The client calls this same-origin endpoint:
 *
 *   GET /api/waqi?lat=21.17&lng=72.83
 *     → { status: 'ok', data: {...} }   (upstream JSON, passed through)
 *     → { status: 'error', keyConfigured: false } when no token is set.
 *
 * Coordinates are validated (finite, in range) and results are cached 60 s
 * per ~100 m grid cell (3-decimal lat/lng) to respect WAQI rate limits.
 */

// Tolerant lookup (same pattern as api/air.js): catches env var names with
// invisible copied-in whitespace.
const rawWaqiToken = process.env.WAQI_TOKEN ?? (() => {
  const found = Object.keys(process.env).find((k) => k.trim() === 'WAQI_TOKEN');
  return found ? process.env[found] : undefined;
})();
const WAQI_TOKEN = (rawWaqiToken || '').trim();

const CACHE_TTL_MS = 60 * 1000; // 60 s
const cache = new Map();       // "lat,lng" (3 decimals) -> { at, data }

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  const lat = parseFloat(req.query.lat);
  const lng = parseFloat(req.query.lng);
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || lat < -90 || lat > 90 || lng < -180 || lng > 180) {
    res.status(400).json({ error: 'lat and lng are required numbers in range' });
    return;
  }

  if (!WAQI_TOKEN) {
    // Mirror WAQI's own error shape so the client's existing status !== 'ok'
    // path treats this exactly like "no nearby station": fall back, no crash.
    res.status(200).json({ status: 'error', keyConfigured: false, data: 'WAQI_TOKEN not set on the server' });
    return;
  }

  const key = `${lat.toFixed(3)},${lng.toFixed(3)}`;
  const cached = cache.get(key);
  if (cached && Date.now() - cached.at < CACHE_TTL_MS) {
    res.status(200).json({ ...cached.data, cached: true });
    return;
  }

  const url = `https://api.waqi.info/feed/geo:${lat};${lng}/?token=${encodeURIComponent(WAQI_TOKEN)}`;

  try {
    const upstream = await fetch(url, { headers: { 'Accept': 'application/json' } });
    if (!upstream.ok) throw new Error(`WAQI status ${upstream.status}`);
    const json = await upstream.json();
    // Cache only usable answers; a "no station" miss is cheap to re-check.
    if (json && json.status === 'ok') cache.set(key, { at: Date.now(), data: json });
    res.status(200).json(json);
  } catch (err) {
    res.status(502).json({ error: `WAQI fetch failed: ${err.message}` });
  }
}
