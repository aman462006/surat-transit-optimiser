import React, { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import L from 'leaflet';
import { MapContainer, TileLayer, Marker, Popup, Polyline, useMap, useMapEvents, Tooltip } from 'react-leaflet';
import { BRTS_STATIONS, BRTS_ROUTES } from '../../utils/transitDataService';
import { fetchRoadPath } from '../../utils/osrmService';
import { useTheme } from '../../context/ThemeContext';
import MapControls from './MapControls';
import MapLegend from './MapLegend';
import Icon from '../ui/Icon';

const SURAT_CENTER = [21.1702, 72.8311];
const DEFAULT_ZOOM = 13;

/* ---- Tile definitions (theme + base-layer aware) ---- */
const TILES = {
  light: {
    url: 'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png',
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a> &copy; <a href="https://carto.com/attributions">CARTO</a>',
    subdomains: 'abcd',
  },
  dark: {
    url: 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png',
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a> &copy; <a href="https://carto.com/attributions">CARTO</a>',
    subdomains: 'abcd',
  },
  satellite: {
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
    attribution: 'Tiles &copy; Esri, Maxar, Earthstar Geographics',
    subdomains: '',
  },
};

/* ---- Custom markers ---- */
const endpointIcon = (variant) =>
  L.divIcon({
    className: `map-pin map-pin-${variant}`,
    html: `<span class="pin-halo"></span><span class="pin-core"><span class="pin-glyph"></span></span>`,
    iconSize: [30, 38],
    iconAnchor: [15, 34],
    popupAnchor: [0, -32],
  });

const stationIcon = () =>
  L.divIcon({ className: 'map-station', html: '<span class="station-ring"></span>', iconSize: [14, 14], iconAnchor: [7, 7] });

const transferIcon = () =>
  L.divIcon({
    className: 'map-transfer',
    html: '<span class="transfer-pulse"></span><span class="transfer-core"></span>',
    iconSize: [22, 22],
    iconAnchor: [11, 11],
  });

const moverIcon = (color) =>
  L.divIcon({ className: 'map-mover', html: `<span class="mover-dot" style="--mv:${color}"></span>`, iconSize: [16, 16], iconAnchor: [8, 8] });

/* ---- Road-snapped polyline (upgrades straight → real roads via OSRM) ---- */
const RoutedPolyline = ({ positions, pathOptions, casing, children }) => {
  const [pts, setPts] = useState(positions);
  const sig = JSON.stringify(positions);
  useEffect(() => {
    let active = true;
    setPts(positions);
    fetchRoadPath(positions).then((path) => { if (active && path && path.length > 1) setPts(path); });
    return () => { active = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sig]);
  return (
    <>
      {casing && (
        <Polyline positions={pts} pathOptions={{ color: casing.color, weight: (pathOptions.weight || 4) + (casing.extraWeight ?? 4), opacity: casing.opacity ?? 0.9, lineCap: 'round', lineJoin: 'round' }} />
      )}
      <Polyline positions={pts} pathOptions={pathOptions}>{children}</Polyline>
    </>
  );
};

/* ---- Map click → set source/destination ---- */
const MapEvents = ({ onSelectCoords }) => {
  useMapEvents({ click(e) { onSelectCoords({ lat: e.latlng.lat, lng: e.latlng.lng }); } });
  return null;
};

/* ---- Bridge: fit bounds + lift a control API to the parent ---- */
const MapController = ({ source, destination, onApi, onLocating }) => {
  const map = useMap();

  const reset = useCallback(() => {
    if (source && destination) {
      map.fitBounds(L.latLngBounds([[source.lat, source.lng], [destination.lat, destination.lng]]), { padding: [70, 70], animate: true });
    } else {
      map.flyTo(SURAT_CENTER, DEFAULT_ZOOM, { duration: 0.6 });
    }
  }, [map, source, destination]);

  useEffect(() => {
    onApi({
      zoomIn: () => map.zoomIn(),
      zoomOut: () => map.zoomOut(),
      reset,
      locate: () => {
        onLocating(true);
        map.locate({ setView: true, maxZoom: 16 });
      },
    });
  }, [map, reset, onApi, onLocating]);

  useEffect(() => {
    const done = () => onLocating(false);
    map.on('locationfound', done);
    map.on('locationerror', done);
    return () => { map.off('locationfound', done); map.off('locationerror', done); };
  }, [map, onLocating]);

  useEffect(() => {
    if (source && destination) {
      map.fitBounds(L.latLngBounds([[source.lat, source.lng], [destination.lat, destination.lng]]), { padding: [70, 70], animate: true, duration: 0.8 });
    }
  }, [source, destination, map]);

  return null;
};

/* ---- Animated marker travelling the active route (traffic-flow overlay) ---- */
const RouteMover = ({ path, color }) => {
  const [pos, setPos] = useState(path?.[0] || null);
  const raf = useRef();
  useEffect(() => {
    if (!path || path.length < 2) { setPos(null); return undefined; }
    let t = 0;
    const speed = 0.6; // segments per second
    let last = performance.now();
    const tick = (now) => {
      const dt = (now - last) / 1000; last = now;
      t += dt * speed;
      if (t >= path.length - 1) t = 0;
      const i = Math.floor(t); const f = t - i;
      const a = path[i]; const b = path[Math.min(i + 1, path.length - 1)];
      setPos([a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f]);
      raf.current = requestAnimationFrame(tick);
    };
    raf.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf.current);
  }, [path]);
  if (!pos) return null;
  return <Marker position={pos} icon={moverIcon(color)} interactive={false} zIndexOffset={500} />;
};

/* ========================================================================= */
const MapView = ({
  source, destination, selectionMode,
  routeCoordinates, routeAlternatives = [],
  onSelectCoords, selectedTransit = null, brtsItinerary = null,
  exposure = null, isLoadingRoute = false,
}) => {
  const { theme } = useTheme();
  const wrapperRef = useRef(null);
  const [api, setApi] = useState(null);
  const [locating, setLocating] = useState(false);
  const [baseLayer, setBaseLayer] = useState('map');
  const [showNetwork, setShowNetwork] = useState(true);
  const [pollutionOverlay, setPollutionOverlay] = useState(false);
  const [trafficFlow, setTrafficFlow] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);

  const isCar = selectedTransit === 'private-car';
  const isAuto = selectedTransit === 'auto-pool';
  const isRoad = isCar || isAuto;

  const handleApi = useCallback((a) => setApi(a), []);
  const handleLocating = useCallback((v) => setLocating(v), []);

  // Fullscreen
  const toggleFullscreen = useCallback(() => {
    const el = wrapperRef.current;
    if (!el) return;
    if (!document.fullscreenElement) el.requestFullscreen?.().catch(() => {});
    else document.exitFullscreen?.();
  }, []);
  useEffect(() => {
    const onFs = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', onFs);
    return () => document.removeEventListener('fullscreenchange', onFs);
  }, []);

  const tile = baseLayer === 'satellite' ? TILES.satellite : theme === 'dark' ? TILES.dark : TILES.light;

  // Concrete hex palette (Leaflet writes SVG stroke attributes — CSS vars don't apply there)
  const dark = theme === 'dark';
  const C = {
    brts: dark ? '#10b981' : '#059669',
    auto: dark ? '#f59e0b' : '#d97706',
    car: dark ? '#3b82f6' : '#2563eb',
    walk: dark ? '#fbbf24' : '#f59e0b',
    alt: dark ? '#6b7280' : '#94a3b8',
    casing: dark ? '#0a0a0b' : '#ffffff',
  };
  const carAuto = isCar ? C.car : C.auto;
  const activeRoadColor = pollutionOverlay && exposure?.ok ? (exposure.aqiClass?.color || carAuto) : carAuto;

  const getRideLegCoordinates = (leg) => (!leg?.stations?.length ? [] : leg.stations.map((s) => [s.lat, s.lng]));
  const getWalkingLegCoordinates = (leg) => {
    if (!leg) return [];
    let start, end;
    if (leg.from === 'Your Location') start = [source.lat, source.lng];
    else { const st = Object.values(BRTS_STATIONS).find((s) => s.name === leg.from); start = st ? [st.lat, st.lng] : null; }
    if (leg.to === 'Destination') end = [destination.lat, destination.lng];
    else { const st = Object.values(BRTS_STATIONS).find((s) => s.name === leg.to); end = st ? [st.lat, st.lng] : null; }
    return start && end ? [start, end] : [];
  };
  const getTransferStations = (itin) =>
    !itin ? [] : itin.filter((l) => l.type === 'transfer').map((l) => Object.values(BRTS_STATIONS).find((s) => s.name === l.stationName)).filter(Boolean);

  const needsPoint = !source || !destination;

  return (
    <div className={`map-view${isFullscreen ? ' is-fullscreen' : ''}`} ref={wrapperRef}>
      <MapContainer
        center={SURAT_CENTER}
        zoom={DEFAULT_ZOOM}
        minZoom={11}
        maxZoom={18}
        maxBounds={[[21.03, 72.65], [21.38, 72.98]]}
        maxBoundsViscosity={1.0}
        zoomControl={false}
        className="map-canvas"
        style={{ width: '100%', height: '100%' }}
      >
        <MapController source={source} destination={destination} onApi={handleApi} onLocating={handleLocating} />
        <MapEvents onSelectCoords={onSelectCoords} />

        <TileLayer key={`${baseLayer}-${theme}`} url={tile.url} attribution={tile.attribution} subdomains={tile.subdomains} maxZoom={19} detectRetina />

        {/* BRTS network corridors */}
        {showNetwork && Object.values(BRTS_ROUTES).map((route) => {
          const points = route.stations.map((id) => [BRTS_STATIONS[id].lat, BRTS_STATIONS[id].lng]);
          return (
            <Polyline key={route.id} positions={points} pathOptions={{ color: C.brts, weight: 2.5, opacity: 0.28, dashArray: '3, 8', lineCap: 'round' }} />
          );
        })}

        {/* Stations */}
        {showNetwork && Object.values(BRTS_STATIONS).map((station) => {
          const connected = Object.values(BRTS_ROUTES).filter((r) => r.stations.includes(station.id));
          return (
            <Marker key={station.id} position={[station.lat, station.lng]} icon={stationIcon()}>
              <Popup closeButton>
                <div className="map-popup">
                  <div className="popup-head"><Icon name="bus" size={15} /><strong>{station.name}</strong></div>
                  <div className="popup-row"><span>Corridors</span><span>{station.corridors.join(', ')}</span></div>
                  <div className="popup-lines">
                    {connected.map((route) => (
                      <span key={route.id} className="popup-line" style={{ background: route.color }}>{route.shortName}</span>
                    ))}
                  </div>
                  <div className="popup-foot">Fares ₹5–₹25 · {station.amenities.slice(0, 2).join(', ')}</div>
                </div>
              </Popup>
            </Marker>
          );
        })}

        {/* Inactive road alternatives */}
        {isRoad && routeAlternatives.map((alt, i) => (
          alt && alt.length > 1 && (
            <Polyline key={`alt-${i}`} positions={alt} pathOptions={{ color: C.alt, weight: 4, opacity: 0.35, dashArray: '3, 10', lineCap: 'round' }}>
              <Tooltip sticky><div className="route-tip">Alternative corridor</div></Tooltip>
            </Polyline>
          )
        ))}

        {/* Active road route (car / auto) or BRTS reference */}
        {source && destination && routeCoordinates?.length > 0 && (
          <>
            <Polyline positions={routeCoordinates} pathOptions={{ color: C.casing, weight: isRoad ? 9 : 8, opacity: dark ? 0.35 : 0.9, lineCap: 'round', lineJoin: 'round' }} />
            <Polyline
              positions={routeCoordinates}
              pathOptions={{
                color: isRoad ? activeRoadColor : C.car,
                weight: isRoad ? 5.5 : 4.5,
                opacity: isRoad ? 0.98 : 0.55,
                dashArray: isRoad ? undefined : '2, 9',
                lineCap: 'round',
                lineJoin: 'round',
              }}
            >
              <Tooltip sticky>
                <div className="route-tip">
                  <strong>{isCar ? 'Car route' : isAuto ? 'Auto route' : 'Direct route (reference)'}</strong>
                  {pollutionOverlay && exposure?.ok && <><br />Air: {exposure.avgAqi} AQI</>}
                </div>
              </Tooltip>
            </Polyline>
          </>
        )}

        {/* BRTS multimodal itinerary */}
        {source && destination && selectedTransit === 'electric-bus' && brtsItinerary?.itinerary?.map((leg, idx) => {
          if (leg.type === 'walk') {
            const c = getWalkingLegCoordinates(leg);
            return c.length ? (
              <RoutedPolyline key={`walk-${idx}`} positions={c} pathOptions={{ color: C.walk, weight: 4.5, opacity: 0.95, dashArray: '1, 8', lineCap: 'round' }}>
                <Tooltip sticky><div className="route-tip"><strong>Walk</strong><br />{leg.distanceKm.toFixed(2)} km · {leg.durationMins} min</div></Tooltip>
              </RoutedPolyline>
            ) : null;
          }
          if (leg.type === 'ride') {
            const c = getRideLegCoordinates(leg);
            return c.length ? (
              <RoutedPolyline key={`ride-${idx}`} positions={c} casing={{ color: C.casing, extraWeight: 5, opacity: 0.9 }} pathOptions={{ color: C.brts, weight: 6.5, opacity: 1, lineCap: 'round', lineJoin: 'round' }}>
                <Tooltip sticky><div className="route-tip"><strong>Route {leg.routeNumber}</strong><br />{leg.distanceKm?.toFixed(2) || 0} km · {leg.durationMins} min · {leg.stopsCount} stops</div></Tooltip>
              </RoutedPolyline>
            ) : null;
          }
          return null;
        })}

        {/* Transfer hubs */}
        {source && destination && selectedTransit === 'electric-bus' && brtsItinerary?.itinerary &&
          getTransferStations(brtsItinerary.itinerary).map((station) => (
            <Marker key={`transfer-${station.id}`} position={[station.lat, station.lng]} icon={transferIcon()}>
              <Tooltip sticky><div className="route-tip"><strong>Transfer</strong><br />{station.name}</div></Tooltip>
            </Marker>
          ))}

        {/* Endpoints */}
        {source && (
          <Marker position={[source.lat, source.lng]} icon={endpointIcon('source')} draggable
            eventHandlers={{ dragend: (e) => { const p = e.target.getLatLng(); onSelectCoords({ lat: p.lat, lng: p.lng }, 'source'); } }}>
            <Popup closeButton={false}><div className="map-popup-mini"><strong style={{ color: 'var(--mode-brts)' }}>Origin</strong><br />Drag to adjust</div></Popup>
          </Marker>
        )}
        {destination && (
          <Marker position={[destination.lat, destination.lng]} icon={endpointIcon('dest')} draggable
            eventHandlers={{ dragend: (e) => { const p = e.target.getLatLng(); onSelectCoords({ lat: p.lat, lng: p.lng }, 'destination'); } }}>
            <Popup closeButton={false}><div className="map-popup-mini"><strong style={{ color: 'var(--danger)' }}>Destination</strong><br />Drag to adjust</div></Popup>
          </Marker>
        )}

        {/* Traffic-flow animated marker along active route */}
        {trafficFlow && routeCoordinates?.length > 1 && (
          <RouteMover path={routeCoordinates} color={isRoad ? (isCar ? '#2563eb' : '#d97706') : '#2563eb'} />
        )}
      </MapContainer>

      {/* Loading shimmer */}
      {isLoadingRoute && (
        <div className="map-loading">
          <span className="spinner spinner-lg" />
          <span>Routing real roads…</span>
        </div>
      )}

      {/* Selection hint */}
      {needsPoint && (
        <div className="map-hint">
          <span className={`map-hint-dot ${selectionMode === 'source' ? 'src' : 'dst'}`} />
          {selectionMode === 'source' ? 'Tap the map to set your origin' : 'Tap the map to set your destination'}
        </div>
      )}

      <MapControls
        api={api}
        baseLayer={baseLayer} onBaseLayer={setBaseLayer}
        showNetwork={showNetwork} onToggleNetwork={() => setShowNetwork((v) => !v)}
        pollutionOverlay={pollutionOverlay} onTogglePollution={() => setPollutionOverlay((v) => !v)}
        trafficFlow={trafficFlow} onToggleTraffic={() => setTrafficFlow((v) => !v)}
        isFullscreen={isFullscreen} onToggleFullscreen={toggleFullscreen}
        locating={locating}
      />

      <MapLegend mode={selectedTransit} showNetwork={showNetwork} />
    </div>
  );
};

export default MapView;
