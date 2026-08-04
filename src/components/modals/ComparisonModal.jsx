import React from 'react';
import Modal from '../ui/Modal';
import Icon from '../ui/Icon';
import Badge from '../ui/Badge';

const MODE_ICON = { 'electric-bus': 'bus', 'auto-pool': 'rickshaw', 'private-car': 'car' };
const MODE_ACCENT = { 'electric-bus': 'var(--mode-brts)', 'auto-pool': 'var(--mode-auto)', 'private-car': 'var(--mode-car)' };

const co2Of = (o) => {
  const r = o?.co2EmissionsRange;
  if (Array.isArray(r) && r.length === 2) return `${r[0].toFixed(1)}–${r[1].toFixed(1)} kg`;
  return o ? `${o.co2Emissions} kg` : '—';
};
const walkOf = (o) => {
  if (o?.brtsItinerary?.walkingDistanceKm != null) return `${o.brtsItinerary.walkingDistanceKm.toFixed(2)} km`;
  if (o?.walkingRequiredMeters != null) return `${(o.walkingRequiredMeters / 1000).toFixed(2)} km`;
  return '—';
};
const costOf = (o) => (!o ? '—' : o.id === 'private-car' ? `₹${Number(o.tripCost).toFixed(2)}` : `₹${o.tripCost}`);
const fuelOf = (o) => (o?.fuelUsedLitres > 0 ? `${o.fuelUsedLitres.toFixed(2)} ${o.privateCarFuelUnit || 'L'}` : '—');

const ROWS = [
  { key: 'eta', label: 'Travel time', icon: 'clock', get: (o) => (o ? `${o.travelTime} min` : '—') },
  { key: 'cost', label: 'Cost', icon: 'wallet', get: costOf },
  { key: 'fuel', label: 'Fuel used', icon: 'gauge', get: (o) => (o?.id === 'private-car' ? fuelOf(o) : '—') },
  { key: 'co2', label: 'CO₂', icon: 'leaf', get: co2Of },
  { key: 'walk', label: 'Walking', icon: 'footprints', get: walkOf },
  { key: 'transfers', label: 'Transfers', icon: 'transfer', get: (o) => (o ? String(o.transfersRequired ?? 0) : '—') },
];

/**
 * ComparisonModal — full side-by-side of BRTS / Auto / Car on every metric, with
 * per-column select. Replaces the old long-walk modal; all fields preserved.
 */
const ComparisonModal = ({ brtsOption, autoPoolOption, privateCarOption, sourceDistance, destinationDistance, onSelect, onClose, selectedId }) => {
  const cols = [
    { id: 'electric-bus', name: 'BRTS', full: 'Electric Bus', o: brtsOption },
    { id: 'auto-pool', name: 'Auto Pool', full: 'Shared Auto', o: autoPoolOption },
    { id: 'private-car', name: 'Private Car', full: 'Baseline', o: privateCarOption },
  ];

  const badges = (
    <>
      {sourceDistance >= 1 && <Badge tone="neutral" size="sm">Origin walk {sourceDistance.toFixed(1)} km</Badge>}
      {destinationDistance >= 1 && <Badge tone="neutral" size="sm">Dest walk {destinationDistance.toFixed(1)} km</Badge>}
    </>
  );

  return (
    <Modal
      title="Compare commuting modes"
      subtitle="Side-by-side on time, cost, fuel, CO₂, walking and transfers — same road distance and traffic-aware ETA as the map."
      onClose={onClose}
      size="lg"
      headerBadges={badges}
    >
      <div className="cmp-table">
        <div className="cmp-row cmp-head-row">
          <div className="cmp-cell cmp-rowlabel" />
          {cols.map((c) => {
            const sel = selectedId === c.id;
            return (
              <div key={c.id} className={`cmp-cell cmp-col-head${sel ? ' selected' : ''}`} style={{ '--mode-accent': MODE_ACCENT[c.id] }}>
                <span className="cmp-col-icon"><Icon name={MODE_ICON[c.id]} size={18} /></span>
                <span className="cmp-col-name">{c.name}</span>
                <span className="cmp-col-full">{c.full}</span>
              </div>
            );
          })}
        </div>

        {ROWS.map((row) => (
          <div key={row.key} className="cmp-row">
            <div className="cmp-cell cmp-rowlabel"><Icon name={row.icon} size={14} /> {row.label}</div>
            {cols.map((c) => (
              <div key={c.id} className={`cmp-cell cmp-value${selectedId === c.id ? ' selected' : ''}`}>{row.get(c.o)}</div>
            ))}
          </div>
        ))}

        <div className="cmp-row cmp-actions-row">
          <div className="cmp-cell cmp-rowlabel" />
          {cols.map((c) => {
            const sel = selectedId === c.id;
            return (
              <div key={c.id} className="cmp-cell">
                <button
                  type="button"
                  className={`cmp-select${sel ? ' selected' : ''}`}
                  style={{ '--mode-accent': MODE_ACCENT[c.id] }}
                  onClick={() => onSelect(c.id)}
                >
                  {sel ? <><Icon name="check" size={14} /> Selected</> : 'Select'}
                </button>
              </div>
            );
          })}
        </div>
      </div>
    </Modal>
  );
};

export default ComparisonModal;
