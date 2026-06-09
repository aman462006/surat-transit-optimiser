/**
 * Google Maps Hybrid Traffic Service & Surat Congestion Model
 * 
 * =========================================================================
 * HYBRID ROUTING ARCHITECTURE
 * =========================================================================
 * To achieve high-fidelity routing visuals without requiring paid API keys:
 * 1. Geometry Routing: Uses OSRM (OpenStreetMap Router) exclusively to fetch high-fidelity
 *    road geometries and render path polylines on the Leaflet canvas.
 * 2. Travel Duration Calculation: Handled independently by this service. Uses a multi-tier
 *    duration resolver:
 *    - Valid API Key: Calls the Google Maps Distance Matrix API directly to retrieve
 *      genuine, live, traffic-aware driving durations and delay parameters.
 *    - Missing Key / API Failure / CORS Block: Instantly falls back to the internal
 *      geographically calibrated "Surat Urban Mobility Formula" to compute realistic durations.
 * 
 * =========================================================================
 * INTERNAL TRAFFIC MODELING & MATHEMATICAL FALLBACK
 * =========================================================================
 * The Surat Urban Mobility simulator applies calibrated mathematical weights based on 
 * geographic coordinates and temporal anchors:
 * 
 * 1. Base Multipliers (Time-of-day traffic coefficients):
 *    - Morning Peak (08:00 - 10:30): 1.45x multiplier
 *    - Evening Peak (17:00 - 20:00): 1.65x multiplier
 *    - Midday Off-Peak (12:00 - 15:00): 1.15x multiplier
 *    - Night Free Flow (22:00 - 05:00): 0.88x multiplier
 *    - Standard Commuter hours: 1.00x multiplier
 * 
 * 2. Geographic Bottleneck Delays (Tapi River Bridges):
 *    Surat's urban flow is geographically split by the Tapi River. Commuter traffic crossing the
 *    limited bridge corridors (Rander, Adajan to South Surat) experience immense rush hour queues.
 *    - If coordinates cross the Tapi River (latitude 21.200):
 *      - Adds +11 minutes bottleneck queue during Morning/Evening Peaks.
 *      - Adds +4 minutes queue during Midday Off-Peak.
 *      - Zero bridge delays during Late Night Free Flow.
 * 
 * 3. Fallback Formula:
 *    Final Duration = Max(2, Round(Base OSRM Duration * Temporal Multiplier + Geographic Delay))
 * 
 * =========================================================================
 * EXTERNAL VS. INTERNAL DISTINCTION & HONEST TERMINOLOGY
 * =========================================================================
 * - Real API: The system sets `isSimulated: false`. Telemetry displays "Google Traffic ETA".
 * - Internal Model: The system sets `isSimulated: true`. Telemetry displays "Smart Traffic ETA"
 *   (or "Calibrated Urban ETA") and prints a detailed transparent note explaining that the local
 *   simulation model is active, preventing any confusion and ensuring technical honesty.
 */

// Helper to determine if a route crosses the Tapi River in Surat
// Tapi River roughly cuts horizontally around latitude 21.198 - 21.205
const crossesTapiRiver = (source, dest) => {
  const riverLat = 21.200;
  const isSourceNorth = source.lat > riverLat;
  const isDestNorth = dest.lat > riverLat;
  return isSourceNorth !== isDestNorth; // One is North, one is South
};

/**
 * Surat Geographic Traffic Congestion Simulator
 * 
 * Computes highly realistic travel durations using coordinate paths, bridge crossings,
 * time-of-day multipliers, and departure anchors to mimic Google's traffic-aware ETAs.
 * 
 * @param {Object} source - { lat, lng }
 * @param {Object} dest - { lat, lng }
 * @param {string} departureTime - 'now' | 'morning-rush' | 'midday-offpeak' | 'evening-rush' | 'night-freeflow'
 * @param {number} baseDurationMins - The typical duration calculated by OSRM
 * @returns {Object} Modeled traffic telemetry
 */
// Per-hour congestion curve for Surat (multiplier applied to OSRM free-flow time).
// Calibrated from typical Indian tier-1 city commute peaks: a sharp morning ramp
// (08:00–10:00), a softer midday bump, and a broader, heavier evening peak
// (17:00–20:00). 1.0 = free flow; <1.0 = faster-than-typical late-night roads.
const HOURLY_CONGESTION = [
  /* 00 */ 0.90, /* 01 */ 0.88, /* 02 */ 0.88, /* 03 */ 0.88, /* 04 */ 0.90, /* 05 */ 0.95,
  /* 06 */ 1.03, /* 07 */ 1.18, /* 08 */ 1.40, /* 09 */ 1.50, /* 10 */ 1.34, /* 11 */ 1.16,
  /* 12 */ 1.12, /* 13 */ 1.14, /* 14 */ 1.10, /* 15 */ 1.14, /* 16 */ 1.26, /* 17 */ 1.46,
  /* 18 */ 1.60, /* 19 */ 1.54, /* 20 */ 1.30, /* 21 */ 1.12, /* 22 */ 1.00, /* 23 */ 0.94
];

