/**
 * Geocoding and Geolocation Service
 * 
 * Manages place queries, coordinate conversion, reverse geocoding,
 * and browser hardware location requests.
 * 
 * Bounding Bias:
 * - Surat, Gujarat Bounding Box: [21.08, 72.72, 21.28, 72.92]
 *   (Min Lat, Min Lng, Max Lat, Max Lng)
 * - Restricts and biases results to Surat to ensure highly localized queries.
 */

// Bounding box for Surat city to bias Nominatim search
const SURAT_BOUNDS = {
  minLat: 21.08,
  minLng: 72.72,
  maxLat: 21.28,
  maxLng: 72.92
};

// Nominatim viewbox format: left,top,right,bottom -> minLng,maxLat,maxLng,minLat
const SURAT_VIEWBOX = `${SURAT_BOUNDS.minLng},${SURAT_BOUNDS.maxLat},${SURAT_BOUNDS.maxLng},${SURAT_BOUNDS.minLat}`;

const NOMINATIM_HEADERS = {
  'Accept': 'application/json',
  // Standard user-agent policy for Nominatim usage
  'User-Agent': 'TransitOptima-SuratSmartCityLabPrototype/1.0'
};

/**
 * Returns true if a coordinate sits inside (or very near) the Surat bounding box.
 * Used to keep locally-relevant hits even when the user's spelling pulls in
 * far-away matches from elsewhere in India.
 */
const isNearSurat = (lat, lng) => {
  const pad = 0.05; // ~5km of slack so edge suburbs survive, other cities don't
  return (
    lat >= SURAT_BOUNDS.minLat - pad &&
    lat <= SURAT_BOUNDS.maxLat + pad &&
    lng >= SURAT_BOUNDS.minLng - pad &&
    lng <= SURAT_BOUNDS.maxLng + pad
  );
};

/**
 * Builds a clean, human-readable label for a Nominatim result, preferring the
 * object's own name (e.g. "Brahmand Residency") and falling back to address parts.
 */
const buildDisplayName = (item) => {
  const addr = item.address || {};

  // The matched object's real OSM name is the most reliable label for a named
  // residency / shop / outlet / road, so prefer it when present.
  const ownName =
    (item.namedetails && (item.namedetails.name || item.namedetails['name:en'])) || null;

  // Any tag that identifies the specific point (covers commercial AND residential).
  const landmark =
    ownName ||
    addr.amenity || addr.shop || addr.building || addr.tourism || addr.historic ||
    addr.office || addr.leisure || addr.club || addr.craft || addr.healthcare ||
    addr.industrial || addr.railway || addr.aeroway || addr.house_name;

  const suburb =
    addr.suburb || addr.neighbourhood || addr.residential ||
    addr.quarter || addr.city_district || addr.hamlet || addr.village;

  const road = addr.road || addr.pedestrian || addr.footway;

  if (landmark && (suburb || road)) return `${landmark}, ${suburb || road}`;
  if (landmark) return landmark;
  if (road && suburb) return `${road}, ${suburb}`;
  if (road) return road;
  if (suburb) return suburb;

  // Last resort: strip trailing country/state noise from the full name.
  return item.display_name.split(', India')[0].split(', Gujarat')[0];
};

/**
 * Fires a single Nominatim request and returns the raw JSON array (or [] on failure).
 */
const fetchNominatim = async (q, { bounded = 0 } = {}) => {
  const url =
    `https://nominatim.openstreetmap.org/search?format=jsonv2` +
    `&q=${encodeURIComponent(q)}` +
    `&viewbox=${SURAT_VIEWBOX}&bounded=${bounded}` +
    `&addressdetails=1&namedetails=1&limit=15&countrycodes=in&dedupe=1`;

  try {
    const response = await fetch(url, { headers: NOMINATIM_HEADERS });
    if (!response.ok) return [];
    return await response.json();
  } catch (err) {
    console.warn('Nominatim request failed:', q, err);
    return [];
  }
};

/**
 * Searches for ANY place in Surat — roads, residential societies, shops,
 * small outlets, landmarks — using OSM Nominatim with a multi-strategy approach.
 *
 * Strategy:
 *  1. Search the raw query (best for exact named buildings/shops like "Brahmand Residency").
 *  2. Search the query biased with ", Surat, Gujarat" (best for ambiguous common names).
 * Results are merged, de-duplicated, biased toward Surat, and ranked by relevance.
 *
 * @param {string} query - The search string (e.g. "Brahmand Residency", "Ring Road", "Amul parlour")
 * @param {Object} [options]
 * @param {boolean} [options.suratOnly=false] - When true, drops any result that
 *        falls outside Surat entirely (used for trip source/destination, since the
 *        transport network only exists within the city).
 * @returns {Promise<Array>} List of matched results { displayName, fullName, lat, lng, type, category }
 */
