import React, { useState, useEffect, useMemo } from 'react';
import MapView from './components/MapView';
import { generateRecommendations } from './utils/recommendationEngine';
import { getTrafficEta } from './utils/googleMapsService';
import { searchPlaces, reverseGeocode, getUserCurrentLocation } from './utils/geocodingService';
import { findNearestStation } from './utils/graphUtils';
import { fetchRouteExposure, computeModeExposure } from './utils/airQualityService';
import ExposureCard from './components/ExposureCard';

const buildWalkingDistance = (option) => {
  if (option?.brtsItinerary?.walkingDistanceKm !== undefined) {
    return `${option.brtsItinerary.walkingDistanceKm.toFixed(2)} km`;
  }
  if (option?.walkingRequiredMeters !== undefined) {
    return `${(option.walkingRequiredMeters / 1000).toFixed(2)} km`;
  }
  return '—';
};

const buildTripCost = (option) => {
  if (!option) return '—';
  if (option.id === 'private-car') {
    return `₹${Number(option.tripCost).toFixed(2)}`;
  }
  return `₹${option.tripCost}`;
};

const buildFuelUsed = (option) => {
  if (option?.fuelUsedLitres !== undefined && option.fuelUsedLitres > 0) {
    return `${option.fuelUsedLitres.toFixed(2)} L`;
  }
  return '—';
};

const ModeComparisonMetrics = ({ option }) => (
  <div className="comparison-metrics">
    <div className="metric-row"><span>ETA</span><strong>{option ? `${option.travelTime} mins` : '—'}</strong></div>
    <div className="metric-row"><span>Cost</span><strong>{buildTripCost(option)}</strong></div>
    <div className="metric-row metric-row-fuel">
      <span>Fuel used</span>
      <strong>{option?.id === 'private-car' ? buildFuelUsed(option) : '—'}</strong>
    </div>
    <div className="metric-row"><span>CO₂</span><strong>{option ? `${option.co2Emissions} kg` : '—'}</strong></div>
    <div className="metric-row"><span>Walking</span><strong>{option ? buildWalkingDistance(option) : '—'}</strong></div>
    <div className="metric-row"><span>Transfers</span><strong>{option ? (option.transfersRequired ?? 0) : '—'}</strong></div>
  </div>
);

const LongWalkDecisionModal = ({ brtsOption, autoPoolOption, privateCarOption, sourceDistance, destinationDistance, onSelect }) => {
  const FUEL_LABELS = { petrol: 'Petrol', diesel: 'Diesel', cng: 'CNG' };
  const fuelLabel = FUEL_LABELS[privateCarOption?.privateCarFuelType] || 'Petrol';
  const fuelUnit = privateCarOption?.privateCarFuelUnit || 'L';

  return (
    <div className="modal-backdrop">
      <div className="long-walk-modal long-walk-modal-three-way">
        <div className="modal-header">
          <div>
            <h3>Compare commuting modes</h3>
            <p className="modal-subtitle">
              Side-by-side on ETA, cost, fuel, CO₂, walking, and transfers. Personal vehicle uses the same road distance and traffic-aware ETA as the map.
            </p>
          </div>
          <div className="modal-badges">
            {sourceDistance >= 1 && <span className="modal-badge">Source walk: {sourceDistance.toFixed(2)} km</span>}
            {destinationDistance >= 1 && <span className="modal-badge">Destination walk: {destinationDistance.toFixed(2)} km</span>}
          </div>
        </div>

        <div className="modal-body modal-comparison-body">
          <div className="modal-choice-card comparison-card comparison-card-mode comparison-card-mode--brts">
            <div className="comparison-card-head">
              <div className="choice-icon choice-icon-brts">🚌</div>
              <div>
                <span className="comparison-mode-tag">Public transit</span>
                <h4>BRTS Electric Bus</h4>
                <p>Low-carbon scheduled bus with first/last-mile walks to stations.</p>
              </div>
            </div>
            <ModeComparisonMetrics option={brtsOption} />
            <button type="button" className="choice-btn choice-btn-brts" onClick={() => onSelect('electric-bus')}>Select BRTS</button>
          </div>

          <div className="modal-choice-card comparison-card comparison-card-mode comparison-card-mode--carpool">
            <div className="comparison-card-head">
              <div className="choice-icon choice-icon-carpool">🛺</div>
              <div>
                <span className="comparison-mode-tag">Shared ride</span>
                <h4>Auto Rickshaw Pooling</h4>
                <p>Shared metered auto with the fare split across riders for a lower per-person cost.</p>
              </div>
            </div>
            <ModeComparisonMetrics option={autoPoolOption} />
            <button type="button" className="choice-btn choice-btn-carpool" onClick={() => onSelect('auto-pool')}>Select Auto Pooling</button>
          </div>

          <div className="modal-choice-card comparison-card comparison-card-mode comparison-card-mode--personal">
            <div className="comparison-card-head">
              <div className="choice-icon choice-icon-personal">🚗</div>
              <div>
                <span className="comparison-mode-tag">Personal vehicle</span>
                <h4>Private Car</h4>
                <p>
                  Door-to-door baseline · {fuelLabel} · {privateCarOption?.privateCarMileageKmpl ?? 15} km/{fuelUnit}
                  {privateCarOption ? ` · ₹${privateCarOption.privateCarFuelPricePerLitre}/${fuelUnit}` : ''}
                </p>
              </div>
            </div>
            <ModeComparisonMetrics option={privateCarOption} />
            <button type="button" className="choice-btn choice-btn-personal" onClick={() => onSelect('private-car')}>Select Personal Vehicle</button>
          </div>
        </div>
      </div>
    </div>
  );
};

/**
 * Urban mobility comparison app: BRTS, Auto Rickshaw Pooling, and Private Car baseline
 * on the same route geometry and traffic-aware ETA.
 */