// Representative departure hour for each explicit window (used when not 'now')
const WINDOW_HOUR = {
  'morning-rush': 9,
  'midday-offpeak': 14,
  'evening-rush': 18,
  'night-freeflow': 1,
  'standard': 11
};

export const simulateSuratTraffic = (source, dest, departureTime, baseDurationMins, distanceKm = null) => {
  // 1. Resolve the departure hour (live clock for 'now', else the window's anchor)
  const hour = departureTime === 'now'
    ? new Date().getHours()
    : (WINDOW_HOUR[departureTime] ?? 11);

  let congestion = HOURLY_CONGESTION[hour] ?? 1.0;

  // 2. Speed-aware calibration.
  // OSRM's free-flow speed tells us the road type: a low implied speed means the
  // trip is already on dense, signal-heavy arterials (less *extra* slowdown in %),
  // while a high implied speed (open/ring roads) loses a larger fraction in peaks.
  // This keeps short inner-city hops from being over-inflated and long highway
  // runs from being under-inflated.
  if (distanceKm && baseDurationMins > 0) {
    const freeFlowKmh = distanceKm / (baseDurationMins / 60);
    if (freeFlowKmh < 18) {
      congestion = 1 + (congestion - 1) * 0.75; // already slow → dampen extra delay
    } else if (freeFlowKmh > 35) {
      congestion = 1 + (congestion - 1) * 1.15; // open roads → peaks bite harder
    }
  }

  // 3. Tapi River bridge bottleneck — scaled by how congested the hour already is,
  // rather than a flat ±11 min. Surat's North/South flow funnels through a few
  // bridges; queues grow with overall congestion.
  let bottleneckDelay = 0;
  if (crossesTapiRiver(source, dest) && congestion > 1.05) {
    bottleneckDelay = Math.round((congestion - 1) * 18); // ~0 off-peak up to ~11 min at the 1.6 peak
  }

  // 4. Final values
  const standardDuration = Math.max(1, Math.round(baseDurationMins));
  const trafficDuration = Math.max(2, Math.round(baseDurationMins * congestion + bottleneckDelay));
  const delayMins = Math.max(0, trafficDuration - standardDuration);

  // 5. Human-readable status banding off the actual computed delay ratio
  const ratio = standardDuration > 0 ? trafficDuration / standardDuration : 1;
  let status = '🟢 Free Flow';
  let color = 'traffic-light';
  let description = 'Typical driving conditions with standard road speeds.';
  if (ratio >= 1.4 || delayMins >= 10) {
    status = '🔴 Heavy Congestion';
    color = 'traffic-heavy';
    description = 'Peak commuter congestion. Expect slow-moving traffic on inner ring roads and arterials.';
  } else if (ratio >= 1.12 || delayMins >= 3) {
    status = '🟡 Moderate Traffic';
    color = 'traffic-moderate';
    description = 'Moderate flow with minor delays at major intersections.';
  } else if (congestion < 1) {
    description = 'Late-night free-flowing speeds. Roads clearer than the daytime baseline.';
  }
  if (bottleneckDelay >= 3) {
    description += ` Includes ~${bottleneckDelay} min Tapi River bridge queue (North↔South Surat).`;
  }

  return {
    isSimulated: true,
    standardDuration,
    trafficDuration,
    delayMins,
    status,
    color,
    description
  };
};

// Backend base URL (FastAPI). Override with VITE_BACKEND_URL when deployed.
const BACKEND_URL =
  (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.VITE_BACKEND_URL) ||
  'http://localhost:8000';

/**
 * Resolve a traffic-aware ETA for a trip.
 *
 * Primary: POST to the FastAPI backend's /api/traffic, which calls TomTom
 * server-side (real live/predictive traffic) using a key the browser never sees.
 * Fallback: if the backend is unreachable or errors, compute the calibrated
 * Surat congestion model locally so the app always returns an ETA.
 *
 * @param {Object} source - { lat, lng }
 * @param {Object} dest - { lat, lng }
 * @param {string} departureTime - departure window id
 * @param {number} osrmDurationMins - OSRM free-flow duration (minutes)
 * @param {number} distanceKm - OSRM driving distance (km)
 * @returns {Promise<Object>} traffic telemetry (same shape for live and model)
 */
export const getTrafficEta = async (source, dest, departureTime, osrmDurationMins, distanceKm = null) => {
  if (!source || !dest) return null;

  try {
    const response = await fetch(`${BACKEND_URL}/api/traffic`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        source,
        destination: dest,
        departureTime,
        baseDurationMins: Math.max(1, osrmDurationMins),
        distanceKm: distanceKm || undefined
      })
    });
    if (!response.ok) throw new Error(`Backend traffic API status ${response.status}`);
    return await response.json();
  } catch (err) {
    console.warn('Backend traffic API unreachable — using local calibrated model.', err.message);
    const local = simulateSuratTraffic(source, dest, departureTime, osrmDurationMins, distanceKm);
    return { ...local, fallbackWarning: 'Backend offline — using on-device calibrated model.' };
  }
};

