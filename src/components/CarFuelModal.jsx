import React from 'react';
import { PRIVATE_CAR_FUELS } from '../utils/recommendationEngine';

/**
 * CarFuelModal
 * Opens when the rider picks Private Car. Asks which fuel the car runs on —
 * Petrol, Diesel or CNG — showing the average CO₂ produced per unit burnt (and
 * the assumed pump price). Choosing one re-bases the trip's fuel cost and CO₂.
 */

const FUEL_META = {
  petrol: { icon: '⛽', label: 'Petrol' },
  diesel: { icon: '🛢️', label: 'Diesel' },
  cng:    { icon: '💨', label: 'CNG' }
};

const CarFuelModal = ({ selectedId, onSelect, onClose }) => {
  const fuels = Object.entries(PRIVATE_CAR_FUELS);

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="fare-profile-modal" onClick={(e) => e.stopPropagation()}>
        <button type="button" className="modal-close-btn" aria-label="Close" onClick={onClose}>×</button>

        <div className="modal-header">
          <div>
            <h3>What fuel does your car run on?</h3>
            <p className="modal-subtitle">
              Each fuel emits a different amount of CO₂ per unit burnt. Pick yours and the trip’s
              fuel cost and CO₂ are recalculated accordingly. You can change it any time with “Edit”.
            </p>
          </div>
        </div>

        <div className="fare-profile-list">
          {fuels.map(([id, f]) => {
            const meta = FUEL_META[id] || { icon: '⛽', label: id };
            const isActive = selectedId === id;
            const co2Range = f.co2Range ? `${f.co2Range[0]}–${f.co2Range[1]}` : null;
            return (
              <div
                key={id}
                className={`fare-profile-option${isActive ? ' active' : ''}`}
                role="button"
                tabIndex={0}
                onClick={() => onSelect(id)}
                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onSelect(id); } }}
              >
                <div className="fare-profile-option-head">
                  <span className="fare-profile-name">{meta.icon} {meta.label}</span>
                  <span className="fare-profile-discount has-discount">
                    {f.co2PerUnit} kg CO₂ / {f.unit}
                  </span>
                  {isActive && <span className="fare-profile-selected-badge">✓ Selected</span>}
                </div>

                <p className="fare-profile-info">
                  Average tailpipe CO₂ ≈ <strong>{f.co2PerUnit} kg per {f.unit}</strong> burnt
                  {co2Range ? ` (typical range ${co2Range} kg/${f.unit})` : ''}. Assumed price{' '}
                  <strong>₹{f.pricePerUnit}/{f.unit}</strong> and mileage <strong>{f.mileage} km/{f.unit}</strong>.
                </p>

                <button
                  type="button"
                  className={`fare-profile-choose-btn${isActive ? ' chosen' : ''}`}
                  onClick={(e) => { e.stopPropagation(); onSelect(id); }}
                >
                  {isActive ? 'Currently applied' : `Use ${meta.label}`}
                </button>
              </div>
            );
          })}
        </div>

        <p className="fare-profile-disclaimer">
          ℹ️ CO₂ factors are midpoints of standard tailpipe ranges; petrol/diesel pump prices are assumed
          and may vary day to day. Fuel cost = distance ÷ mileage × price; CO₂ = fuel used × the factor above.
        </p>

        <button type="button" className="fare-profile-done-btn" onClick={onClose}>Done</button>
      </div>
    </div>
  );
};

export default CarFuelModal;
