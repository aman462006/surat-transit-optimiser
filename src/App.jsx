import React, { useState, useEffect, useMemo, lazy, Suspense } from 'react';
import { generateRecommendations } from './utils/recommendationEngine';
import { getTrafficEta } from './utils/googleMapsService';
import { searchPlaces, reverseGeocode, getUserCurrentLocation } from './utils/geocodingService';
import { findNearestStation } from './utils/graphUtils';
import { fetchRouteExposure, computeModeExposure } from './utils/airQualityService';
import { computeRoadRouteOptions } from './utils/roadExposureRouting';

import { useIsTablet, useIsMobile } from './hooks/useMediaQuery';
import TopNav from './components/layout/TopNav';
import MobileTabBar from './components/layout/MobileTabBar';
import JourneyPlanner from './components/planner/JourneyPlanner';
import DecisionDashboard from './components/dashboard/DecisionDashboard';
import FareProfileModal from './components/modals/FareProfileModal';
import CarFuelModal from './components/modals/CarFuelModal';
import ComparisonModal from './components/modals/ComparisonModal';
import LandingPage from './components/landing/LandingPage';
import SettingsModal from './components/modals/SettingsModal';
import Icon from './components/ui/Icon';

// Lazy-load the heavy Leaflet map so the shell paints instantly.
const MapView = lazy(() => import('./components/map/MapView'));

const ROAD_MODES = ['private-car', 'auto-pool'];
const isRoadMode = (modeId) => ROAD_MODES.includes(modeId);

/* =========================================================================
   Self-calibrating ETA model (unchanged) — learns from live TomTom, corrects
   the offline fallback. Persisted in localStorage.
   ========================================================================= */
const ETA_CAL_KEY = 'eta-model-calibration';
const ETA_CAL_ALPHA = 0.35;
const ETA_CAL_MIN = 0.6;
const ETA_CAL_MAX = 1.7;

const readEtaCalibration = () => {
  try {
    const raw = localStorage.getItem(ETA_CAL_KEY);
    if (!raw) return { factor: 1, samples: 0 };
    const p = JSON.parse(raw);
    const factor = Number(p.factor);
    return { factor: Number.isFinite(factor) ? factor : 1, samples: Number.isFinite(p.samples) ? p.samples : 0 };
  } catch { return { factor: 1, samples: 0 }; }
};

const learnEtaCalibration = (liveMins, modelMins) => {
  if (!liveMins || !modelMins || modelMins <= 0) return;
  const ratio = liveMins / modelMins;
  if (!Number.isFinite(ratio) || ratio <= 0) return;
  const prev = readEtaCalibration();
  const blended = prev.samples === 0 ? ratio : prev.factor * (1 - ETA_CAL_ALPHA) + ratio * ETA_CAL_ALPHA;
  const factor = Math.min(ETA_CAL_MAX, Math.max(ETA_CAL_MIN, blended));
  try { localStorage.setItem(ETA_CAL_KEY, JSON.stringify({ factor, samples: prev.samples + 1 })); } catch { /* noop */ }
};

