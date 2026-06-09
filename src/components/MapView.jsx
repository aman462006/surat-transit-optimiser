import React, { useEffect, useState } from 'react';
import L from 'leaflet';
import { MapContainer, TileLayer, Marker, Popup, Polyline, useMap, useMapEvents, ZoomControl, Tooltip } from 'react-leaflet';
import { BRTS_STATIONS, BRTS_ROUTES } from '../utils/transitDataService';
import { FARE_CONFIG } from '../utils/fareEngine';
import { fetchRoadPath } from '../utils/osrmService';

// 1. Helper Icon Generator
// Creates custom HSL-colored modern pulsing HTML icons inside the Leaflet canvas
const createCustomIcon = (colorClass) => {
  return L.divIcon({
    className: `custom-marker ${colorClass}`,
    html: `
      <div class="marker-pin-wrapper">
        <div class="marker-pulse"></div>
        <div class="marker-dot"></div>
      </div>
    `,
    iconSize: [30, 30],
    iconAnchor: [15, 15]
  });
};

// 1b. Custom Station Node Icon
const createStationIcon = () => {
  return L.divIcon({
    className: 'custom-marker station-marker',
    html: `
      <div class="station-marker-pin">
        <div class="station-inner-dot"></div>
      </div>
    `,
    iconSize: [18, 18],
    iconAnchor: [9, 9]
  });
};

// 1c. Transfer Station Highlight Icon (Amber/Yellow)
const createTransferStationIcon = () => {
  return L.divIcon({
    className: 'custom-marker transfer-station-marker',
    html: `
      <div class="transfer-station-pin">
        <div class="transfer-station-pulse"></div>
        <div class="transfer-station-dot"></div>
      </div>
    `,
    iconSize: [24, 24],
    iconAnchor: [12, 12]
  });
};

/**
 * RoutedPolyline
 * Draws a polyline that follows the real road network between the given
 * waypoints (via OSRM) instead of cutting straight across. While the road
 * geometry is loading — or if routing fails — it falls back to the straight
 * line through `positions`, so the path is always visible.
 *
 * An optional `casing` renders a wider, lighter line underneath the main one
 * to make the route pop against the busy map background.
 */
