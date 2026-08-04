import React from 'react';
import Modal from '../ui/Modal';
import Button from '../ui/Button';
import Icon from '../ui/Icon';
import { PRIVATE_CAR_FUELS } from '../../utils/recommendationEngine';

const FUEL_META = {
  petrol: { label: 'Petrol' },
  diesel: { label: 'Diesel' },
  cng: { label: 'CNG' },
};

/**
 * CarFuelModal — choose the private-car fuel. Logic preserved; restyled.
 */
const CarFuelModal = ({ selectedId, onSelect, onClose }) => {
  const fuels = Object.entries(PRIVATE_CAR_FUELS);

  return (
    <Modal
      title="What fuel does your car run on?"
      subtitle="Each fuel emits a different amount of CO₂ per unit. Pick yours and the trip’s fuel cost and CO₂ recalculate."
      onClose={onClose}
      size="md"
      footer={<Button variant="primary" block onClick={onClose}>Done</Button>}
    >
      <div className="option-list">
        {fuels.map(([id, f]) => {
          const meta = FUEL_META[id] || { label: id };
          const active = selectedId === id;
          const co2Range = f.co2Range ? `${f.co2Range[0]}–${f.co2Range[1]}` : null;
          return (
            <div
              key={id}
              className={`option-row${active ? ' active' : ''}`}
              role="button"
              tabIndex={0}
              onClick={() => onSelect(id)}
              onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onSelect(id); } }}
            >
              <div className="option-row-head">
                <span className="option-name">{meta.label}</span>
                <span className="option-tag positive">{f.co2PerUnit} kg CO₂/{f.unit}</span>
                {active && <span className="option-selected"><Icon name="checkCircle" size={16} /></span>}
              </div>
              <p className="option-info">
                Average tailpipe CO₂ ≈ <strong>{f.co2PerUnit} kg per {f.unit}</strong>{co2Range ? ` (range ${co2Range})` : ''}.
                Assumed price <strong>₹{f.pricePerUnit}/{f.unit}</strong>, mileage <strong>{f.mileage} km/{f.unit}</strong>.
              </p>
              <button type="button" className={`option-choose${active ? ' chosen' : ''}`} onClick={(e) => { e.stopPropagation(); onSelect(id); }}>
                {active ? 'Currently applied' : `Use ${meta.label}`}
              </button>
            </div>
          );
        })}
      </div>
      <p className="modal-disclaimer">
        <Icon name="info" size={13} /> CO₂ factors are midpoints of standard ranges; petrol/diesel prices are assumed. Fuel cost = distance ÷ mileage × price.
      </p>
    </Modal>
  );
};

export default CarFuelModal;