function App() {
  // ---- Core ----
  const [source, setSource] = useState(null);
  const [destination, setDestination] = useState(null);
  const [selectionMode, setSelectionMode] = useState('source');
  const [selectedTransit, setSelectedTransit] = useState(null);

  // ---- Geocoding / autocomplete ----
  const [sourceText, setSourceText] = useState('');
  const [destText, setDestText] = useState('');
  const [sourceSuggestions, setSourceSuggestions] = useState([]);
  const [destSuggestions, setDestSuggestions] = useState([]);
  const [isLoadingSourceSearch, setIsLoadingSourceSearch] = useState(false);
  const [isLoadingDestSearch, setIsLoadingDestSearch] = useState(false);
  const [isSourceFocused, setIsSourceFocused] = useState(false);
  const [isDestFocused, setIsDestFocused] = useState(false);
  const [locationError, setLocationError] = useState(null);

  // ---- Routing (OSRM) ----
  const [routeCoordinates, setRouteCoordinates] = useState([]);
  const [roadDistance, setRoadDistance] = useState(0);
  const [roadDuration, setRoadDuration] = useState(0);
  const [isLoadingRoute, setIsLoadingRoute] = useState(false);
  const [routeError, setRouteError] = useState(null);

  // ---- Exposure ----
  const [exposure, setExposure] = useState(null);
  const [isLoadingExposure, setIsLoadingExposure] = useState(false);
  const [roadRouteOptions, setRoadRouteOptions] = useState(null);
  const [isLoadingRouteOptions, setIsLoadingRouteOptions] = useState(false);
  const [selectedRouteVariant, setSelectedRouteVariant] = useState('fastest');

  // ---- Traffic ETA ----
  const [departureTime, setDepartureTime] = useState('now');
  const [googleTrafficData, setGoogleTrafficData] = useState(null);
  const [googleDuration, setGoogleDuration] = useState(0);
  const [isLoadingGoogle, setIsLoadingGoogle] = useState(false);

  // ---- Fare / fuel ----
  const [passengerProfile, setPassengerProfile] = useState('standard');
  const [isFareModalOpen, setIsFareModalOpen] = useState(false);
  const [carFuelType, setCarFuelType] = useState('petrol');
  const [isCarFuelModalOpen, setIsCarFuelModalOpen] = useState(false);

  // ---- Comparison / shell ----
  const [isComparisonOpen, setIsComparisonOpen] = useState(false);
  const [hasEntered, setHasEntered] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [mobileView, setMobileView] = useState('plan');
  const [rightSheetOpen, setRightSheetOpen] = useState(false);

  const isTablet = useIsTablet();
  const isMobile = useIsMobile();

  const privateCarAssumptions = useMemo(() => ({ fuelType: carFuelType }), [carFuelType]);

  // ---- Nearest-station / long-walk awareness ----
  const sourceNearestStation = useMemo(() => (source ? findNearestStation(source.lat, source.lng) : null), [source]);
  const destinationNearestStation = useMemo(() => (destination ? findNearestStation(destination.lat, destination.lng) : null), [destination]);
  const isLongStationWalk = useMemo(() => {
    if (!sourceNearestStation || !destinationNearestStation) return false;
    return sourceNearestStation.distanceKm >= 1 || destinationNearestStation.distanceKm >= 1;
  }, [sourceNearestStation, destinationNearestStation]);

  const selectMode = (modeId) => {
    setSelectedTransit(modeId);
    if (modeId === 'electric-bus') setIsFareModalOpen(true);
    else if (modeId === 'private-car') setIsCarFuelModalOpen(true);
    if (isMobile) setMobileView('results');
  };

  // ---- Traffic labels + measured accuracy (unchanged logic) ----
  const isLiveTraffic = useMemo(() => googleTrafficData && !googleTrafficData.isSimulated, [googleTrafficData]);
  const etaLabel = isLiveTraffic ? 'Live traffic ETA' : 'Calibrated ETA';

  const accuracy = useMemo(() => {
    const d = googleTrafficData;
    const out = { eta: null, distance: null };
    if (!d) return out;
    const isLive = !d.isSimulated;

    if (isLive && typeof d.modelTrafficDuration === 'number' && d.trafficDuration > 0) {
      const live = d.trafficDuration;
      const model = d.modelTrafficDuration;
      const diff = model - live;
      const pct = (Math.abs(diff) / live) * 100;
      out.eta = {
        measured: true, diff, label: 'offline model', title: 'Offline fallback error vs live TomTom',
        signedLabel: `${diff >= 0 ? '+' : '−'}${Math.abs(diff)} min`, absLabel: `±${Math.abs(diff)} min`, pctLabel: `${pct.toFixed(0)}%`,
        severity: pct < 10 ? 'ok' : pct < 25 ? 'warn' : 'bad',
        reason: `The ETA shown is live TomTom traffic (${live} min) — that's the reference, not the error. This % is how far our OFFLINE fallback model would be: it predicts ${model} min by shaping OSRM free-flow time with an hour-by-hour Surat congestion curve and Tapi-bridge queueing instead of reading live road sensors. It only matters if TomTom is unavailable.`,
        mitigation: 'Shrinks over time — each live TomTom sample re-fits the fallback’s calibration.',
      };
    } else if (!isLive) {
      const cal = d.calibration;
      out.eta = {
        measured: false,
        reason: 'TomTom live traffic is unavailable, so the ETA shown is the calibrated model itself. There is no live value to measure its error against right now.' +
          (cal ? ` Auto-correction is active: the model ETA has been scaled by ×${cal.factor} (learned from ${cal.samples} past live comparison${cal.samples === 1 ? '' : 's'}).` : ''),
      };
    }

    if (typeof d.providerDistance === 'number' && d.providerDistance > 0 && roadDistance > 0) {
      const provider = d.providerDistance;
      const diff = roadDistance - provider;
      const pct = (Math.abs(diff) / provider) * 100;
      out.distance = {
        measured: true, diff, label: 'OSRM vs TomTom', title: 'OSRM vs TomTom routing difference',
        signedLabel: `${diff >= 0 ? '+' : '−'}${Math.abs(diff).toFixed(2)} km`, absLabel: `±${Math.abs(diff).toFixed(2)} km`, pctLabel: `${pct.toFixed(0)}%`,
        severity: pct < 5 ? 'ok' : pct < 15 ? 'warn' : 'bad',
        reason: `The map distance (${roadDistance} km) is OSRM road geometry; TomTom's router measures ${provider} km for the same trip. The difference is just the two routing engines picking slightly different roads and turns — neither is "wrong".`,
        mitigation: 'Reducible by feeding TomTom’s route distance into the fuel / cost / CO₂ calculations when available.',
      };
    } else if (!isLive) {
      out.distance = { measured: false, reason: 'No live routing provider is reachable, so OSRM’s distance cannot be cross-checked against a second router right now.' };
    }
    return out;
  }, [googleTrafficData, roadDistance]);

  // ---- Haversine fallback ----
  const haversineDistance = useMemo(() => {
    if (!source || !destination) return 0;
    const R = 6371;
    const dLat = ((destination.lat - source.lat) * Math.PI) / 180;
    const dLon = ((destination.lng - source.lng) * Math.PI) / 180;
    const a = Math.sin(dLat / 2) ** 2 + Math.cos((source.lat * Math.PI) / 180) * Math.cos((destination.lat * Math.PI) / 180) * Math.sin(dLon / 2) ** 2;
    return parseFloat((R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))).toFixed(2));
  }, [source, destination]);

  // ---- OSRM route fetch ----
  useEffect(() => {
    if (!source || !destination) {
      setRouteCoordinates([]); setRoadDistance(0); setRoadDuration(0); setRouteError(null);
      return;
    }
    const fetchOSRMRoute = async () => {
      setIsLoadingRoute(true); setRouteError(null);
      const url = `https://router.project-osrm.org/route/v1/driving/${source.lng},${source.lat};${destination.lng},${destination.lat}?overview=full&geometries=geojson`;
      try {
        const response = await fetch(url);
        if (!response.ok) throw new Error('OSRM API response was not OK');
        const data = await response.json();
        if (data.code === 'Ok' && data.routes?.length > 0) {
          const route = data.routes[0];
          setRouteCoordinates(route.geometry.coordinates.map((c) => [c[1], c[0]]));
          setRoadDistance(parseFloat((route.legs[0].distance / 1000).toFixed(2)));
          setRoadDuration(Math.round(route.legs[0].duration / 60));
        } else { throw new Error('No routing paths found between these points'); }
      } catch (err) {
        console.error('OSRM Routing Error:', err);
        setRouteError('OSRM routing is offline — using a straight-line fallback.');
        setRouteCoordinates([[source.lat, source.lng], [destination.lat, destination.lng]]);
        setRoadDistance(haversineDistance);
        setRoadDuration(Math.round((haversineDistance / 40) * 60));
      } finally { setIsLoadingRoute(false); }
    };
    fetchOSRMRoute();
  }, [source, destination, haversineDistance]);

  // ---- Exposure-aware road alternatives (car / auto) ----
  useEffect(() => {
    if (!source || !destination || !isRoadMode(selectedTransit)) { setRoadRouteOptions(null); return undefined; }
    let cancelled = false;
    setIsLoadingRouteOptions(true);
    setSelectedRouteVariant('fastest');
    computeRoadRouteOptions(source, destination)
      .then((result) => { if (!cancelled) setRoadRouteOptions(result); })
      .catch(() => { if (!cancelled) setRoadRouteOptions(null); })
      .finally(() => { if (!cancelled) setIsLoadingRouteOptions(false); });
    return () => { cancelled = true; };
  }, [source, destination, selectedTransit]);

  // ---- Traffic-aware ETA ----
  useEffect(() => {
    if (!source || !destination || roadDuration === 0) { setGoogleTrafficData(null); setGoogleDuration(0); return undefined; }
    let cancelled = false;
    setIsLoadingGoogle(true);
    (async () => {
      const data = await getTrafficEta(source, destination, departureTime, roadDuration, roadDistance);
      if (cancelled || !data) return;
      let display = data;
      if (!data.isSimulated && data.modelTrafficDuration > 0 && data.trafficDuration > 0) {
        learnEtaCalibration(data.trafficDuration, data.modelTrafficDuration);
      } else if (data.isSimulated && data.trafficDuration > 0) {
        const cal = readEtaCalibration();
        if (cal.samples > 0 && Math.abs(cal.factor - 1) > 0.01) {
          const corrected = Math.max(2, Math.round(data.trafficDuration * cal.factor));
          display = { ...data, trafficDuration: corrected, rawModelDuration: data.trafficDuration, delayMins: Math.max(0, corrected - data.standardDuration), calibration: { factor: +cal.factor.toFixed(3), samples: cal.samples } };
        }
      }
      setGoogleTrafficData(display); setGoogleDuration(display.trafficDuration); setIsLoadingGoogle(false);
    })();
    return () => { cancelled = true; };
  }, [source, destination, roadDuration, roadDistance, departureTime]);

  // ---- Reverse geocode ----
  useEffect(() => {
    if (!source) { setSourceText(''); return; }
    reverseGeocode(source.lat, source.lng)
      .then(setSourceText)
      .catch(() => setSourceText(`${(source.lat ?? 0).toFixed(5)}, ${(source.lng ?? 0).toFixed(5)}`));
  }, [source]);

  useEffect(() => {
    if (!destination) { setDestText(''); return; }
    reverseGeocode(destination.lat, destination.lng)
      .then(setDestText)
      .catch(() => setDestText(`${(destination.lat ?? 0).toFixed(5)}, ${(destination.lng ?? 0).toFixed(5)}`));
  }, [destination]);

  // ---- Debounced search ----
  useEffect(() => {
    if (!isSourceFocused || !sourceText || sourceText.trim().length < 3) { setSourceSuggestions([]); return undefined; }
    const t = setTimeout(async () => {
      setIsLoadingSourceSearch(true);
      try { setSourceSuggestions(await searchPlaces(sourceText, { suratOnly: true })); }
      catch (err) { console.error('Geocoding source lookup error:', err); }
      finally { setIsLoadingSourceSearch(false); }
    }, 450);
    return () => clearTimeout(t);
  }, [sourceText, isSourceFocused]);

  useEffect(() => {
    if (!isDestFocused || !destText || destText.trim().length < 3) { setDestSuggestions([]); return undefined; }
    const t = setTimeout(async () => {
      setIsLoadingDestSearch(true);
      try { setDestSuggestions(await searchPlaces(destText, { suratOnly: true })); }
      catch (err) { console.error('Geocoding destination lookup error:', err); }
      finally { setIsLoadingDestSearch(false); }
    }, 450);
    return () => clearTimeout(t);
  }, [destText, isDestFocused]);

  // ---- Recommendations ----
  const recommendations = useMemo(() => {
    if (roadDistance === 0 || googleDuration === 0) return [];
    return generateRecommendations(roadDistance, googleDuration, source, destination, passengerProfile, privateCarAssumptions);
  }, [roadDistance, googleDuration, source, destination, passengerProfile, privateCarAssumptions]);

  const activeModeItinerary = useMemo(() => {
    if (selectedTransit !== 'electric-bus' || recommendations.length === 0) return null;
    return recommendations.find((r) => r.id === 'electric-bus')?.brtsItinerary ?? null;
  }, [selectedTransit, recommendations]);

  useEffect(() => {
    if (recommendations.length > 0 && !selectedTransit && !isLongStationWalk) setSelectedTransit(recommendations[0].id);
  }, [recommendations, selectedTransit, isLongStationWalk]);

  const brtsOption = useMemo(() => recommendations.find((r) => r.id === 'electric-bus') || null, [recommendations]);
  const autoPoolOption = useMemo(() => recommendations.find((r) => r.id === 'auto-pool') || null, [recommendations]);
  const privateCarOption = useMemo(() => recommendations.find((r) => r.id === 'private-car') || null, [recommendations]);
  const selectedMode = useMemo(() => (selectedTransit ? recommendations.find((r) => r.id === selectedTransit) || null : null), [selectedTransit, recommendations]);

  const activeRouteCoordinates = useMemo(() => {
    if (isRoadMode(selectedTransit) && roadRouteOptions?.options?.length) {
      const idxFor = { fastest: roadRouteOptions.fastestIdx, cleanest: roadRouteOptions.cleanestIdx, balanced: roadRouteOptions.balancedIdx };
      const opt = roadRouteOptions.options[idxFor[selectedRouteVariant]];
      if (opt?.coordinates?.length > 1) return opt.coordinates;
    }
    return routeCoordinates;
  }, [selectedTransit, roadRouteOptions, selectedRouteVariant, routeCoordinates]);

  const inactiveRouteAlternatives = useMemo(() => {
    if (!isRoadMode(selectedTransit) || !roadRouteOptions?.options?.length) return [];
    return roadRouteOptions.options.filter((opt) => opt.coordinates !== activeRouteCoordinates).map((opt) => opt.coordinates);
  }, [selectedTransit, roadRouteOptions, activeRouteCoordinates]);

  // ---- Exposure fetch ----
  useEffect(() => {
    if (!activeRouteCoordinates || activeRouteCoordinates.length < 2) { setExposure(null); return undefined; }
    let cancelled = false;
    setIsLoadingExposure(true);
    fetchRouteExposure(activeRouteCoordinates)
      .then((data) => { if (!cancelled) setExposure(data); })
      .catch(() => { if (!cancelled) setExposure(null); })
      .finally(() => { if (!cancelled) setIsLoadingExposure(false); });
    return () => { cancelled = true; };
  }, [activeRouteCoordinates]);

  const selectedModeExposure = useMemo(() => {
    if (!exposure?.ok || !selectedMode) return null;
    return computeModeExposure(exposure, { modeId: selectedMode.id, durationMins: selectedMode.travelTime, itinerary: selectedMode.brtsItinerary });
  }, [exposure, selectedMode]);

  // Per-mode inhaled dose for the comparison cards + KPI grid.
  const exposureByMode = useMemo(() => {
    if (!exposure?.ok || !recommendations.length) return {};
    const map = {};
    recommendations.forEach((r) => {
      map[r.id] = computeModeExposure(exposure, { modeId: r.id, durationMins: r.travelTime, itinerary: r.brtsItinerary });
    });
    return map;
  }, [exposure, recommendations]);

  // ---- Handlers ----
  const handleSelectSuggestion = (place, type) => {
    const coords = { lat: place.lat, lng: place.lng };
    if (type === 'source') { setSource(coords); setSourceText(place.displayName); setSourceSuggestions([]); }
    else { setDestination(coords); setDestText(place.displayName); setDestSuggestions([]); }
  };

  const handleQuickPick = (place) => {
    const coords = { lat: place.lat, lng: place.lng };
    if (!source) { setSource(coords); setSourceText(place.displayName); }
    else { setDestination(coords); setDestText(place.displayName); }
  };

  const handleUseCurrentLocation = async (type) => {
    setLocationError(null);
    try {
      const coords = await getUserCurrentLocation();
      if (type === 'source') setSource(coords); else setDestination(coords);
    } catch (err) {
      setLocationError(err.message);
      setTimeout(() => setLocationError(null), 5000);
    }
  };

  const handleSelectCoords = (coords, explicitMode = null) => {
    const target = explicitMode || selectionMode;
    if (target === 'source') { setSource(coords); if (!destination) setSelectionMode('destination'); }
    else { setDestination(coords); if (!source) setSelectionMode('source'); }
  };

  const clearPoint = (type) => {
    if (type === 'source') { setSource(null); setSourceText(''); setSelectionMode('source'); }
    else { setDestination(null); setDestText(''); setSelectionMode('destination'); }
    setSelectedTransit(null);
  };

  const swapPoints = () => {
    const tS = source; const tT = sourceText;
    setSource(destination); setSourceText(destText);
    setDestination(tS); setDestText(tT);
  };

  // Nudge the mobile view to the map once both endpoints are set.
  useEffect(() => {
    if (source && destination && isMobile) setMobileView('map');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [source, destination]);

  const hasRoute = !!(source && destination);

  if (!hasEntered) return <LandingPage onProceed={() => setHasEntered(true)} />;

  const dashboard = (
    <DecisionDashboard
      recommendations={recommendations}
      hasRoute={hasRoute}
      isLoadingRoute={isLoadingRoute}
      roadDistance={roadDistance}
      googleDuration={googleDuration}
      isLoadingGoogle={isLoadingGoogle}
      etaLabel={etaLabel}
      accuracy={accuracy}
      selectedTransit={selectedTransit}
      onSelectMode={selectMode}
      selectedMode={selectedMode}
      exposureByMode={exposureByMode}
      exposure={exposure}
      selectedModeExposure={selectedModeExposure}
      isLoadingExposure={isLoadingExposure}
      passengerProfile={passengerProfile}
      onEditFare={() => setIsFareModalOpen(true)}
      onEditFuel={() => setIsCarFuelModalOpen(true)}
      roadRouteOptions={roadRouteOptions}
      selectedRouteVariant={selectedRouteVariant}
      onSelectVariant={setSelectedRouteVariant}
      isLoadingRouteOptions={isLoadingRouteOptions}
      onOpenComparison={() => setIsComparisonOpen(true)}
    />
  );

  return (
    <div className="app-shell">
      <TopNav onAbout={() => setHasEntered(false)} onSettings={() => setShowSettings(true)} />

      <div className="workspace" data-mobile-view={mobileView}>
        {/* Left — planner */}
        <aside className="workspace-col col-left">
          <div className="col-scroll">
            <JourneyPlanner
              source={source} destination={destination}
              sourceText={sourceText} destText={destText}
              isSourceFocused={isSourceFocused} isDestFocused={isDestFocused}
              isLoadingSourceSearch={isLoadingSourceSearch} isLoadingDestSearch={isLoadingDestSearch}
              sourceSuggestions={sourceSuggestions} destSuggestions={destSuggestions}
              onSourceTextChange={setSourceText} onDestTextChange={setDestText}
              onSourceFocus={() => setIsSourceFocused(true)} onSourceBlur={() => setTimeout(() => setIsSourceFocused(false), 200)}
              onDestFocus={() => setIsDestFocused(true)} onDestBlur={() => setTimeout(() => setIsDestFocused(false), 200)}
              onSelectSuggestion={handleSelectSuggestion} onUseLocation={handleUseCurrentLocation}
              onClearPoint={clearPoint} onSwap={swapPoints} onQuickPick={handleQuickPick}
              departureTime={departureTime} onDepartureChange={setDepartureTime}
              routeError={routeError} locationError={locationError} isLoadingRoute={isLoadingRoute}
            />
            {isMobile && hasRoute && (
              <div className="mobile-action-bar">
                <button type="button" className="btn btn-secondary btn-md btn-block" onClick={() => setMobileView('map')}>
                  <Icon name="map" size={16} /> View map
                </button>
                <button type="button" className="btn btn-primary btn-md btn-block" onClick={() => setMobileView('results')}>
                  <Icon name="sparkles" size={16} /> See results
                </button>
              </div>
            )}
          </div>
        </aside>

        {/* Center — map */}
        <main className="workspace-col col-center">
          <Suspense fallback={<div className="map-loading"><span className="spinner spinner-lg" /><span>Loading map…</span></div>}>
            <MapView
              source={source} destination={destination} selectionMode={selectionMode}
              routeCoordinates={activeRouteCoordinates} routeAlternatives={inactiveRouteAlternatives}
              onSelectCoords={handleSelectCoords} selectedTransit={selectedTransit}
              brtsItinerary={activeModeItinerary} exposure={exposure} isLoadingRoute={isLoadingRoute}
            />
          </Suspense>
          {isTablet && hasRoute && (
            <button type="button" className="results-fab" onClick={() => setRightSheetOpen(true)}>
              <Icon name="sparkles" size={17} /> Results
              {recommendations.length > 0 && <span className="results-fab-badge">{recommendations.length}</span>}
            </button>
          )}
        </main>

        {/* Right — dashboard (slide-over on tablet) */}
        <aside className={`workspace-col col-right${isTablet ? ' as-sheet' : ''}${isTablet && rightSheetOpen ? ' open' : ''}`}>
          {isTablet && (
            <button type="button" className="sheet-close btn btn-ghost btn-icon-only" onClick={() => setRightSheetOpen(false)} aria-label="Close results">
              <Icon name="x" size={18} />
            </button>
          )}
          <div className="col-scroll">{dashboard}</div>
        </aside>
        {isTablet && <div className={`sheet-scrim${rightSheetOpen ? ' open' : ''}`} onClick={() => setRightSheetOpen(false)} />}
      </div>

      {/* Mobile bottom nav */}
      <MobileTabBar view={mobileView} onChange={setMobileView} resultsCount={recommendations.length} />

      {/* Modals */}
      {isComparisonOpen && (
        <ComparisonModal
          brtsOption={brtsOption} autoPoolOption={autoPoolOption} privateCarOption={privateCarOption}
          sourceDistance={sourceNearestStation?.distanceKm ?? 0} destinationDistance={destinationNearestStation?.distanceKm ?? 0}
          onSelect={(id) => { selectMode(id); setIsComparisonOpen(false); }}
          onClose={() => setIsComparisonOpen(false)} selectedId={selectedTransit}
        />
      )}
      {isFareModalOpen && <FareProfileModal selectedId={passengerProfile} onSelect={setPassengerProfile} onClose={() => setIsFareModalOpen(false)} />}
      {isCarFuelModalOpen && <CarFuelModal selectedId={carFuelType} onSelect={setCarFuelType} onClose={() => setIsCarFuelModalOpen(false)} />}
      {showSettings && <SettingsModal onClose={() => setShowSettings(false)} onAbout={() => { setShowSettings(false); setHasEntered(false); }} />}
    </div>
  );
}

export default App;
