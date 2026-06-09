/**
 * OSRM Road-Geometry Service
 *
 * Snaps a list of waypoints to the actual road network so paths drawn on the
 * map follow streets turn-by-turn instead of cutting straight across the city.
 *
 * Used for:
 *  - BRTS ride legs   -> routed through every station so the corridor hugs the road
 *  - Walking legs      -> routed point-to-point so the grey path is actually walkable
 *
 * The public OSRM demo server only loads the driving network, so every profile
 * resolves to the same road geometry — which is exactly what we want here
 * (both buses and pedestrians follow the same streets in Surat).
 */

// Cache resolved geometries so panning / re-renders never re-hit the network.
const _roadPathCache = new Map();

// Cache alternative-route sets per source→destination pair.
const _altRouteCache = new Map();

// Cache single via-routes (used by the BFS generator) per waypoint sequence.
const _viaRouteCache = new Map();

// OSRM URLs have a practical length limit — keep waypoint count sane.
const MAX_WAYPOINTS = 25;

/**
 * Evenly down-samples a waypoint list to at most `max` points, always keeping
 * the first and last so the path still starts and ends in the right place.
 */
const sampleWaypoints = (positions, max) => {
  if (positions.length <= max) return positions;
  const step = (positions.length - 1) / (max - 1);
  const out = [];
  for (let i = 0; i < max; i++) out.push(positions[Math.round(i * step)]);
  return out;
};

/**
 * Fetches road-following geometry for a set of waypoints.
 *
 * @param {Array<[number, number]>} positions - Leaflet-order [lat, lng] pairs (>= 2).
 * @returns {Promise<Array<[number, number]>|null>} Road geometry as [lat, lng]
 *          pairs, or null if routing fails (caller should fall back to the
 *          straight `positions`).
 */
export const fetchRoadPath = async (positions) => {
  if (!Array.isArray(positions) || positions.length < 2) return null;

  const waypoints = sampleWaypoints(positions, MAX_WAYPOINTS);

  // Build a stable cache key from rounded coordinates.
  const key = waypoints
    .map(([lat, lng]) => `${lat.toFixed(5)},${lng.toFixed(5)}`)
    .join(';');
  if (_roadPathCache.has(key)) return _roadPathCache.get(key);

  // OSRM expects {lng},{lat} pairs separated by semicolons.
  const coordString = waypoints.map(([lat, lng]) => `${lng},${lat}`).join(';');
  const url = `https://router.project-osrm.org/route/v1/driving/${coordString}?overview=full&geometries=geojson`;

  try {
    const response = await fetch(url);
    if (!response.ok) throw new Error(`OSRM returned status ${response.status}`);

    const data = await response.json();
    if (data.code !== 'Ok' || !data.routes || data.routes.length === 0) {
      throw new Error('OSRM returned no route');
    }

    // Convert GeoJSON [lng, lat] back to Leaflet [lat, lng].
    const path = data.routes[0].geometry.coordinates.map(([lng, lat]) => [lat, lng]);
    _roadPathCache.set(key, path);
    return path;
  } catch (err) {
    console.warn('OSRM road-path lookup failed, using straight line:', err.message);
    _roadPathCache.set(key, null); // cache the failure so we don't retry every render
    return null;
  }
};

/**
 * Fetches several distinct road routes between two points (OSRM `alternatives`).
 *
 * Unlike fetchRoadPath (which snaps a fixed set of waypoints to one geometry),
 * this asks OSRM for the fastest route PLUS a few genuinely different corridors
 * between the same source and destination — the raw material for picking a
 * cleaner-air or balanced path rather than only the fastest one.
 *
 * @param {{lat:number,lng:number}} source
 * @param {{lat:number,lng:number}} destination
 * @returns {Promise<Array<{coordinates:Array<[number,number]>,distanceKm:number,durationMins:number}>|null>}
 *          One entry per distinct route ([lat,lng] geometry + metrics), or null
 *          if routing fails (caller falls back to a straight line).
 */
export const fetchRoadAlternatives = async (source, destination) => {
  if (!source || !destination) return null;

  const key = `${source.lat.toFixed(5)},${source.lng.toFixed(5)};${destination.lat.toFixed(5)},${destination.lng.toFixed(5)}`;
  if (_altRouteCache.has(key)) return _altRouteCache.get(key);

  // OSRM expects {lng},{lat}. alternatives=3 asks for up to 3 extra routes; the
  // public server returns however many genuinely distinct ones it finds (often 1–3).
  const coordString = `${source.lng},${source.lat};${destination.lng},${destination.lat}`;
  const url = `https://router.project-osrm.org/route/v1/driving/${coordString}?alternatives=3&overview=full&geometries=geojson`;

  try {
    const response = await fetch(url);
    if (!response.ok) throw new Error(`OSRM returned status ${response.status}`);

    const data = await response.json();
    if (data.code !== 'Ok' || !data.routes || data.routes.length === 0) {
      throw new Error('OSRM returned no route');
    }

    const routes = data.routes.map((route) => ({
      coordinates: route.geometry.coordinates.map(([lng, lat]) => [lat, lng]),
      distanceKm: +(route.distance / 1000).toFixed(2),
      durationMins: Math.round(route.duration / 60)
    }));

    _altRouteCache.set(key, routes);
    return routes;
  } catch (err) {
    console.warn('OSRM alternatives lookup failed:', err.message);
    _altRouteCache.set(key, null); // cache the failure so we don't retry every render
    return null;
  }
};

/**
 * Routes through an ordered list of waypoints and returns the geometry WITH its
 * metrics. Unlike fetchRoadPath (geometry only), this keeps distance and
 * free-flow duration — what the BFS generator needs to score each corridor it
 * forces through different via-points.
 *
 * @param {Array<[number, number]>} waypoints - [lat,lng] pairs, >= 2 (source … dest).
 * @returns {Promise<{coordinates:Array<[number,number]>,distanceKm:number,durationMins:number}|null>}
 *          The road route, or null if routing fails.
 */
export const fetchRoadRoute = async (waypoints) => {
  if (!Array.isArray(waypoints) || waypoints.length < 2) return null;

  const pts = sampleWaypoints(waypoints, MAX_WAYPOINTS);
  const key = pts.map(([lat, lng]) => `${lat.toFixed(5)},${lng.toFixed(5)}`).join(';');
  if (_viaRouteCache.has(key)) return _viaRouteCache.get(key);

  // OSRM expects {lng},{lat} pairs separated by semicolons.
  const coordString = pts.map(([lat, lng]) => `${lng},${lat}`).join(';');
  const url = `https://router.project-osrm.org/route/v1/driving/${coordString}?overview=full&geometries=geojson`;

  try {
    const response = await fetch(url);
    if (!response.ok) throw new Error(`OSRM returned status ${response.status}`);

    const data = await response.json();
    if (data.code !== 'Ok' || !data.routes || data.routes.length === 0) {
      throw new Error('OSRM returned no route');
    }

    const route = data.routes[0];
    const result = {
      coordinates: route.geometry.coordinates.map(([lng, lat]) => [lat, lng]),
      distanceKm: +(route.distance / 1000).toFixed(2),
      durationMins: Math.round(route.duration / 60)
    };
    _viaRouteCache.set(key, result);
    return result;
  } catch (err) {
    console.warn('OSRM via-route lookup failed:', err.message);
    _viaRouteCache.set(key, null);
    return null;
  }
};
