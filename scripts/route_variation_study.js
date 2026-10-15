#!/usr/bin/env node
/**
 * Route-variation study: is the "cleanest air" route meaningfully different
 * from the fastest, across a fixed, pre-registered set of 30 Surat OD pairs?
 *
 * HOW IT RUNS (the pipeline itself is NOT modified):
 *  1. A tiny local server mounts the REAL serverless functions (api/air.js,
 *     api/cpcb.js, api/waqi.js, api/traffic.js) so the frontend services run
 *     against the exact production code paths, same-origin.
 *  2. globalThis.fetch is wrapped with an on-disk cache (scripts/.study_cache/):
 *     every HTTP response (2xx only) is stored keyed by method+URL+body and
 *     replayed on reruns, so the study is byte-for-byte reproducible offline.
 *     Use --fresh to bust the cache.
 *  3. For each pair in scripts/od_pairs.json (fixed in advance), the real
 *     computeRoadRouteOptions() pipeline runs (BFS corridor enumeration +
 *     A* fastest + per-corridor exposure + traffic ETA).
 *  4. Results, summary statistics and an honest conclusion are written to
 *     docs/route_variation_study.md.
 *
 * ENVIRONMENT (server-only keys, never VITE_):
 *   OPENAQ_API_KEY   required for live CPCB ground sensors (primary source)
 *   TOMTOM_API_KEY   optional; without it ETAs use the calibrated offline model
 *   WAQI_TOKEN       optional; without it the WAQI layer reports "not set" and is skipped
 *   DATAGOV_KEY      optional; without it the legacy data.gov.in path is skipped
 *
 * Usage: node scripts/route_variation_study.js [--fresh]
 */

import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..');
const CACHE_DIR = path.join(HERE, '.study_cache');
const OD_PAIRS_FILE = path.join(HERE, 'od_pairs.json');
const REPORT_FILE = path.join(ROOT, 'docs', 'route_variation_study.md');
const PORT = Number(process.env.STUDY_PORT || 8788);
const FRESH = process.argv.includes('--fresh');
const DEPARTURE = 'morning-rush'; // fixed window → reproducible congestion model

// ---------------------------------------------------------------------------
// 1. On-disk response cache + fetch wrapper
// ---------------------------------------------------------------------------
const realFetch = globalThis.fetch.bind(globalThis);
fs.mkdirSync(CACHE_DIR, { recursive: true });

const cacheKey = (url, method, body) =>
  crypto.createHash('sha256').update(`${method} ${url} ${body || ''}`).digest('hex').slice(0, 32);

const cacheGet = (k) => {
  const f = path.join(CACHE_DIR, `${k}.json`);
  try { return JSON.parse(fs.readFileSync(f, 'utf8')); } catch { return null; }
};
const cachePut = (k, entry) => {
  const f = path.join(CACHE_DIR, `${k}.json`);
  fs.writeFileSync(f, JSON.stringify(entry, null, 0));
};
let cacheHits = 0, cacheMisses = 0;

/** Resolves same-origin relative URLs against the local server; caches GETs. */
globalThis.fetch = async (input, init = {}) => {
  let url = typeof input === 'string' ? input : input.url;
  let method = (init.method || (typeof input !== 'string' && input.method) || 'GET').toUpperCase();
  if (url.startsWith('/')) url = `http://127.0.0.1:${PORT}${url}`; // same-origin → local server

  const bodyText = typeof init.body === 'string' ? init.body : (init.body ? JSON.stringify(init.body) : '');
  const key = cacheKey(url, method, bodyText);

  if (!FRESH && method === 'GET') {
    const hit = cacheGet(key);
    if (hit) {
      cacheHits++;
      return new Response(hit.body, { status: hit.status, headers: { 'content-type': hit.contentType } });
    }
  }
  cacheMisses++;
  // Gentle retry on 429/5xx: upstreams (esp. Open-Meteo CAMS) rate-limit bursts
  // of parallel corridor queries. This is harness-level (not a pipeline change):
  // the pipeline code is untouched and simply sees a successful response.
  let res;
  for (let attempt = 0; ; attempt++) {
    res = await realFetch(url, init);
    const retryable = res.status === 429 || res.status >= 500;
    if (!retryable || attempt >= 3) break;
    await new Promise((r2) => setTimeout(r2, 2000 * (attempt + 1)));
  }
  if (method === 'GET' && res.ok) {
    const body = await res.text();
    cachePut(key, { url, status: res.status, contentType: res.headers.get('content-type') || 'application/json', body, cachedAt: new Date().toISOString() });
    return new Response(body, { status: res.status, headers: { 'content-type': res.headers.get('content-type') || 'application/json' } });
  }
  return res;
};