const RoutedPolyline = ({ positions, pathOptions, casing, children }) => {
  const [roadPositions, setRoadPositions] = useState(positions);

  const sig = JSON.stringify(positions);
  useEffect(() => {
    let active = true;
    // Show the straight line immediately, then upgrade to road geometry.
    setRoadPositions(positions);
    fetchRoadPath(positions).then((path) => {
      if (active && path && path.length > 1) setRoadPositions(path);
    });
    return () => { active = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sig]);

  return (
    <>
      {casing && (
        <Polyline
          positions={roadPositions}
          pathOptions={{
            color: casing.color,
            weight: (pathOptions.weight || 4) + (casing.extraWeight ?? 4),
            opacity: casing.opacity ?? 0.9,
            lineCap: 'round',
            lineJoin: 'round'
          }}
        />
      )}
      <Polyline positions={roadPositions} pathOptions={pathOptions}>
        {children}
      </Polyline>
    </>
  );
};

// 1d. Route Legend Component
const RouteLegendsOverlay = () => {
  return (
    <div className="map-legend-overlay">
      <div className="legend-title">Route Legend</div>
      
      <div className="legend-item">
        <div className="legend-line active-transit"></div>
        <span className="legend-label">BRTS Transit (on road)</span>
      </div>

      <div className="legend-item">
        <div className="legend-line walking-path"></div>
        <span className="legend-label">Walking Path</span>
      </div>

      <div className="legend-item">
        <div className="legend-line direct-route"></div>
        <span className="legend-label">Direct Road Route</span>
      </div>

      <div className="legend-item">
        <div className="legend-line network-corridor"></div>
        <span className="legend-label">BRTS Network</span>
      </div>

      <div className="legend-item">
        <div className="legend-marker transfer-marker"></div>
        <span className="legend-label">Transfer Hub</span>
      </div>
    </div>
  );
};

/**
 * MapEvents Component
 * Sub-component to attach Leaflet event handlers using the React Leaflet useMapEvents hook.
 * Handles general map click actions to trigger source/destination updates.
 */
const MapEvents = ({ onSelectCoords }) => {
  useMapEvents({
    click(e) {
      const { lat, lng } = e.latlng;
      // Triggers parent callback to register coordinate click
      onSelectCoords({ lat, lng });
    }
  });
  return null;
};

/**
 * MapBoundController Component
 * Listens for updates in source and destination points.
 * Automatically zooms and fits the map bounds so both points are perfectly centered.
 */
const MapBoundController = ({ source, destination }) => {
  const map = useMap();

  useEffect(() => {
    if (source && destination) {
      const start = [source.lat, source.lng];
      const end = [destination.lat, destination.lng];
      
      // Calculate bound coordinates including both terminals
      const bounds = L.latLngBounds([start, end]);
      
      // Fit map viewport smoothly to bounds with nice padding
      map.fitBounds(bounds, {
        padding: [60, 60],
        animate: true,
        duration: 1
      });
    }
  }, [source, destination, map]);

  return null;
};

/**
 * MapView Component
 * React Leaflet representation.
 * Renders the map and visualizes real road coordinates fetched from OSRM,
 * or dynamic multi-leg transit itineraries (walk/ride) when BRTS is selected.
 */
const MapView = ({
  source,
  destination,
  selectionMode,
  routeCoordinates,
  routeAlternatives = [],
  onSelectCoords,
  selectedTransit = null,
  brtsItinerary = null
}) => {
  const defaultCenter = [21.1702, 72.8311]; // Surat center point
  const defaultZoom = 13;

  const isDirectRoadMode =
    selectedTransit === 'private-car' || selectedTransit === 'auto-pool';
  const isPrivateCarSelected = selectedTransit === 'private-car';

  /**
   * Coordinate Extractor for Transit Ride Legs
   * Extracts polyline coordinates from pre-compiled station sequences in ride legs.
   * Maps station data to Leaflet's [lat, lng] coordinate format.
   */
  const getRideLegCoordinates = (leg) => {
    if (!leg || !leg.stations || leg.stations.length === 0) return [];
    return leg.stations.map(s => [s.lat, s.lng]);
  };

  /**
   * Coordinate Extractor for Walking Legs
   * Constructs walking path coordinates from source/destination and station positions.
   * Handles:
   *   - Source to first station (access)
   *   - Station to station transfers
   *   - Last station to destination (egress)
   */
  const getWalkingLegCoordinates = (leg, source, destination) => {
    if (!leg) return [];

    let startCoord, endCoord;

    // Determine start coordinate
    if (leg.from === 'Your Location') {
      startCoord = [source.lat, source.lng];
    } else {
      const station = Object.values(BRTS_STATIONS).find(s => s.name === leg.from);
      startCoord = station ? [station.lat, station.lng] : null;
    }

    // Determine end coordinate
    if (leg.to === 'Destination') {
      endCoord = [destination.lat, destination.lng];
    } else {
      const station = Object.values(BRTS_STATIONS).find(s => s.name === leg.to);
      endCoord = station ? [station.lat, station.lng] : null;
    }

    if (!startCoord || !endCoord) return [];
    return [startCoord, endCoord];
  };

  /**
   * Extract all transfer stations from the itinerary
   * Used to highlight interchange points on the map
   */
  const getTransferStations = (itinerary) => {
    if (!itinerary) return [];
    return itinerary
      .filter(leg => leg.type === 'transfer')
      .map(leg => {
        const station = Object.values(BRTS_STATIONS).find(s => s.name === leg.stationName);
        return station;
      })
      .filter(Boolean); // Remove null values
  };

  return (
    <div className="map-view-wrapper">
      <MapContainer
        center={defaultCenter}
        zoom={defaultZoom}
        minZoom={11}
        maxZoom={18}
        maxBounds={[[21.03, 72.65], [21.38, 72.98]]}
        maxBoundsViscosity={1.0}
        zoomControl={false} // Disable standard zoom to allow custom positioning
        className="map-canvas"
        style={{ width: '100%', height: '100%' }}
      >
        {/* Custom controller that adjusts bounds dynamically */}
        <MapBoundController source={source} destination={destination} />

        {/* Listeners for map clicks */}
        <MapEvents onSelectCoords={onSelectCoords} />

        {/* Detailed OpenStreetMap base layer — renders building footprints,
            parks/green spaces, water bodies and POI labels at higher zooms. */}
        <TileLayer
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          subdomains="abc"
          maxZoom={19}
        />

        {/* Custom Zoom Control placed at the bottom-right */}
        <ZoomControl position="bottomright" />

        {/* 1. Draw thin background polylines for all BRTS corridors */}
        {/* Muted orange/pastel tone with low opacity for transit network background */}
        {Object.values(BRTS_ROUTES).map(route => {
          const points = route.stations.map(id => [BRTS_STATIONS[id].lat, BRTS_STATIONS[id].lng]);
          return (
            <Polyline
              key={route.id}
              positions={points}
              pathOptions={{
                color: '#f97316', // Orange network corridor
                weight: 2.5, // Thin for network background
                opacity: 0.3, // Visible but clearly a background layer
                dashArray: '4, 7', // Thin dashed
                lineCap: 'round',
                lineJoin: 'round'
              }}
            />
          );
        })}

        {/* 2. Render all registered BRTS stations on the map */}
        {Object.values(BRTS_STATIONS).map(station => {
          // Find routes connected to this station
          const connected = Object.values(BRTS_ROUTES).filter(r => r.stations.includes(station.id));
          return (
            <Marker
              key={station.id}
              position={[station.lat, station.lng]}
              icon={createStationIcon()}
            >
              <Popup closeButton={true}>
                <div className="station-popup-card" style={{ minWidth: '180px', padding: '2px' }}>
                  <h4 style={{ margin: '0 0 6px 0', fontSize: '0.86rem', fontWeight: '800', color: 'var(--primary)' }}>
                    🚏 {station.name}
                  </h4>
                  <div style={{ marginBottom: '6px', fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                    <span style={{ fontWeight: '700' }}>Corridors: </span>
                    <span style={{ color: '#cbd5e1' }}>{station.corridors.join(', ')}</span>
                  </div>
                  <div style={{ marginBottom: '8px', fontSize: '0.72rem' }}>
                    <span style={{ fontWeight: '700', color: 'var(--text-muted)', display: 'block', marginBottom: '2px' }}>Connected Lines:</span>
                    <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
                      {connected.map(route => (
                        <span 
                          key={route.id} 
                          style={{ 
                            background: route.color, 
                            color: '#fff', 
                            fontSize: '0.6rem', 
                            fontWeight: '800', 
                            padding: '1px 5px', 
                            borderRadius: '3px' 
                          }}
                        >
                          {route.shortName}
                        </span>
                      ))}
                    </div>
                  </div>
                  <div style={{ borderTop: '1px solid rgba(255,255,255,0.08)', paddingTop: '6px', fontSize: '0.68rem', color: '#cbd5e1' }}>
                    <span style={{ fontWeight: '700', color: 'var(--success)' }}>Fares: </span>
                    ₹5.0 - ₹25.0 (SMC Slabs)
                  </div>
                  <div style={{ fontSize: '0.62rem', color: '#64748b', marginTop: '4px', fontStyle: 'italic' }}>
                    Features: {station.amenities.slice(0, 2).join(', ')}
                  </div>
                </div>
              </Popup>
            </Marker>
          );
        })}

        {/* A. Source Marker Node */}
        {source && (
          <Marker
            position={[source.lat, source.lng]}
            icon={createCustomIcon('source-marker')}
            draggable={true}
            eventHandlers={{
              dragend: (e) => {
                const newLatLng = e.target.getLatLng();
                // Send updated drag coordinate back to parent state
                onSelectCoords({ lat: newLatLng.lat, lng: newLatLng.lng }, 'source');
              }
            }}
          >
            <Popup closeButton={false}>
              <div style={{ padding: '2px' }}>
                <b style={{ color: '#10b981' }}>Starting Point (Source)</b>
                <br />
                Drag pin or click map to modify
              </div>
            </Popup>
          </Marker>
        )}

        {/* B. Destination Marker Node */}
        {destination && (
          <Marker
            position={[destination.lat, destination.lng]}
            icon={createCustomIcon('destination-marker')}
            draggable={true}
            eventHandlers={{
              dragend: (e) => {
                const newLatLng = e.target.getLatLng();
                // Send updated drag coordinate back to parent state
                onSelectCoords({ lat: newLatLng.lat, lng: newLatLng.lng }, 'destination');
              }
            }}
          >
            <Popup closeButton={false}>
              <div style={{ padding: '2px' }}>
                <b style={{ color: '#ef4444' }}>Destination Node</b>
                <br />
                Drag pin or click map to modify
              </div>
            </Popup>
          </Marker>
        )}

        {/* 
          C. Dynamic Route Rendering:
          Multimodal visualization with:
          1. Direct road route (background/comparison layer)
          2. BRTS walking segments (when available)
          3. BRTS transit segments (when available)
          4. Transfer station highlights (when available)
        */}
        
        {/* Faint inactive road alternatives (car/auto) — drawn beneath the active route for comparison */}
        {isDirectRoadMode && routeAlternatives.map((altPositions, i) => (
          altPositions && altPositions.length > 1 && (
            <Polyline
              key={`alt-${i}`}
              positions={altPositions}
              pathOptions={{
                color: '#94a3b8',
                weight: 4,
                opacity: 0.4,
                dashArray: '4, 10',
                lineCap: 'round',
                lineJoin: 'round'
              }}
            >
              <Tooltip sticky={true}>
                <div className="route-tooltip">Alternative road corridor</div>
              </Tooltip>
            </Polyline>
          )
        ))}

        {/* Direct road route: primary for private car / auto pooling; background reference when BRTS is active */}
        {source && destination && routeCoordinates && routeCoordinates.length > 0 && (
          <Polyline
            positions={routeCoordinates}
            pathOptions={{
              color: isPrivateCarSelected ? '#64748b' : isDirectRoadMode ? '#475569' : '#2563eb',
              weight: isDirectRoadMode ? 6 : 5,
              opacity: isDirectRoadMode ? 0.95 : 0.7,
              dashArray: isDirectRoadMode ? undefined : '10, 8',
              lineCap: 'round',
              lineJoin: 'round'
            }}
          >
            <Tooltip permanent={false} sticky={true}>
              <div className="route-tooltip">
                <strong>
                  {isPrivateCarSelected
                    ? '🚗 Personal vehicle route'
                    : isDirectRoadMode
                      ? '🚕 Direct road route'
                      : '🚗 Direct route (reference)'}
                </strong>
                <br />
                {isDirectRoadMode
                  ? 'OSRM driving geometry · no BRTS legs'
                  : 'Compare with BRTS on map'}
              </div>
            </Tooltip>
          </Polyline>
        )}

        {/* Foreground Layers: BRTS Multimodal Transit (walking + transit + transfers) */}
        {source && destination && selectedTransit === 'electric-bus' && brtsItinerary && (
          <>
            {/* Walking and Transit Segments */}
            {brtsItinerary.itinerary && brtsItinerary.itinerary.map((leg, idx) => {
              if (leg.type === 'walk') {
                // Walking segments: bright amber dashed path that follows real
                // walkable roads (snapped via OSRM) instead of a straight line.
                const walkCoords = getWalkingLegCoordinates(leg, source, destination);

                return walkCoords.length > 0 ? (
                  <RoutedPolyline
                    key={`walk-${idx}`}
                    positions={walkCoords}
                    pathOptions={{
                      color: '#f59e0b', // Bright amber for walking
                      weight: 5,
                      opacity: 0.95,
                      dashArray: '2, 9', // Dotted "footstep" pattern
                      lineCap: 'round',
                      lineJoin: 'round'
                    }}
                  >
                    <Tooltip permanent={false} sticky={true}>
                      <div className="route-tooltip">
                        <strong>🚶 Walk</strong>
                        <br />
                        {leg.distanceKm.toFixed(2)} km • {leg.durationMins} min
                      </div>
                    </Tooltip>
                  </RoutedPolyline>
                ) : null;
              } else if (leg.type === 'ride') {
                // Transit segments: thick green line snapped to the road through
                // every station, with a white casing so it pops off the map.
                const rideCoords = getRideLegCoordinates(leg);

                return rideCoords.length > 0 ? (
                  <RoutedPolyline
                    key={`ride-${idx}`}
                    positions={rideCoords}
                    casing={{ color: '#ffffff', extraWeight: 5, opacity: 0.9 }}
                    pathOptions={{
                      color: '#059669', // Vivid emerald for active BRTS
                      weight: 7, // Thick for prominence
                      opacity: 1,
                      lineCap: 'round',
                      lineJoin: 'round'
                    }}
                  >
                    <Tooltip permanent={false} sticky={true}>
                      <div className="route-tooltip">
                        <strong>🚌 Route {leg.routeNumber}</strong>
                        <br />
                        {leg.distanceKm?.toFixed(2) || 0} km • {leg.durationMins} min
                        <br />
                        <span style={{ fontSize: '0.8em', color: '#999' }}>
                          {leg.stopsCount} stops
                        </span>
                      </div>
                    </Tooltip>
                  </RoutedPolyline>
                ) : null;
              } else if (leg.type === 'transfer') {
                // Transfer segments are displayed as station highlights (rendered below)
                return null;
              }
              return null;
            })}

            {/* Transfer Station Highlights */}
            {getTransferStations(brtsItinerary.itinerary).map((station, idx) => (
              <Marker
                key={`transfer-${station.id}`}
                position={[station.lat, station.lng]}
                icon={createTransferStationIcon()}
              >
                <Tooltip permanent={false} sticky={true}>
                  <div className="transfer-tooltip">
                    <strong>🔄 Transfer Hub</strong>
                    <br />
                    {station.name}
                  </div>
                </Tooltip>
              </Marker>
            ))}
          </>
        )}
      </MapContainer>

      {/* Floating Status Guide Overlay */}
      <div className="map-instruction-overlay">
        <span className="instruction-badge">
          {selectionMode === 'source' ? '🟢 SETTING SOURCE' : '🔴 SETTING DESTINATION'}
        </span>
        <p className="instruction-text">
          Click anywhere on Surat's map to set the {selectionMode === 'source' ? 'starting terminal' : 'destination node'}
        </p>
      </div>

      {/* Route Legend Overlay */}
      <RouteLegendsOverlay />
    </div>
  );
};

export default MapView;
