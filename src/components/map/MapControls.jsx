import React, { useState } from 'react';
import Icon from '../ui/Icon';

/**
 * MapControls — floating glass controls over the map. Presentation only; all
 * map actions are performed through the `api` object lifted from the Leaflet
 * instance (zoom / locate / reset / fit). Layer + overlay toggles are lifted
 * to MapView so the tiles and polylines react.
 */
const ControlBtn = ({ icon, label, onClick, active, size = 18 }) => (
  <button
    type="button"
    className={`map-ctrl-btn focus-ring${active ? ' active' : ''}`}
    onClick={onClick}
    title={label}
    aria-label={label}
    aria-pressed={active}
  >
    <Icon name={icon} size={size} />
  </button>
);

const MapControls = ({
  api,
  baseLayer, onBaseLayer,
  showNetwork, onToggleNetwork,
  pollutionOverlay, onTogglePollution,
  trafficFlow, onToggleTraffic,
  isFullscreen, onToggleFullscreen,
  locating,
}) => {
  const [layersOpen, setLayersOpen] = useState(false);

  return (
    <>
      {/* Top-right cluster: layers + fullscreen */}
      <div className="map-ctrl-cluster map-ctrl-topright">
        <div className="map-ctrl-group map-layers-wrap">
          <ControlBtn
            icon="layers"
            label="Map layers"
            active={layersOpen}
            onClick={() => setLayersOpen((v) => !v)}
          />
          {layersOpen && (
            <>
              <div className="map-layers-scrim" onClick={() => setLayersOpen(false)} />
              <div className="map-layers-menu scale-in" role="menu">
                <span className="map-layers-heading">Base map</span>
                <div className="map-layers-bases">
                  <button
                    type="button"
                    className={`layer-swatch${baseLayer === 'map' ? ' active' : ''}`}
                    onClick={() => onBaseLayer('map')}
                  >
                    <span className="swatch swatch-map" />
                    Map
                  </button>
                  <button
                    type="button"
                    className={`layer-swatch${baseLayer === 'satellite' ? ' active' : ''}`}
                    onClick={() => onBaseLayer('satellite')}
                  >
                    <span className="swatch swatch-sat" />
                    Satellite
                  </button>
                </div>
                <span className="map-layers-heading">Overlays</span>
                <label className="layer-toggle">
                  <span><Icon name="route" size={15} /> Transit network</span>
                  <input type="checkbox" checked={showNetwork} onChange={onToggleNetwork} />
                  <span className="switch" aria-hidden="true" />
                </label>
                <label className="layer-toggle">
                  <span><Icon name="wind" size={15} /> Pollution overlay</span>
                  <input type="checkbox" checked={pollutionOverlay} onChange={onTogglePollution} />
                  <span className="switch" aria-hidden="true" />
                </label>
                <label className="layer-toggle">
                  <span><Icon name="zap" size={15} /> Traffic flow</span>
                  <input type="checkbox" checked={trafficFlow} onChange={onToggleTraffic} />
                  <span className="switch" aria-hidden="true" />
                </label>
              </div>
            </>
          )}
        </div>
        <div className="map-ctrl-group">
          <ControlBtn
            icon={isFullscreen ? 'minimize' : 'maximize'}
            label={isFullscreen ? 'Exit fullscreen' : 'Fullscreen map'}
            onClick={onToggleFullscreen}
          />
        </div>
      </div>

      {/* Bottom-right cluster: locate + zoom */}
      <div className="map-ctrl-cluster map-ctrl-bottomright">
        <div className="map-ctrl-group">
          <button
            type="button"
            className={`map-ctrl-btn focus-ring${locating ? ' is-loading' : ''}`}
            onClick={() => api?.locate?.()}
            title="My location"
            aria-label="Center on my location"
          >
            {locating ? <span className="spinner spinner-sm" /> : <Icon name="locate" size={18} />}
          </button>
          <ControlBtn icon="target" label="Reset view" onClick={() => api?.reset?.()} />
        </div>
        <div className="map-ctrl-group map-zoom-group">
          <ControlBtn icon="plus" label="Zoom in" onClick={() => api?.zoomIn?.()} />
          <span className="map-zoom-divider" />
          <ControlBtn icon="minus" label="Zoom out" onClick={() => api?.zoomOut?.()} />
        </div>
      </div>
    </>
  );
};

export default MapControls;