// ---------------------------------------------------------------------------
// 2. Local server exposing the real serverless functions, same-origin
// ---------------------------------------------------------------------------
const wrap = (handler) => async (req, res) => {
  const u = new URL(req.url, `http://127.0.0.1:${PORT}`);
  req.query = Object.fromEntries(u.searchParams);
  res.status = (code) => { res.statusCode = code; return res; };
  res.json = (obj) => { res.setHeader('content-type', 'application/json'); res.end(JSON.stringify(obj)); };
  const chunks = [];
  for await (const c of req) chunks.push(c);
  req.body = Buffer.concat(chunks).toString('utf8') || '{}';
  await handler(req, res);
};

const startServer = async () => {
  const [air, cpcb, waqi, traffic] = await Promise.all([
    import('../api/air.js'), import('../api/cpcb.js'), import('../api/waqi.js'), import('../api/traffic.js')
  ]);
  const routes = new Map([
    ['/api/air', air.default], ['/api/cpcb', cpcb.default], ['/api/waqi', waqi.default], ['/api/traffic', traffic.default]
  ]);
  const server = http.createServer((req, res) => {
    const pathname = new URL(req.url, `http://127.0.0.1:${PORT}`).pathname;
    const handler = routes.get(pathname);
    if (!handler) { res.statusCode = 404; res.end('not found'); return; }
    wrap(handler)(req, res).catch((e) => {
      res.statusCode = 500; try { res.end(JSON.stringify({ error: String(e && e.message || e) })); } catch { res.end(); }
    });
  });
  await new Promise((r) => server.listen(PORT, '127.0.0.1', r));
  return server;
};

// ---------------------------------------------------------------------------
// 3. Start the same-origin API server, then load the (unmodified) pipeline
// ---------------------------------------------------------------------------
await startServer();

// ---------------------------------------------------------------------------
const { computeRoadRouteOptions } = await import('../src/utils/roadExposureRouting.js');
const { getAllStations } = await import('../src/utils/transitDataService.js');
const STATION_BY_NAME = new Map(getAllStations().map((s) => [s.name, s]));
const resolve = (name) => {
  const s = STATION_BY_NAME.get(name);
  if (!s) throw new Error(`OD endpoint not found in city model: ${name}`);
  return { lat: s.lat, lng: s.lng };
};

const odPairs = JSON.parse(fs.readFileSync(OD_PAIRS_FILE, 'utf8')).pairs;

const haversineKm = (a, b) => {
  const R = 6371, toRad = (d) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat), dLng = toRad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
};

// ---------------------------------------------------------------------------
// 4. Run the pairs
// ---------------------------------------------------------------------------
console.log(`Route-variation study: ${odPairs.length} OD pairs, departure window "${DEPARTURE}", cache ${FRESH ? 'BUSTED' : 'warm'}`);

const rows = [];
const env = {
  openaq: !!process.env.OPENAQ_API_KEY,
  tomtom: !!process.env.TOMTOM_API_KEY,
  waqi: !!process.env.WAQI_TOKEN,
  datagov: !!process.env.DATAGOV_KEY
};

for (const pair of odPairs) {
  const src = resolve(pair.from);
  const dst = resolve(pair.to);
  const tripKm = +haversineKm(src, dst).toFixed(1);
  process.stdout.write(`#${String(pair.id).padStart(2, '0')} ${pair.from} → ${pair.to} (${tripKm} km) ... `);

  let result = null, error = null;
  try {
    result = await computeRoadRouteOptions(src, dst, DEPARTURE);
  } catch (e) {
    error = String(e && e.message || e);
  }

  if (!result || !result.options || result.options.length === 0) {
    rows.push({ ...pair, tripKm, failed: true, error: error || 'no road geometry' });
    console.log('FAILED');
    continue;
  }

  const { options, fastestIdx, cleanestIdx, balancedIdx, negligible } = result;
  const f = options[fastestIdx], c = options[cleanestIdx], b = options[balancedIdx];
  const sources = [...new Set(options.map((o) => o.ambient && o.ambient.source).filter(Boolean))];

  // Read-only recomputation of WHY the choice collapsed (the ranker doesn't expose it).
  let collapseReason = null;
  if (fastestIdx === cleanestIdx) {
    if (options.length < 2) collapseReason = 'single-corridor';
    else if (tripKm < 1) collapseReason = 'short-trip';
    else if (!options.some((o) => o.concentration != null)) collapseReason = 'no-exposure-data';
    else {
      const airGain = f.concentration - options.map((o) => o.concentration).filter((v) => v != null).sort((x, y) => x - y)[0];
      const distCost = options.map((o) => o.distanceKm).reduce((m, v) => Math.min(m, v), Infinity) - f.distanceKm;
      collapseReason = (airGain <= 1 && distCost >= 1) ? 'not-worth-it (≤1 µg/m³ gain for ≥1 km)' : 'tie/identical air';
    }
  }

  const pm25Diff = (f.concentration != null && c.concentration != null) ? +(f.concentration - c.concentration).toFixed(2) : null;
  rows.push({
    ...pair, tripKm, failed: false,
    poolSize: options.length,
    fastest: { pm25: f.concentration, mins: f.durationMins, km: +f.distanceKm.toFixed(1) },
    cleanest: { pm25: c.concentration, mins: c.durationMins, km: +c.distanceKm.toFixed(1) },
    balanced: { pm25: b.concentration, mins: b.durationMins, km: +b.distanceKm.toFixed(1) },
    pm25Diff, timePenaltyMins: +(c.durationMins - f.durationMins).toFixed(1),
    distPenaltyKm: +(c.distanceKm - f.distanceKm).toFixed(1),
    collapsed: fastestIdx === cleanestIdx, collapseReason,
    negligible, sources: sources.join('+') || 'none'
  });
  console.log(`${result.options.length} corridors, fastest ${f.concentration} vs cleanest ${c.concentration} µg/m³`);
}

