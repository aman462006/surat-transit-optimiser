import React, { useState } from 'react';
import Icon from '../ui/Icon';

/**
 * MapLegend — collapsible key for the route colours currently on the map.
 * Adapts its rows to the selected mode so it never shows irrelevant lines.
 */
const ITEMS = {
  brts:     { swatch: 'legend-brts', label: 'BRTS ride' },
  walk:     { swatch: 'legend-walk', label: 'Walking leg' },
  transfer: { swatch: 'legend-transfer dot', label: 'Transfer hub' },
  car:      { swatch: 'legend-car', label: 'Car route' },
  auto:     { swatch: 'legend-auto', label: 'Auto route' },
  alt:      { swatch: 'legend-alt', label: 'Alternative' },
  network:  { swatch: 'legend-network', label: 'BRTS network' },
};

const MapLegend = ({ mode, showNetwork }) => {
  const [open, setOpen] = useState(true);

  let keys;
  if (mode === 'electric-bus') keys = ['brts', 'walk', 'transfer'];
  else if (mode === 'private-car') keys = ['car', 'alt'];
  else if (mode === 'auto-pool') keys = ['auto', 'alt'];
  else keys = ['car'];
  if (showNetwork) keys = [...keys, 'network'];

  return (
    <div className={`map-legend${open ? '' : ' collapsed'}`}>
      <button type="button" className="map-legend-head focus-ring" onClick={() => setOpen((v) => !v)} aria-expanded={open}>
        <span className="map-legend-title"><Icon name="list" size={14} /> Legend</span>
        <Icon name={open ? 'chevronDown' : 'chevronUp'} size={15} className="map-legend-chev" />
      </button>
      {open && (
        <div className="map-legend-body">
          {keys.map((k) => (
            <div key={k} className="map-legend-item">
              <span className={`legend-swatch ${ITEMS[k].swatch}`} />
              <span className="map-legend-label">{ITEMS[k].label}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default MapLegend;
