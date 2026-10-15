/**
 * data.gov.in CPCB proxy (legacy fallback air source).
 *
 * WHY THIS EXISTS: data.gov.in requires an api-key parameter on every call.
 * Calling it from the browser would ship the key inside the client bundle
 * (any VITE_ variable is baked into dist/ by Vite), so the key now lives
 * ONLY in the server environment as DATAGOV_KEY — no VITE_ prefix, never
 * bundled. The client calls this same-origin endpoint instead:
 *
 *   GET /api/cpcb?city=Surat
 *     → { status, records: [...], ... }   (upstream JSON, passed through)
 *     → 400 for a bad/unknown city, 503 if DATAGOV_KEY is not configured.
 *
 * Input is validated against a whitelist of the anchor cities the app
 * actually queries, and results are cached 5 minutes per city so a burst
 * of users cannot burn the shared data.gov.in rate limit.
 */

// Tolerant lookup (same pattern as api/air.js): a copied env var NAME with an
// invisible trailing space looks fine in the Vercel dashboard but silently
// fails to match. Scan and trim before matching.
const rawDatagovKey = process.env.DATAGOV_KEY ?? (() => {
  const found = Object.keys(process.env).find((k) => k.trim() === 'DATAGOV_KEY');
  return found ? process.env[found] : undefined;
})();
const DATAGOV_KEY = (rawDatagovKey || '').trim();

const RESOURCE_ID = '3b01bcb8-0b14-4abf-b6f2-c1bfd384ba69'; // CPCB real-time AQI resource

// Exactly the cities the frontend queries as interpolation anchors. A request
// for anything else is rejected — this is a fixed-purpose proxy, not an open relay.
const ALLOWED_CITIES = ['Surat', 'Navsari', 'Ankleshwar', 'Bharuch', 'Vadodara'];

const CACHE_TTL_MS = 5 * 60 * 1000; // 300 s: well under data.gov.in's shared rate limits
const cache = new Map();            // city -> { at, data }; only success is cached

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  const city = typeof req.query.city === 'string' ? req.query.city.trim() : '';
  if (!ALLOWED_CITIES.includes(city)) {
    res.status(400).json({ error: `city must be one of: ${ALLOWED_CITIES.join(', ')}` });
    return;
  }

  if (!DATAGOV_KEY) {
    res.status(503).json({
      error: 'DATAGOV_KEY is not set on the server. Add it in Vercel → Settings → Environment Variables.',
      keyConfigured: false
    });
    return;
  }

  const cached = cache.get(city);
  if (cached && Date.now() - cached.at < CACHE_TTL_MS) {
    res.status(200).json({ ...cached.data, cached: true });
    return;
  }

  const url =
    `https://api.data.gov.in/resource/${RESOURCE_ID}` +
    `?api-key=${encodeURIComponent(DATAGOV_KEY)}&format=json&limit=200` +
    `&filters%5Bcity%5D=${encodeURIComponent(city)}`;

  try {
    const upstream = await fetch(url, { headers: { 'Accept': 'application/json' } });
    if (!upstream.ok) throw new Error(`data.gov.in status ${upstream.status}`);
    const json = await upstream.json();
    if (!Array.isArray(json.records)) throw new Error('data.gov.in returned no records array');
    cache.set(city, { at: Date.now(), data: json });
    res.status(200).json(json);
  } catch (err) {
    res.status(502).json({ error: `data.gov.in fetch failed: ${err.message}` });
  }
}