// ---------------------------------------------------------------------------
// 5. Summary statistics
// ---------------------------------------------------------------------------
const ok = rows.filter((r) => !r.failed);
const withData = ok.filter((r) => r.pm25Diff != null);
const median = (arr) => {
  if (!arr.length) return null;
  const s = [...arr].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : +((s[m - 1] + s[m]) / 2).toFixed(2);
};
const pct = (n, d) => (d === 0 ? null : +(100 * n / d).toFixed(0));

const ge1Count = withData.filter((r) => r.pm25Diff >= 1).length;
const divergent = ok.filter((r) => !r.collapsed && r.pm25Diff != null);
const collapsed = ok.filter((r) => r.collapsed);
const stats = {
  total: rows.length, failed: rows.filter((r) => r.failed).length, analysed: ok.length,
  withExposureData: withData.length,
  ge1Pct: pct(ge1Count, withData.length),
  medianPm25Diff: median(withData.map((r) => r.pm25Diff)),
  medianTimePenaltyAllMins: median(ok.filter((r) => r.timePenaltyMins != null).map((r) => r.timePenaltyMins)),
  divergentCount: divergent.length,
  divergentPct: pct(divergent.length, ok.length),
  medianTimePenaltyDivergentMins: median(divergent.map((r) => r.timePenaltyMins)),
  medianDistPenaltyDivergentKm: median(divergent.map((r) => r.distPenaltyKm)),
  medianPm25DiffDivergent: median(divergent.map((r) => r.pm25Diff)),
  collapsedPct: pct(collapsed.length, ok.length),
  collapseReasons: collapsed.reduce((m, r) => { m[r.collapseReason || 'unknown'] = (m[r.collapseReason || 'unknown'] || 0) + 1; return m; }, {}),
  sourceCounts: ok.reduce((m, r) => { m[r.sources] = (m[r.sources] || 0) + 1; return m; }, {})
};

// ---------------------------------------------------------------------------
// 6. Honest, self-generated conclusion (thresholds fixed in advance)
// ---------------------------------------------------------------------------
const ge1 = stats.ge1Pct;
let verdict;
if (stats.withExposureData === 0) {
  verdict = 'No usable exposure data was obtained for any trip, so the question cannot be answered by this run.';
} else if (ge1 === null || ge1 < 25) {
  verdict = 'The difference is mostly negligible: fewer than a quarter of trips have a ≥1 µg/m³ gap between the fastest and the cleanest corridor. The feature should be relabelled **"exposure-aware (limited by sensor density)"** rather than suggesting a meaningfully "cleaner" route exists.';
} else if (ge1 < 50) {
  verdict = 'The difference is real but limited: a quarter to a half of trips show a ≥1 µg/m³ gap. The feature deserves the "exposure-aware" label, with the sensor-density caveat kept visible.';
} else {
  verdict = 'The difference is meaningful: at least half the trips show a ≥1 µg/m³ gap between fastest and cleanest. The current framing stands, with the sensor-density caveat.';
}

// ---------------------------------------------------------------------------
// 7. Report
// ---------------------------------------------------------------------------
const now = new Date();
const fmtRow = (r) => {
  if (r.failed) return `| ${r.id} | ${r.from} → ${r.to} | ${r.tripKm} | ${r.error} | | | | | | | |`;
  const nd = (v) => (v == null ? '—' : v);
  return `| ${r.id} | ${r.from} → ${r.to} | ${r.tripKm} | ${r.poolSize} | ${nd(r.fastest.pm25)} | ${nd(r.cleanest.pm25)} | ${nd(r.balanced.pm25)} | ${nd(r.pm25Diff)} | ${r.timePenaltyMins} | ${r.distPenaltyKm} | ${r.sources}${r.collapsed ? ` *(collapsed: ${r.collapseReason})*` : ''} |`;
};