export const searchPlaces = async (query, { suratOnly = false } = {}) => {
  if (!query || query.trim().length < 2) return [];

  const raw = query.trim();
  const cityBiased = raw.toLowerCase().includes('surat') ? null : `${raw}, Surat, Gujarat`;

  try {
    // Run the search variants in parallel so the user sees results fast.
    const requests = [fetchNominatim(raw)];
    if (cityBiased) requests.push(fetchNominatim(cityBiased));

    const responses = await Promise.all(requests);
    const combined = responses.flat();

    if (combined.length === 0) return [];

    // De-duplicate by OSM identity (falls back to rounded coordinates).
    const seen = new Map();
    for (const item of combined) {
      const key = item.osm_type && item.osm_id
        ? `${item.osm_type}/${item.osm_id}`
        : `${parseFloat(item.lat).toFixed(5)},${parseFloat(item.lon).toFixed(5)}`;
      if (!seen.has(key)) seen.set(key, item);
    }

    let results = Array.from(seen.values()).map((item) => ({
      displayName: buildDisplayName(item),
      fullName: item.display_name,
      lat: parseFloat(item.lat),
      lng: parseFloat(item.lon),
      type: item.type,
      category: item.class || item.category,
      importance: typeof item.importance === 'number' ? item.importance : 0,
      nearSurat: isNearSurat(parseFloat(item.lat), parseFloat(item.lon))
    }));

    // For source/destination, hard-drop anything outside Surat — the network
    // can't route to/from another city, so those options must not appear.
    if (suratOnly) {
      results = results.filter((r) => r.nearSurat);
    }

    // Rank: Surat-local hits first, then by Nominatim importance score.
    results.sort((a, b) => {
      if (a.nearSurat !== b.nearSurat) return a.nearSurat ? -1 : 1;
      return b.importance - a.importance;
    });

    // Strip helper fields before returning to the UI.
    return results.slice(0, 8).map(({ importance, nearSurat, ...rest }) => rest);
  } catch (err) {
    console.error('Nominatim Search Geocoding failed:', err);
    throw new Error('Failed to search locations. Check internet connection.');
  }
};

/**
 * Reverse geocodes coordinates to a clean readable neighborhood address.
 * 
 * @param {number} lat - Latitude
 * @param {number} lng - Longitude
 * @returns {Promise<string>} Readable neighborhood name
 */
export const reverseGeocode = async (lat, lng) => {
  if (!lat || !lng) return "";

  const url = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=18&addressdetails=1`;

  try {
    const response = await fetch(url, {
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'TransitOptima-SuratSmartCityLabPrototype/1.0'
      }
    });

    if (!response.ok) throw new Error(`Nominatim reverse API returned status: ${response.status}`);

    const data = await response.json();
    
    if (data && data.address) {
      const addr = data.address;
      const landmark = addr.amenity || addr.building || addr.tourism || addr.historic || addr.shop;
      const road = addr.road;
      const suburb = addr.suburb || addr.neighbourhood || addr.residential || addr.city_district;
      const city = addr.city || addr.town || addr.village;

      if (landmark && suburb) return `${landmark}, ${suburb}`;
      if (road && suburb) return `${road}, ${suburb}`;
      if (suburb) return `${suburb}, ${city || 'Surat'}`;
      if (road) return `${road}, ${city || 'Surat'}`;
      return `${city || 'Surat'}`;
    }

    return `${lat.toFixed(4)}, ${lng.toFixed(4)}`;
  } catch (err) {
    console.warn("Nominatim Reverse Geocoding failed, falling back to coordinates text.", err);
    return `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
  }
};

/**
 * Promisified Browser Geolocation retrieval.
 * 
 * @returns {Promise<Object>} User's resolved { lat, lng }
 */
export const getUserCurrentLocation = () => {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error("Your browser does not support Geolocation APIs."));
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        resolve({
          lat: position.coords.latitude,
          lng: position.coords.longitude
        });
      },
      (error) => {
        switch (error.code) {
          case error.PERMISSION_DENIED:
            reject(new Error("Location permission denied. Please enable location access in settings."));
            break;
          case error.POSITION_UNAVAILABLE:
            reject(new Error("Location information is unavailable. Ensure your GPS or network is active."));
            break;
          case error.TIMEOUT:
            reject(new Error("Location request timed out. Please try again."));
            break;
          default:
            reject(new Error("An unknown error occurred while retrieving location."));
        }
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 0
      }
    );
  });
};