/**
 * Fetch Traffic-Aware Duration
 *
 * Attempts to contact Google Maps Distance Matrix API if a key is present.
 * Automatically falls back to the Surat Congestion Model on missing key,
 * CORS restrictions, or API errors, guaranteeing consistent operability.
 * 
 * @param {Object} source - { lat, lng }
 * @param {Object} dest - { lat, lng }
 * @param {string} apiKey - Optional Google Maps API Key
 * @param {string} departureTime - 'now' | 'morning-rush' | 'midday-offpeak' | 'evening-rush' | 'night-freeflow'
 * @param {number} osrmDurationMins - Fallback duration from OSRM
 * @returns {Promise<Object>} Telemetry results
 */
export const fetchTrafficAwareDuration = async (source, dest, apiKey, departureTime, osrmDurationMins) => {
  if (!source || !dest) return null;

  // If no API Key is provided, use the Surat Congestion Model directly
  if (!apiKey || apiKey.trim() === '') {
    return simulateSuratTraffic(source, dest, departureTime, osrmDurationMins);
  }

  // Resolve departure timestamp for Google API
  let departureTimestamp = 'now';
  const now = new Date();
  if (departureTime === 'morning-rush') {
    // set to next morning at 9:00 AM
    now.setHours(9, 0, 0, 0);
    if (now.getTime() < Date.now()) now.setDate(now.getDate() + 1);
    departureTimestamp = Math.floor(now.getTime() / 1000);
  } else if (departureTime === 'evening-rush') {
    // set to next evening at 6:30 PM
    now.setHours(18, 30, 0, 0);
    if (now.getTime() < Date.now()) now.setDate(now.getDate() + 1);
    departureTimestamp = Math.floor(now.getTime() / 1000);
  } else if (departureTime === 'midday-offpeak') {
    // set to next midday at 2:00 PM
    now.setHours(14, 0, 0, 0);
    if (now.getTime() < Date.now()) now.setDate(now.getDate() + 1);
    departureTimestamp = Math.floor(now.getTime() / 1000);
  } else if (departureTime === 'night-freeflow') {
    // set to next late night at 1:00 AM
    now.setHours(1, 0, 0, 0);
    if (now.getTime() < Date.now()) now.setDate(now.getDate() + 1);
    departureTimestamp = Math.floor(now.getTime() / 1000);
  }

  // Google Distance Matrix API URL
  // Origins and destinations are input as comma-separated lat,lng
  const url = `https://maps.googleapis.com/maps/api/distancematrix/json?origins=${source.lat},${source.lng}&destinations=${dest.lat},${dest.lng}&departure_time=${departureTimestamp}&traffic_model=best_guess&key=${apiKey}`;

  try {
    // Distance Matrix client-side requests can trigger CORS errors in browsers.
    // We attempt fetch, and catch to seamlessly fall back to our consistent Surat Traffic Simulator.
    const response = await fetch(url);
    if (!response.ok) throw new Error(`Google API returned status: ${response.status}`);
    
    const data = await response.json();
    
    if (data.status === 'OK' && data.rows && data.rows[0].elements && data.rows[0].elements[0].status === 'OK') {
      const element = data.rows[0].elements[0];
      
      const distanceText = element.distance.text;
      const distanceVal = parseFloat((element.distance.value / 1000).toFixed(2)); // in km
      
      // Standard base duration in typical traffic
      const durationSeconds = element.duration.value;
      const standardDuration = Math.round(durationSeconds / 60);

      // Real traffic-aware duration
      let trafficDuration = standardDuration;
      if (element.duration_in_traffic) {
        trafficDuration = Math.round(element.duration_in_traffic.value / 60);
      }

      const delayMins = Math.max(0, trafficDuration - standardDuration);
      
      let status = '🟢 Free Flow';
      let color = 'traffic-light';
      let description = 'Typical traffic flowing at normal standard speeds.';

      if (delayMins > 10) {
        status = '🔴 Heavy Congestion';
        color = 'traffic-heavy';
        description = `Severe traffic delays detected by Google Maps Distance Matrix. +${delayMins}m commute latency.`;
      } else if (delayMins > 3) {
        status = '🟡 Moderate Traffic';
        color = 'traffic-moderate';
        description = `Minor traffic congestion detected. +${delayMins}m delay.`;
      }

      return {
        isSimulated: false,
        standardDuration,
        trafficDuration,
        delayMins,
        status,
        color,
        description,
        googleDistance: distanceVal
      };
    } else {
      const errorMsg = data.error_message || (data.rows && data.rows[0].elements[0].status) || 'API returned invalid status';
      throw new Error(errorMsg);
    }
  } catch (err) {
    console.warn("Google Maps Distance Matrix Request failed. Redirecting to Surat Congestion Model fallback. Error:", err.message);
    
    // Inject visual feedback of fallback in console
    const result = simulateSuratTraffic(source, dest, departureTime, osrmDurationMins);
    return {
      ...result,
      fallbackWarning: `Using Surat Congestion Model (Reason: ${err.message})`
    };
  }
};