function App() {
  // 1. Core States
  const [source, setSource] = useState(null); // { lat, lng }
  const [destination, setDestination] = useState(null); // { lat, lng }
  const [selectionMode, setSelectionMode] = useState('source'); // 'source' | 'destination'
  const [selectedTransit, setSelectedTransit] = useState(null); // ID of the actively selected card

  // Geocoding and Autocomplete Search states
  const [sourceText, setSourceText] = useState('');
  const [destText, setDestText] = useState('');
  const [sourceSuggestions, setSourceSuggestions] = useState([]);
  const [destSuggestions, setDestSuggestions] = useState([]);
  const [isLoadingSourceSearch, setIsLoadingSourceSearch] = useState(false);
  const [isLoadingDestSearch, setIsLoadingDestSearch] = useState(false);
  const [isSourceFocused, setIsSourceFocused] = useState(false);
  const [isDestFocused, setIsDestFocused] = useState(false);
  const [locationError, setLocationError] = useState(null);

  // 2. Real Road Routing States (OSRM API)
  const [routeCoordinates, setRouteCoordinates] = useState([]); // Array of [lat, lng]
  const [roadDistance, setRoadDistance] = useState(0); // in kilometers
  const [roadDuration, setRoadDuration] = useState(0); // in minutes
  const [isLoadingRoute, setIsLoadingRoute] = useState(false);
  const [routeError, setRouteError] = useState(null);

  // 2c. Air-pollution exposure along the route (Open-Meteo / CAMS)
  const [exposure, setExposure] = useState(null);
  const [isLoadingExposure, setIsLoadingExposure] = useState(false);

  // ==========================================
  // 2b. Traffic & Duration Engine (Hybrid Routing)
  // ==========================================
  // In order to decouple the visual mapping layout from travel duration calculations:
  // - Geometry routing uses OSRM (OpenStreetMap Router) to retrieve and draw precise coordinates.
  // - Dynamic trip durations are processed by a multi-tier traffic calculation model:
  //
  //   1. GOOGLE MODE (Valid API Key): Streams live traffic data directly from Google Maps
  //      Distance Matrix API, adjusting durations for actual road blockages, accidents, and rush hour.
  //
  //   2. INTERNAL MODEL MODE (No API Key/CORS Fallback): Utilizes the "Surat Urban Mobility Formula",
  //      a mathematical modeling engine simulating peak commuter multipliers (morning 1.45x, evening 1.65x)
  //      and geographical Tapi River bridge bottlenecks (+11 minutes peak) in Surat.
  //
  // The system automatically flags "isSimulated" in the telemetry and switches UI terminology
  // honestly (e.g. from "Google Traffic ETA" to "Calibrated Urban ETA") to ensure architectural transparency.
  const [departureTime, setDepartureTime] = useState('now');
  const [googleTrafficData, setGoogleTrafficData] = useState(null);
  const [googleDuration, setGoogleDuration] = useState(0);
  const [isLoadingGoogle, setIsLoadingGoogle] = useState(false);
  const [googleError, setGoogleError] = useState(null);

  // Passenger fare profile (BRTS / SMC slabs)
  const [passengerProfile, setPassengerProfile] = useState('standard');

  // Private car baseline: fuel chemistry for CO₂-per-litre and default mileage
  const [privateCarFuelType, setPrivateCarFuelType] = useState('petrol');

  const privateCarAssumptions = useMemo(
    () => ({ fuelType: privateCarFuelType }),
    [privateCarFuelType]
  );

  // Long-walk popup state for BRTS access decisions
  const [longWalkChoice, setLongWalkChoice] = useState(null); // 'direct' | 'brts'
  const [isLongWalkPromptOpen, setIsLongWalkPromptOpen] = useState(false);

  const sourceNearestStation = useMemo(() => {
    return source ? findNearestStation(source.lat, source.lng) : null;
  }, [source]);

  const destinationNearestStation = useMemo(() => {
    return destination ? findNearestStation(destination.lat, destination.lng) : null;
  }, [destination]);

  const isLongStationWalk = useMemo(() => {
    if (!sourceNearestStation || !destinationNearestStation) return false;
    return sourceNearestStation.distanceKm >= 1 || destinationNearestStation.distanceKm >= 1;
  }, [sourceNearestStation, destinationNearestStation]);

  useEffect(() => {
    // Reset choice each time source or destination changes
    setLongWalkChoice(null);
    setIsLongWalkPromptOpen(false);
  }, [source, destination]);

  useEffect(() => {
    if (source && destination && isLongStationWalk && !longWalkChoice) {
      setIsLongWalkPromptOpen(true);
    }
  }, [source, destination, isLongStationWalk, longWalkChoice]);

  const handleLongWalkChoice = (choiceId) => {
    setLongWalkChoice(choiceId);
    setIsLongWalkPromptOpen(false);
    setSelectedTransit(choiceId);
  };

  // Traffic Estimation source/label state.
  // isSimulated === false means the backend returned real TomTom live-traffic data;
  // otherwise the on-device calibrated Surat model produced the ETA. Labels stay honest
  // about which source is active.
  const isLiveTraffic = useMemo(() => {
    return googleTrafficData && !googleTrafficData.isSimulated;
  }, [googleTrafficData]);

  const etaLabel = isLiveTraffic ? "Live Traffic ETA" : "Calibrated Urban ETA";

  // 5. Fallback Haversine Distance Calculation (If OSRM API fails)
  const haversineDistance = useMemo(() => {
    if (!source || !destination) return 0;
    const R = 6371; // Earth's radius in km
    const dLat = ((destination.lat - source.lat) * Math.PI) / 180;
    const dLon = ((destination.lng - source.lng) * Math.PI) / 180;
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos((source.lat * Math.PI) / 180) *
        Math.cos((destination.lat * Math.PI) / 180) *
        Math.sin(dLon / 2) *
        Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return parseFloat((R * c).toFixed(2));
  }, [source, destination]);

  // 6. OSRM API Data Fetcher Hook
  useEffect(() => {
    if (!source || !destination) {
      setRouteCoordinates([]);
      setRoadDistance(0);
      setRoadDuration(0);
      setRouteError(null);
      return;
    }

    const fetchOSRMRoute = async () => {
      setIsLoadingRoute(true);
      setRouteError(null);

      // OSRM coordinates format: {longitude},{latitude}
      const startCoord = `${source.lng},${source.lat}`;
      const endCoord = `${destination.lng},${destination.lat}`;
      const url = `https://router.project-osrm.org/route/v1/driving/${startCoord};${endCoord}?overview=full&geometries=geojson`;

      try {
        const response = await fetch(url);
        if (!response.ok) throw new Error("OSRM API response was not OK");
        
        const data = await response.json();
        
        if (data.code === 'Ok' && data.routes && data.routes.length > 0) {
          const route = data.routes[0];
          
          // Swap OSRM Lng/Lat back to Leaflet Lat/Lng pairs
          const geoJsonCoords = route.geometry.coordinates;
          const mappedCoords = geoJsonCoords.map(coord => [coord[1], coord[0]]);
          
          setRouteCoordinates(mappedCoords);

          // Extract road parameters
          const distanceInKm = parseFloat((route.legs[0].distance / 1000).toFixed(2));
          const durationInMins = Math.round(route.legs[0].duration / 60);

          setRoadDistance(distanceInKm);
          setRoadDuration(durationInMins);
        } else {
          throw new Error("No routing paths found between these points");
        }
      } catch (err) {
        console.error("OSRM Routing Error:", err);
        setRouteError("OSRM Routing API is offline. Using straight line fallback.");
        
        setRouteCoordinates([
          [source.lat, source.lng],
          [destination.lat, destination.lng]
        ]);
        setRoadDistance(haversineDistance);
        setRoadDuration(Math.round((haversineDistance / 40) * 60)); // mock duration
      } finally {
        setIsLoadingRoute(false);
      }
    };

    fetchOSRMRoute();
  }, [source, destination, haversineDistance]);

  // 6b. Traffic-Aware ETA Hook
  // Calls the backend /api/traffic (TomTom live traffic, server-side key) for every
  // source/destination pair, and transparently falls back to the on-device calibrated
  // Surat congestion model if the backend is unreachable.
  useEffect(() => {
    if (!source || !destination || roadDuration === 0) {
      setGoogleTrafficData(null);
      setGoogleDuration(0);
      setGoogleError(null);
      return;
    }
    let cancelled = false;
    setIsLoadingGoogle(true);
    (async () => {
      const data = await getTrafficEta(source, destination, departureTime, roadDuration, roadDistance);
      if (cancelled || !data) return;
      setGoogleTrafficData(data);
      setGoogleDuration(data.trafficDuration);
      setGoogleError(null);
      setIsLoadingGoogle(false);
    })();
    return () => { cancelled = true; };
  }, [source, destination, roadDuration, roadDistance, departureTime]);

  // ==========================================
  // Geocoding & Geolocation Reactive Hooks
  // ==========================================

  // A. Reverse Geocode source coordinate when placed or modified (map-click/marker drag)
  useEffect(() => {
    if (!source) {
      setSourceText('');
      return;
    }
    const resolveSourceAddress = async () => {
      try {
        const address = await reverseGeocode(source.lat, source.lng);
        setSourceText(address);
      } catch (err) {
        setSourceText(`${(source.lat ?? 0).toFixed(5)}, ${(source.lng ?? 0).toFixed(5)}`);
      }
    };
    resolveSourceAddress();
  }, [source]);

  // B. Reverse Geocode destination coordinate when placed or modified
  useEffect(() => {
    if (!destination) {
      setDestText('');
      return;
    }
    const resolveDestAddress = async () => {
      try {
        const address = await reverseGeocode(destination.lat, destination.lng);
        setDestText(address);
      } catch (err) {
        setDestText(`${(destination.lat ?? 0).toFixed(5)}, ${(destination.lng ?? 0).toFixed(5)}`);
      }
    };
    resolveDestAddress();
  }, [destination]);

  // C. Debounced place search suggestions for starting input
  useEffect(() => {
    if (!isSourceFocused || !sourceText || sourceText.trim().length < 3) {
      setSourceSuggestions([]);
      return;
    }
    const delayDebounceFn = setTimeout(async () => {
      setIsLoadingSourceSearch(true);
      try {
        const results = await searchPlaces(sourceText, { suratOnly: true });
        setSourceSuggestions(results);
      } catch (err) {
        console.error("Geocoding source lookup error:", err);
      } finally {
        setIsLoadingSourceSearch(false);
      }
    }, 450);

    return () => clearTimeout(delayDebounceFn);
  }, [sourceText, isSourceFocused]);

  // D. Debounced place search suggestions for destination input
  useEffect(() => {
    if (!isDestFocused || !destText || destText.trim().length < 3) {
      setDestSuggestions([]);
      return;
    }
    const delayDebounceFn = setTimeout(async () => {
      setIsLoadingDestSearch(true);
      try {
        const results = await searchPlaces(destText, { suratOnly: true });
        setDestSuggestions(results);
      } catch (err) {
        console.error("Geocoding destination lookup error:", err);
      } finally {
        setIsLoadingDestSearch(false);
      }
    }, 450);

    return () => clearTimeout(delayDebounceFn);
  }, [destText, isDestFocused]);

  // ==========================================
  // Suggestion & Location Event Handlers
  // ==========================================
  const handleSelectSuggestion = (place, type) => {
    const coords = { lat: place.lat, lng: place.lng };
    if (type === 'source') {
      setSource(coords);
      setSourceText(place.displayName);
      setSourceSuggestions([]);
    } else {
      setDestination(coords);
      setDestText(place.displayName);
      setDestSuggestions([]);
    }
  };

  const handleUseCurrentLocation = async (type) => {
    setLocationError(null);
    try {
      const coords = await getUserCurrentLocation();
      if (type === 'source') {
        setSource(coords);
      } else {
        setDestination(coords);
      }
    } catch (err) {
      console.warn("Geolocation access failed:", err.message);
      setLocationError(err.message);
      setTimeout(() => setLocationError(null), 5000);
    }
  };

  // 7. Dynamic Recommendations Generator Hook
  // Re-computes transit models and re-ranks modes whenever road data OR weights change
  // Uses the hybrid Google Traffic ETA (googleDuration) instead of standard OSRM base time!
  const recommendations = useMemo(() => {
    if (roadDistance === 0 || googleDuration === 0) return [];
    return generateRecommendations(
      roadDistance,
      googleDuration,
      source,
      destination,
      passengerProfile,
      privateCarAssumptions
    );
  }, [roadDistance, googleDuration, source, destination, passengerProfile, privateCarAssumptions]);

  // Extract the custom BRTS itinerary sequence for map polyline rendering
  const activeModeItinerary = useMemo(() => {
    if (selectedTransit !== 'electric-bus' || recommendations.length === 0) return null;
    const busOption = recommendations.find(r => r.id === 'electric-bus');
    return busOption ? busOption.brtsItinerary : null;
  }, [selectedTransit, recommendations]);

  // Set default selection card to top optimal mode once loaded
  useEffect(() => {
    if (recommendations.length > 0 && !selectedTransit && !isLongStationWalk) {
      setSelectedTransit(recommendations[0].id);
    }
  }, [recommendations, selectedTransit, isLongStationWalk]);

  const brtsOption = useMemo(() => {
    return recommendations.find(r => r.id === 'electric-bus') || null;
  }, [recommendations]);

  const autoPoolOption = useMemo(() => {
    return recommendations.find(r => r.id === 'auto-pool') || null;
  }, [recommendations]);

  const privateCarOption = useMemo(() => {
    return recommendations.find(r => r.id === 'private-car') || null;
  }, [recommendations]);

  const selectedMode = useMemo(() => {
    if (!selectedTransit) return null;
    return recommendations.find(r => r.id === selectedTransit) || null;
  }, [selectedTransit, recommendations]);

  // 7b. Route Pollution-Exposure Hook (ambient air quality, mode-independent)
  // Samples the road path every ~500 m and pulls live AQI/PM2.5 from CPCB → WAQI
  // → CAMS. Each mode's personal dose is derived from this via computeModeExposure.
  useEffect(() => {
    if (!routeCoordinates || routeCoordinates.length < 2) {
      setExposure(null);
      return;
    }
    let cancelled = false;
    setIsLoadingExposure(true);
    fetchRouteExposure(routeCoordinates)
      .then((data) => { if (!cancelled) setExposure(data); })
      .catch(() => { if (!cancelled) setExposure(null); })
      .finally(() => { if (!cancelled) setIsLoadingExposure(false); });
    return () => { cancelled = true; };
  }, [routeCoordinates]);

  // Per-mode personal exposure (applies each mode's microenvironment factor).
  const selectedModeExposure = useMemo(() => {
    if (!exposure?.ok || !selectedMode) return null;
    return computeModeExposure(exposure, {
      modeId: selectedMode.id,
      durationMins: selectedMode.travelTime,
      itinerary: selectedMode.brtsItinerary
    });
  }, [exposure, selectedMode]);

  // 8. Map Click Callback
  const handleSelectCoords = (coords, explicitMode = null) => {
    const targetMode = explicitMode || selectionMode;
    
    if (targetMode === 'source') {
      setSource(coords);
      if (!destination) {
        setSelectionMode('destination');
      }
    } else {
      setDestination(coords);
      if (!source) {
        setSelectionMode('source');
      }
    }
  };

  // 9. Clears values
  const clearPoint = (type) => {
    if (type === 'source') {
      setSource(null);
      setSelectionMode('source');
    } else {
      setDestination(null);
      setSelectionMode('destination');
    }
    setSelectedTransit(null);
  };

  const swapPoints = () => {
    const tempSource = source;
    const tempSourceText = sourceText;
    
    setSource(destination);
    setSourceText(destText);
    
    setDestination(tempSource);
    setDestText(tempSourceText);
  };

  return (
    <div className="app-layout">
      {/* Sidebar Dashboard */}
      <aside className="dashboard-sidebar">
        <header className="dashboard-header">
          <div className="logo-section">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="logo-icon">
              <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" />
            </svg>
            <div>
              <h2>TransitOptima</h2>
              <span className="badge">Surat · compare time, cost &amp; CO₂</span>
            </div>
          </div>
        </header>

        <main className="dashboard-content">
          {/* Node Selection controls */}
          <section className="controls-card">
            <h3>Configure Route Terminals</h3>
            <p className="card-subtitle">Set your coordinate nodes by clicking on the map</p>

            <div className="selection-toggles">
              <button
                className={`toggle-btn source ${selectionMode === 'source' ? 'active' : ''}`}
                onClick={() => setSelectionMode('source')}
              >
                <span className="dot source"></span> Set Source
              </button>
              <button
                className={`toggle-btn destination ${selectionMode === 'destination' ? 'active' : ''}`}
                onClick={() => setSelectionMode('destination')}
              >
                <span className="dot destination"></span> Set Destination
              </button>
            </div>

            <div className="coordinate-inputs">
              {/* Source search bar */}
              <div className="search-input-wrapper" style={{ position: 'relative' }}>
                <div className={`node-display-box search-box ${source ? 'filled' : ''}`}>
                  <span className="node-icon source" style={{ fontSize: '1rem' }}>🟢</span>
                  <div className="search-field-container" style={{ flex: 1, marginLeft: '8px' }}>
                    <label className="input-label" style={{ fontSize: '0.62rem', fontWeight: '700', textTransform: 'uppercase', color: 'var(--text-muted)' }}>Source Terminal</label>
                    <div className="input-row" style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '2px' }}>
                      <input
                        type="text"
                        placeholder="Search starting place..."
                        value={sourceText}
                        onChange={(e) => setSourceText(e.target.value)}
                        onFocus={() => setIsSourceFocused(true)}
                        onBlur={() => setTimeout(() => setIsSourceFocused(false), 250)}
                        className="search-address-input"
                        style={{ background: 'none', border: 'none', color: '#fff', fontSize: '0.8rem', width: '100%', outline: 'none' }}
                      />
                      <button 
                        className="gps-btn" 
                        onClick={() => handleUseCurrentLocation('source')} 
                        title="Use Current Device Location"
                        style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '0.88rem', padding: '2px', display: 'flex', alignItems: 'center' }}
                      >
                        🎯
                      </button>
                    </div>
                  </div>
                  {source && (
                    <button className="clear-node-btn" onClick={() => { clearPoint('source'); setSourceText(''); }} title="Clear starting location" style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', fontSize: '0.75rem', padding: '4px' }}>
                      ✕
                    </button>
                  )}
                </div>
                
                {/* Autocomplete Suggestions Panel */}
                {isSourceFocused && (isLoadingSourceSearch || sourceSuggestions.length > 0) && (
                  <div className="autocomplete-suggestions" style={{ position: 'absolute', top: '100%', left: 0, right: 0, background: '#1e293b', border: '1px solid var(--border-light)', borderRadius: 'var(--radius-sm)', zIndex: 10, maxHeight: '200px', overflowY: 'auto', boxShadow: 'var(--shadow-lg)', marginTop: '4px' }}>
                    {isLoadingSourceSearch ? (
                      <div className="suggestion-item loading" style={{ padding: '10px 14px', fontSize: '0.76rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span className="spinner-mini"></span> Searching places...
                      </div>
                    ) : (
                      sourceSuggestions.map((place, idx) => (
                        <div
                          key={idx}
                          className="suggestion-item"
                          onMouseDown={() => handleSelectSuggestion(place, 'source')}
                          style={{ padding: '10px 14px', cursor: 'pointer', borderBottom: '1px solid rgba(255,255,255,0.04)', display: 'flex', gap: '8px', alignItems: 'flex-start' }}
                        >
                          <span className="place-icon" style={{ fontSize: '0.8rem', marginTop: '2px' }}>📍</span>
                          <div className="place-details" style={{ display: 'flex', flexDirection: 'column' }}>
                            <span className="place-name" style={{ fontSize: '0.8rem', fontWeight: '600', color: '#fff' }}>{place.displayName}</span>
                            <span className="place-full" style={{ fontSize: '0.65rem', color: 'var(--text-muted)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '300px' }}>{place.fullName}</span>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                )}
              </div>

              <div className="swap-connector">
                <div className="vertical-line"></div>
                <button className="swap-btn" onClick={swapPoints} disabled={!source && !destination} title="Swap Terminals">
                  ⇄
                </button>
              </div>

              {/* Destination search bar */}
              <div className="search-input-wrapper" style={{ position: 'relative' }}>
                <div className={`node-display-box search-box ${destination ? 'filled' : ''}`}>
                  <span className="node-icon destination" style={{ fontSize: '1rem' }}>🔴</span>
                  <div className="search-field-container" style={{ flex: 1, marginLeft: '8px' }}>
                    <label className="input-label" style={{ fontSize: '0.62rem', fontWeight: '700', textTransform: 'uppercase', color: 'var(--text-muted)' }}>Destination Terminal</label>
                    <div className="input-row" style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '2px' }}>
                      <input
                        type="text"
                        placeholder="Search destination..."
                        value={destText}
                        onChange={(e) => setDestText(e.target.value)}
                        onFocus={() => setIsDestFocused(true)}
                        onBlur={() => setTimeout(() => setIsDestFocused(false), 250)}
                        className="search-address-input"
                        style={{ background: 'none', border: 'none', color: '#fff', fontSize: '0.8rem', width: '100%', outline: 'none' }}
                      />
                      <button 
                        className="gps-btn" 
                        onClick={() => handleUseCurrentLocation('destination')} 
                        title="Use Current Device Location"
                        style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '0.88rem', padding: '2px', display: 'flex', alignItems: 'center' }}
                      >
                        🎯
                      </button>
                    </div>
                  </div>
                  {destination && (
                    <button className="clear-node-btn" onClick={() => { clearPoint('destination'); setDestText(''); }} title="Clear ending location" style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', fontSize: '0.75rem', padding: '4px' }}>
                      ✕
                    </button>
                  )}
                </div>

                {/* Autocomplete Suggestions Panel */}
                {isDestFocused && (isLoadingDestSearch || destSuggestions.length > 0) && (
                  <div className="autocomplete-suggestions" style={{ position: 'absolute', top: '100%', left: 0, right: 0, background: '#1e293b', border: '1px solid var(--border-light)', borderRadius: 'var(--radius-sm)', zIndex: 10, maxHeight: '200px', overflowY: 'auto', boxShadow: 'var(--shadow-lg)', marginTop: '4px' }}>
                    {isLoadingDestSearch ? (
                      <div className="suggestion-item loading" style={{ padding: '10px 14px', fontSize: '0.76rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span className="spinner-mini"></span> Searching places...
                      </div>
                    ) : (
                      destSuggestions.map((place, idx) => (
                        <div
                          key={idx}
                          className="suggestion-item"
                          onMouseDown={() => handleSelectSuggestion(place, 'destination')}
                          style={{ padding: '10px 14px', cursor: 'pointer', borderBottom: '1px solid rgba(255,255,255,0.04)', display: 'flex', gap: '8px', alignItems: 'flex-start' }}
                        >
                          <span className="place-icon" style={{ fontSize: '0.8rem', marginTop: '2px' }}>📍</span>
                          <div className="place-details" style={{ display: 'flex', flexDirection: 'column' }}>
                            <span className="place-name" style={{ fontSize: '0.8rem', fontWeight: '600', color: '#fff' }}>{place.displayName}</span>
                            <span className="place-full" style={{ fontSize: '0.65rem', color: 'var(--text-muted)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '300px' }}>{place.fullName}</span>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                )}
              </div>
            </div>

            <div className="passenger-profile-selector">
              <label className="input-label">Passenger Fare Profile</label>
              <select
                value={passengerProfile}
                onChange={(e) => setPassengerProfile(e.target.value)}
                className="departure-select"
              >
                <option value="standard">🎟️ Standard single ticket</option>
                <option value="student">🎓 Student Pass SMC (50% Off)</option>
                <option value="senior">👴 Senior Citizen (30% Off)</option>
                <option value="pass_holder">💳 Monthly BRTS Transit Pass (80% Off)</option>
              </select>
            </div>
          </section>

          {/* User Optimization Sliders Preferences Card */}
          {source && destination && (
            <>
              {/* Traffic Engine Card */}
              <section className="controls-card google-config fade-in">
                <div className="section-header-row">
                  <h3>{isLiveTraffic ? "Live Traffic Engine" : "Surat Smart Traffic Engine"}</h3>
                  <span className={`upcoming-tag ${isLiveTraffic ? 'status-live' : 'status-simulated'}`}>
                    {isLiveTraffic ? 'LIVE' : 'MOBILITY MODEL'}
                  </span>
                </div>
                <p className="card-subtitle">
                  {isLiveTraffic
                    ? "Real-time, traffic-aware ETAs. Pick a departure window for predictive peak conditions."
                    : "ETAs use OSRM road time shaped by an hour-by-hour Surat congestion curve and Tapi-bridge queueing."}
                </p>

                <div className="input-group" style={{ marginTop: '4px' }}>
                  <label className="input-label">Departure Window</label>
                  <select
                    value={departureTime}
                    onChange={(e) => setDepartureTime(e.target.value)}
                    className="departure-select"
                  >
                    <option value="now">🕒 Depart Now (Live Clock)</option>
                    <option value="morning-rush">🌅 Morning Rush Peak (08:00 - 10:30)</option>
                    <option value="midday-offpeak">☀️ Midday Off-Peak (12:00 - 15:00)</option>
                    <option value="evening-rush">🌇 Evening Commute Peak (17:00 - 20:00)</option>
                    <option value="night-freeflow">🌌 Late Night Free Flow (22:00 - 05:00)</option>
                  </select>
                </div>

                {googleError && (
                  <div className="google-status-row error">
                    ⚠️ {googleError}
                  </div>
                )}

                {googleTrafficData && !isLoadingGoogle && (
                  <div className={`google-status-row traffic-indicator ${googleTrafficData.color}`}>
                    <div className="indicator-header">
                      <span className="traffic-status-badge">
                        {isLiveTraffic ? "🌐 Live Traffic" : "🚗 Calibrated Traffic Model"}
                      </span>
                      {googleTrafficData.delayMins > 0 ? (
                        <span className="delay-badge">+{googleTrafficData.delayMins}m delay</span>
                      ) : (
                        <span className="delay-badge free">No Delays</span>
                      )}
                    </div>
                    <p className="indicator-desc">{googleTrafficData.description}</p>

                    <div className="engine-split-stats">
                      <span>OSRM Geometry: <b>{roadDistance} km</b></span>
                      <span>{etaLabel}: <b>{googleDuration} mins</b></span>
                    </div>
                    {googleTrafficData.fallbackWarning && (
                      <span className="fallback-note">{googleTrafficData.fallbackWarning}</span>
                    )}
                  </div>
                )}
              </section>

              {/* Private car baseline assumptions (affects fuel, cost, CO₂ only) */}
              <section className="controls-card fade-in">
                <h3>Private car baseline</h3>
                <p className="card-subtitle">Petrol, diesel and CNG use different default mileage and CO₂ per unit; fuel cost uses the same route distance as the map.</p>
                <div className="passenger-profile-selector">
                  <label className="input-label">Fuel type</label>
                  <select
                    value={privateCarFuelType}
                    onChange={(e) => setPrivateCarFuelType(e.target.value)}
                    className="departure-select"
                  >
                    <option value="petrol">Petrol (default ~15 km/L, 2.31 kg CO₂/L)</option>
                    <option value="diesel">Diesel (default ~18 km/L, 2.68 kg CO₂/L)</option>
                    <option value="cng">CNG (default ~28 km/kg, 2.75 kg CO₂/kg)</option>
                  </select>
                </div>
              </section>

              {/* Future Scaling Parameters Preview Card */}
            </>
          )}

          {/* OSRM Router Loading Indicator */}
          {isLoadingRoute && (
            <div className="loading-state">
              <div className="spinner"></div>
              <p>Routing actual roads via OSRM...</p>
            </div>
          )}

          {/* OSRM API Error alert notification */}
          {routeError && (
            <div className="route-error-alert fade-in">
              <span>⚠️</span> {routeError}
            </div>
          )}

          {/* Geolocation API Error alert notification */}
          {locationError && (
            <div className="route-error-alert fade-in" style={{ marginBottom: '14px' }}>
              <span>⚠️</span> {locationError}
            </div>
          )}

          {/* Real-Time Telemetry Stats Card Grid */}
          {!isLoadingRoute && source && destination && recommendations.length > 0 ? (
            <div className="optimizer-analytics fade-in">
              <div className="telemetry-grid">
                <div className="telemetry-card">
                  <span className="stat-label">Road Distance</span>
                  <span className="stat-val">{roadDistance} <span className="stat-unit">km</span></span>
                </div>
                <div className="telemetry-card eco">
                  <span className="stat-label">{etaLabel}</span>
                  <span className="stat-val">
                    {isLoadingGoogle ? (
                      <span className="spinner-mini" style={{ display: 'inline-block', verticalAlign: 'middle', marginRight: '6px' }}></span>
                    ) : (
                      `${googleDuration} `
                    )}
                    <span className="stat-unit">mins</span>
                  </span>
                </div>
              </div>

              <section className="transit-section">
                <div className="section-header-row">
                  <h3>Compare options</h3>
                  <span className="badge-pill label-standard">Time · Cost · Sustainability · Convenience</span>
                </div>
                <p className="card-subtitle">Pick a mode to update the map and details. Open the full comparison anytime.</p>

                <button
                  type="button"
                  className="choose-mode-btn"
                  onClick={() => setIsLongWalkPromptOpen(true)}
                >
                  🚍 Choose mode of transport
                </button>

                <div className="mode-comparison-strip" role="tablist" aria-label="Travel mode">
                  {recommendations.map((r) => {
                    const me = exposure?.ok
                      ? computeModeExposure(exposure, { modeId: r.id, durationMins: r.travelTime, itinerary: r.brtsItinerary })
                      : null;
                    return (
                      <button
                        key={r.id}
                        type="button"
                        role="tab"
                        aria-selected={selectedTransit === r.id}
                        className={`mode-strip-btn ${selectedTransit === r.id ? 'active' : ''}`}
                        onClick={() => setSelectedTransit(r.id)}
                      >
                        <span className="mode-strip-icon">{r.icon}</span>
                        <span className="mode-strip-label">{r.id === 'electric-bus' ? 'BRTS' : r.id === 'auto-pool' ? 'Auto Pool' : 'Private Car'}</span>
                        <span className="mode-strip-meta">{r.travelTime} min</span>
                        {me && (
                          <span className="mode-strip-exposure" title={`Inhaled PM2.5 ≈ ${me.inhaledPm25Ug} µg (×${me.factor} exposure)`}>
                            <span className="mode-exposure-dot" style={{ background: me.pm25Class.color }}></span>
                            {me.inhaledPm25Ug} µg
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>

                <div className="section-header-row" style={{ marginTop: '18px' }}>
                  <h3>Selected option</h3>
                  <span className={`badge-pill ${selectedMode ? `label-${selectedMode.labelType}` : 'label-standard'}`}>
                    {selectedMode ? selectedMode.label : 'MODE'}
                  </span>
                </div>
                <p className="card-subtitle">Door-to-door time, fare or fuel cost, emissions, and how convenient the trip feels.</p>

                {selectedMode ? (
                  <div className="transit-card active selected-mode-card">
                    <div className="transit-header">
                      <div className="title-row">
                        <span className="icon">{selectedMode.icon}</span>
                        <h4>{selectedMode.name}</h4>
                      </div>
                      <span className={`badge-pill ${selectedMode.labelType}`} style={{ marginLeft: 'auto' }}>
                        {selectedMode.label}
                      </span>
                    </div>

                    <div className="brts-card-custom-body" style={{ marginTop: '12px', display: 'grid', gap: '14px' }}>
                      <div className="brts-detail-specs" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', fontSize: '0.84rem', color: '#cbd5e1' }}>
                        <div>ETA: <strong style={{ color: '#f8fafc' }}>{selectedMode.travelTime} mins</strong></div>
                        <div>
                          {selectedMode.id === 'private-car' ? (
                            <>Est. fuel: <strong style={{ color: '#f8fafc' }}>{selectedMode.fuelUsedLitres > 0 ? `${selectedMode.fuelUsedLitres.toFixed(2)} ${selectedMode.privateCarFuelUnit || 'L'}` : '—'}</strong></>
                          ) : (
                            <>Fare: <strong style={{ color: '#f8fafc' }}>₹{selectedMode.tripCost}</strong></>
                          )}
                        </div>
                        <div>
                          {selectedMode.id === 'private-car' ? (
                            <>Fuel cost: <strong style={{ color: '#f8fafc' }}>₹{Number(selectedMode.tripCost).toFixed(2)}</strong></>
                          ) : (
                            <>CO₂: <strong style={{ color: '#f8fafc' }}>{selectedMode.co2Emissions} kg</strong></>
                          )}
                        </div>
                        <div>
                          {selectedMode.id === 'private-car' ? (
                            <>CO₂: <strong style={{ color: '#f8fafc' }}>{selectedMode.co2Emissions} kg</strong></>
                          ) : (
                            <>Walk: <strong style={{ color: '#f8fafc' }}>{selectedMode.walkingRequiredMeters ? `${(selectedMode.walkingRequiredMeters / 1000).toFixed(2)} km` : selectedMode.brtsItinerary ? `${selectedMode.brtsItinerary.walkingDistanceKm.toFixed(2)} km` : '—'}</strong></>
                          )}
                        </div>
                      </div>

                      {selectedMode.id !== 'private-car' && (
                        <div className="brts-detail-specs" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', fontSize: '0.84rem', color: '#cbd5e1' }}>
                          <div>CO₂: <strong style={{ color: '#f8fafc' }}>{selectedMode.co2Emissions} kg</strong></div>
                          <div>Transfers: <strong style={{ color: '#f8fafc' }}>{selectedMode.transfersRequired ?? 0}</strong></div>
                        </div>
                      )}

                      {selectedMode.id === 'private-car' && (
                        <div className="brts-detail-specs" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', fontSize: '0.84rem', color: '#cbd5e1' }}>
                          <div>Fuel: <strong style={{ color: '#f8fafc' }}>{selectedMode.privateCarFuelType === 'diesel' ? 'Diesel' : selectedMode.privateCarFuelType === 'cng' ? 'CNG' : 'Petrol'}</strong></div>
                          <div>Mileage assumed: <strong style={{ color: '#f8fafc' }}>{selectedMode.privateCarMileageKmpl} km/{selectedMode.privateCarFuelUnit || 'L'}</strong></div>
                          <div>Price assumed: <strong style={{ color: '#f8fafc' }}>₹{selectedMode.privateCarFuelPricePerLitre}/{selectedMode.privateCarFuelUnit || 'L'}</strong></div>
                          <div>CO₂ factor: <strong style={{ color: '#f8fafc' }}>{selectedMode.privateCarCo2KgPerLitre} kg/{selectedMode.privateCarFuelUnit || 'L'}</strong></div>
                        </div>
                      )}

                      {selectedMode.id === 'auto-pool' ? (
                        <div className="direct-route-summary" style={{ display: 'grid', gap: '10px', padding: '14px', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 'var(--radius-sm)', background: 'rgba(255,255,255,0.02)' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <span style={{ fontWeight: '700', color: '#e2e8f0' }}>Auto Rickshaw Pooling</span>
                            <span style={{ fontSize: '0.8rem', color: '#94a3b8' }}>{selectedMode.autoSingleFare ? `Metered ₹${selectedMode.autoSingleFare} ÷ ${selectedMode.autoOccupancy}` : 'Shared auto'}</span>
                          </div>
                          <p style={{ margin: 0, color: '#cbd5e1', fontSize: '0.82rem' }}>
                            Metered Surat auto fare split across pooled riders — lower per-person cost than driving alone, with minimal walking to pickup.
                          </p>
                        </div>
                      ) : selectedMode.id === 'private-car' ? (
                        <div className="direct-route-summary" style={{ display: 'grid', gap: '10px', padding: '14px', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 'var(--radius-sm)', background: 'rgba(255,255,255,0.02)' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <span style={{ fontWeight: '700', color: '#e2e8f0' }}>Private car baseline</span>
                            <span style={{ fontSize: '0.8rem', color: '#94a3b8' }}>Same road distance as map</span>
                          </div>
                          <p style={{ margin: 0, color: '#cbd5e1', fontSize: '0.82rem' }}>
                            Fuel use is distance ÷ mileage; cost is fuel used × your assumed price; CO₂ is fuel used × standard kg CO₂ per {selectedMode.privateCarFuelUnit || 'L'} for {selectedMode.privateCarFuelType === 'diesel' ? 'diesel' : selectedMode.privateCarFuelType === 'cng' ? 'CNG' : 'petrol'}.
                          </p>
                        </div>
                      ) : (
                        <div className="direct-route-summary" style={{ display: 'grid', gap: '10px', padding: '14px', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 'var(--radius-sm)', background: 'rgba(255,255,255,0.02)' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <span style={{ fontWeight: '700', color: '#e2e8f0' }}>BRTS</span>
                            <span style={{ fontSize: '0.8rem', color: '#94a3b8' }}>{selectedMode.transfersRequired === 0 ? 'Direct' : 'Transfer'}</span>
                          </div>
                          <p style={{ margin: 0, color: '#cbd5e1', fontSize: '0.82rem' }}>
                            Includes bus legs, transfer stations if any, and first/last-mile walks between addresses and stations.
                          </p>
                        </div>
                      )}
                    </div>

                    <div className="metrics-row-optima" style={{ gridTemplateColumns: 'repeat(4, 1fr)', marginTop: '14px' }}>
                      <div className="metric-col">
                        <span className="m-label">Time</span>
                        <span className="m-val">{selectedMode.travelTime} min</span>
                      </div>
                      <div className="metric-col">
                        <span className="m-label">Cost</span>
                        <span className="m-val">{selectedMode.id === 'private-car' ? `₹${Number(selectedMode.tripCost).toFixed(2)}` : `₹${selectedMode.tripCost}`}</span>
                      </div>
                      <div className="metric-col">
                        <span className="m-label">CO₂</span>
                        <span className="m-val">{selectedMode.co2Emissions} kg</span>
                      </div>
                      <div className="metric-col">
                        <span className="m-label">Convenience</span>
                        <span className="m-val">{selectedMode.convenienceSummary || '—'}</span>
                      </div>
                    </div>

                    <button type="button" className="action-btn-secondary" onClick={() => setIsLongWalkPromptOpen(true)}>
                      Open side-by-side comparison
                    </button>

                    <ExposureCard
                      exposure={exposure}
                      modeExposure={selectedModeExposure}
                      modeName={selectedMode.name}
                      isLoading={isLoadingExposure}
                    />
                  </div>
                ) : (
                  <div className="route-choice-placeholder" style={{ padding: '22px 18px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-light)', background: 'rgba(255,255,255,0.01)', textAlign: 'center' }}>
                    <p style={{ color: '#cbd5e1', marginBottom: '14px' }}>Choose BRTS, Auto Rickshaw Pooling, or Private Car using the strip above or the comparison window.</p>
                    <button type="button" className="action-btn-secondary" onClick={() => setIsLongWalkPromptOpen(true)}>
                      Open comparison
                    </button>
                  </div>
                )}
              </section>

            </div>
          ) : (
            // Only display placeholder if we are not actively requesting road coordinates
            !isLoadingRoute && (
              <div className="guide-placeholder">
                <div className="placeholder-icon">📍</div>
                <h4>Plan a trip in Surat</h4>
                <p>Set a start and end point to compare BRTS, Auto Rickshaw Pooling, and a private car baseline on the same distance and traffic-aware ETA.</p>
                <div className="tips-list">
                  <div className="tip-item">
                    <span className="tip-dot"></span> Click <b>Set Source</b>, then select a point.
                  </div>
                  <div className="tip-item">
                    <span className="tip-dot"></span> Click <b>Set Destination</b>, then select a second point.
                  </div>
                </div>
              </div>
            )
          )}
        </main>

        <footer className="sidebar-footer">
          <p>Built for Surat urban mobility comparison</p>
        </footer>
      </aside>

      {/* Main Map Area Container */}
      <main className="map-viewport-container">
        <MapView
          source={source}
          destination={destination}
          selectionMode={selectionMode}
          routeCoordinates={routeCoordinates}
          onSelectCoords={handleSelectCoords}
          selectedTransit={selectedTransit}
          brtsItinerary={activeModeItinerary}
        />

        {isLongWalkPromptOpen && (
          <LongWalkDecisionModal
            brtsOption={brtsOption}
            autoPoolOption={autoPoolOption}
            privateCarOption={privateCarOption}
            sourceDistance={sourceNearestStation?.distanceKm ?? 0}
            destinationDistance={destinationNearestStation?.distanceKm ?? 0}
            onSelect={handleLongWalkChoice}
          />
        )}
      </main>
    </div>
  );
}

export default App;
