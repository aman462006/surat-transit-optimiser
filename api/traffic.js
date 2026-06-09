/**
 * Vercel Serverless Function: /api/traffic
 *
 * Traffic-aware ETA for Surat, ported from the FastAPI backend so it deploys
 * ON Vercel alongside the frontend — no separate host or tunnel needed.
 *
 *   1. TomTom Routing API — real live/predictive traffic-aware ETA, used when
 *      TOMTOM_API_KEY is set in the Vercel project's environment variables.
 *      The key stays server-side; the browser never sees it.
 *   2. Calibrated "Surat Urban Mobility" model — offline fallback that shapes
 *      OSRM free-flow time with an hourly congestion curve + Tapi-bridge queueing.
 *
 * Response shape matches the old backend exactly, so the frontend is unchanged.
 */

// Surat is IST (UTC+5:30); Vercel runs in UTC, so derive the local hour explicitly.
const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;

// Per-hour congestion curve for Surat (multiplier on OSRM free-flow time).
const HOURLY_CONGESTION = [
  0.90, 0.88, 0.88, 0.88, 0.90, 0.95,   // 00-05
  1.03, 1.18, 1.40, 1.50, 1.34, 1.16,   // 06-11
  1.12, 1.14, 1.10, 1.14, 1.26, 1.46,   // 12-17
  1.60, 1.54, 1.30, 1.12, 1.00, 0.94    // 18-23
];

const WINDOW_HOUR = {
  'morning-rush': 9,
  'midday-offpeak': 14,
  'evening-rush': 18,
  'night-freeflow': 1,
  'standard': 11
};

const crossesTapiRiver = (source, dest) => {
  const riverLat = 21.200;
  return (source.lat > riverLat) !== (dest.lat > riverLat);
};

/** Calibrated geographic + temporal congestion model (offline fallback). */
const simulateSuratTraffic = (source, dest, departureTime, baseDurationMins, distanceKm = null) => {
  const hour = departureTime === 'now'
    ? new Date(Date.now() + IST_OFFSET_MS).getUTCHours()
    : (WINDOW_HOUR[departureTime] ?? 11);
  let congestion = (hour >= 0 && hour < 24) ? HOURLY_CONGESTION[hour] : 1.0;

  // Speed-aware calibration from OSRM's implied free-flow speed.
  if (distanceKm && baseDurationMins > 0) {
    const freeFlowKmh = distanceKm / (baseDurationMins / 60);
    if (freeFlowKmh < 18) congestion = 1 + (congestion - 1) * 0.75;       // already slow → dampen
    else if (freeFlowKmh > 35) congestion = 1 + (congestion - 1) * 1.15;  // open roads → peaks bite harder
  }

  // Tapi River bridge bottleneck, scaled by how congested the hour already is.
  let bottleneckDelay = 0;
  if (crossesTapiRiver(source, dest) && congestion > 1.05) {
    bottleneckDelay = Math.round((congestion - 1) * 18);
  }

  const standardDuration = Math.max(1, Math.round(baseDurationMins));
  const trafficDuration = Math.max(2, Math.round(baseDurationMins * congestion + bottleneckDelay));
  const delayMins = Math.max(0, trafficDuration - standardDuration);

  const ratio = standardDuration ? trafficDuration / standardDuration : 1;
  let status = '🟢 Free Flow', color = 'traffic-light';
  let description = 'Typical driving conditions with standard road speeds.';
  if (ratio >= 1.4 || delayMins >= 10) {
    status = '🔴 Heavy Congestion'; color = 'traffic-heavy';
    description = 'Peak commuter congestion. Slow-moving traffic on inner ring roads and arterials.';
  } else if (ratio >= 1.12 || delayMins >= 3) {
    status = '🟡 Moderate Traffic'; color = 'traffic-moderate';
    description = 'Moderate flow with minor delays at major intersections.';
  } else if (congestion < 1) {
    description = 'Late-night free-flowing speeds. Roads clearer than the daytime baseline.';
  }
  if (bottleneckDelay >= 3) {
    description += ` Includes ~${bottleneckDelay} min Tapi River bridge queue (North↔South Surat).`;
  }

  return {
    isSimulated: true,
    source: 'model',
    standardDuration,
    trafficDuration,
    delayMins,
    status,
    color,
    description
  };
};