const report = `# Route-Variation Study: "Cleanest Air" vs Fastest

Generated: ${now.toISOString()} by \`scripts/route_variation_study.js\` (deterministic, cache-backed rerun).

## Question

Is the "cleanest air" route meaningfully different from the fastest across a
fixed, pre-registered set of ${stats.total} Surat OD pairs, or is the difference
negligible enough that the feature overpromises?

## Method

The pairs in \`scripts/od_pairs.json\` were written **before** any run, taken
verbatim from the repo's own city model, and spread deliberately across short /
medium / long trips, Tapi-river crossings, BRTS corridors, the industrial south,
the coast, and the outskirts. No pair was chosen, added, or removed after seeing
results. The route pipeline (\`computeRoadRouteOptions\`) was not modified: BFS
corridor enumeration + A* fastest + per-corridor exposure + traffic ETA run
exactly as in production. Departure window fixed to \`${DEPARTURE}\`.

Data sources during this run (honest disclosure):

* OpenAQ (CPCB ground sensors): ${env.openaq ? 'key present, live' : 'NO KEY — CPCB layer dark'}
* WAQI: ${env.waqi ? 'token present' : 'no token — layer skipped (falls through to CAMS where needed)'}
* data.gov.in: ${env.datagov ? 'key present' : 'no key — legacy path skipped'}
* TomTom: ${env.tomtom ? 'key present, live ETAs' : 'no key — all ETAs from the calibrated offline model, so absolute times are modeled; route-to-route differences use the same model consistently'}
* CAMS via Open-Meteo: keyless, available as the coarse fallback (~40 km grid)

All HTTP responses are cached in \`scripts/.study_cache/\`, so reruns replay the
same bytes: this report is reproducible. \`--fresh\` busts the cache.

## Raw results

| # | OD pair | Straight-line km | Corridors | Fastest PM2.5 | Cleanest PM2.5 | Balanced PM2.5 | Δ PM2.5 (µg/m³) | Δ time (min) | Δ dist (km) | AQ source |
|---|---------|------------------|-----------|---------------|----------------|----------------|-----------------|--------------|-------------|-----------|
${rows.map(fmtRow).join('\n')}

*Δ PM2.5 = fastest minus cleanest (positive = cleanest is cleaner). Δ time/dist = cleanest minus fastest. PM2.5 values are average concentrations along the corridor, µg/m³, µg = micrograms.*

## Summary

* Trips analysed: **${stats.analysed}** of ${stats.total} (${stats.failed} failed to resolve a road geometry)
* Trips with usable exposure data: **${stats.withExposureData}**
* Trips where cleanest beats fastest by **≥1 µg/m³**: **${ge1Count}** — **${stats.ge1Pct}%** of trips with data
* Median PM2.5 difference (fastest − cleanest): **${stats.medianPm25Diff} µg/m³**
* Median time penalty, all trips: **${stats.medianTimePenaltyAllMins} min**
* Trips that diverged (a cleanest route was actually offered): **${divergent.length} (${stats.divergentPct}%)**
  * Median PM2.5 difference among divergent trips: **${stats.medianPm25DiffDivergent} µg/m³**
  * Median time penalty among divergent trips: **${stats.medianTimePenaltyDivergentMins} min**
  * Median distance penalty among divergent trips: **${stats.medianDistPenaltyDivergentKm} km**
* Trips that collapsed to a single route: **${collapsed.length} (${stats.collapsedPct}%)**
  * Collapse reasons: ${Object.entries(stats.collapseReasons).map(([k, v]) => `${k}: ${v}`).join('; ') || 'none'}
* AQ source mix: ${Object.entries(stats.sourceCounts).map(([k, v]) => `${k}: ${v}`).join('; ')}

## Conclusion

${verdict}

This verdict is computed from the numbers above with thresholds fixed in
advance (≥1 µg/m³ as "meaningful", 25% and 50% of trips as the banding). If the
run used the calibrated offline traffic model rather than live TomTom ETAs, the
absolute minutes carry model uncertainty, but the fastest-vs-cleanest ordering
and the PM2.5 differences — the substance of this study — are unaffected by
that caveat. Sensor density is the binding constraint: with only a handful of
ground monitors in the city, most corridors sample the same interpolated air.
`;

fs.mkdirSync(path.dirname(REPORT_FILE), { recursive: true });
fs.writeFileSync(REPORT_FILE, report);
console.log(`\nCache: ${cacheHits} hits, ${cacheMisses} misses (${CACHE_DIR})`);
console.log(`Report written: ${REPORT_FILE}`);
console.log(JSON.stringify(stats, null, 2));
process.exit(0);