/** ISO-8601 departAt for explicit windows (in IST); null for 'now' (live traffic). */
const computeDepartAt = (departureTime) => {
  if (departureTime === 'now' || !(departureTime in WINDOW_HOUR)) return null;
  const nowMs = Date.now();
  const istNow = new Date(nowMs + IST_OFFSET_MS);
  const hour = WINDOW_HOUR[departureTime];
  // Build the target IST wall-clock instant, then convert back to a true UTC instant.
  let targetMs = Date.UTC(istNow.getUTCFullYear(), istNow.getUTCMonth(), istNow.getUTCDate(), hour, 0, 0) - IST_OFFSET_MS;
  if (targetMs < nowMs) targetMs += 24 * 60 * 60 * 1000;
  return new Date(targetMs).toISOString();
};

/** Query TomTom for a real traffic-aware ETA, falling back to the model on any failure. */
const fetchTomTomTraffic = async (source, dest, departureTime, baseDurationMins, distanceKm, waypoints) => {
  const apiKey = (process.env.TOMTOM_API_KEY || '').trim();
  if (!apiKey) {
    return simulateSuratTraffic(source, dest, departureTime, baseDurationMins, distanceKm);
  }

  // "src:wp1:...:dest" — TomTom routes through the points in order, so a specific
  // corridor gets its own traffic-aware ETA instead of TomTom's single fastest path.
  const points = [source, ...(waypoints || []), dest];
  const loc = points.map((p) => `${p.lat},${p.lng}`).join(':');
  const params = new URLSearchParams({
    key: apiKey,
    traffic: 'true',
    travelMode: 'car',
    computeTravelTimeFor: 'all',
    routeType: 'fastest'
  });
  const departAt = computeDepartAt(departureTime);
  if (departAt) params.set('departAt', departAt);

  const url = `https://api.tomtom.com/routing/1/calculateRoute/${encodeURIComponent(loc)}/json?${params.toString()}`;

  try {
    const resp = await fetch(url);
    if (!resp.ok) throw new Error(`TomTom status ${resp.status}`);
    const data = await resp.json();
    const summary = data.routes[0].summary;

    const trafficSecs = summary.travelTimeInSeconds;
    const noTrafficSecs = summary.noTrafficTravelTimeInSeconds ?? trafficSecs;
    const delaySecs = summary.trafficDelayInSeconds ?? Math.max(0, trafficSecs - noTrafficSecs);

    const trafficDuration = Math.max(1, Math.round(trafficSecs / 60));
    const standardDuration = Math.max(1, Math.round(noTrafficSecs / 60));
    const delayMins = Math.max(0, Math.round(delaySecs / 60));
    const distanceVal = Math.round((summary.lengthInMeters || 0) / 1000 * 100) / 100;

    let status = '🟢 Free Flow', color = 'traffic-light';
    let description = 'Live TomTom traffic — roads flowing at normal speeds.';
    if (delayMins >= 10) {
      status = '🔴 Heavy Congestion'; color = 'traffic-heavy';
      description = `Live TomTom traffic — heavy congestion, +${delayMins} min delay on this route.`;
    } else if (delayMins >= 3) {
      status = '🟡 Moderate Traffic'; color = 'traffic-moderate';
      description = `Live TomTom traffic — moderate congestion, +${delayMins} min delay.`;
    }

    // Run the calibrated model too, so the frontend can show the MEASURED error
    // of our own engine against this live ground-truth ETA.
    const model = simulateSuratTraffic(source, dest, departureTime, baseDurationMins, distanceKm);

    return {
      isSimulated: false,
      source: 'tomtom',
      standardDuration,
      trafficDuration,
      delayMins,
      status,
      color,
      description,
      providerDistance: distanceVal,
      modelTrafficDuration: model.trafficDuration,
      modelStandardDuration: model.standardDuration
    };
  } catch (err) {
    const result = simulateSuratTraffic(source, dest, departureTime, baseDurationMins, distanceKm);
    result.fallbackWarning = `TomTom unavailable, using calibrated model (reason: ${err.message})`;
    return result;
  }
};

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  // Vercel parses JSON bodies, but accept a raw string defensively.
  let body = req.body;
  if (typeof body === 'string') {
    try { body = JSON.parse(body); } catch { body = {}; }
  }
  body = body || {};

  const { source, destination, departureTime = 'now', baseDurationMins, distanceKm = null, waypoints = null } = body;
  if (!source || !destination) {
    res.status(400).json({ error: 'source and destination are required' });
    return;
  }

  try {
    const result = await fetchTomTomTraffic(
      source, destination, departureTime,
      Math.max(1, Number(baseDurationMins) || 1),
      distanceKm != null ? Number(distanceKm) : null,
      Array.isArray(waypoints) ? waypoints : null
    );
    res.status(200).json(result);
  } catch (err) {
    res.status(200).json(simulateSuratTraffic(source, destination, departureTime, Math.max(1, Number(baseDurationMins) || 1), distanceKm));
  }
}
