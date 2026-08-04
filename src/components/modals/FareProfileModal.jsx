import React from 'react';
import Modal from '../ui/Modal';
import Button from '../ui/Button';
import Icon from '../ui/Icon';
import { getPassengerProfiles } from '../../utils/fareEngine';

/**
 * FareProfileModal — choose the BRTS fare profile. Logic preserved; restyled to
 * the new modal system.
 */
const FareProfileModal = ({ selectedId, onSelect, onClose }) => {
  const profiles = getPassengerProfiles();
  const discountLabel = (rate) => (rate >= 1 ? 'Unlimited' : rate > 0 ? `${Math.round(rate * 100)}% off` : 'No discount');

  return (
    <Modal
      title="Choose your BRTS fare profile"
      subtitle="Its discount is applied to your Sitilink fare straight away. Change it any time with Edit."
      onClose={onClose}
      size="md"
      footer={<Button variant="primary" block onClick={onClose}>Done</Button>}
    >
      <div className="option-list">
        {profiles.map((p) => {
          const active = selectedId === p.id;
          return (
            <div
              key={p.id}
              className={`option-row${active ? ' active' : ''}`}
              role="button"
              tabIndex={0}
              onClick={() => onSelect(p.id)}
              onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onSelect(p.id); } }}
            >
              <div className="option-row-head">
                <span className="option-name">{p.name}</span>
                <span className={`option-tag${p.discountRate > 0 ? ' positive' : ''}`}>{discountLabel(p.discountRate)}</span>
                {active && <span className="option-selected"><Icon name="checkCircle" size={16} /></span>}
              </div>
              <p className="option-info">{p.info}</p>
              <div className="option-avail">
                <span className="option-avail-label">How to avail</span>
                <p>{p.howToAvail}</p>
                {p.availUrl && (
                  <a className="option-link" href={p.availUrl} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()}>
                    <Icon name="external" size={13} /> {p.availLabel || 'Official Sitilink page'}
                  </a>
                )}
              </div>
              <button type="button" className={`option-choose${active ? ' chosen' : ''}`} onClick={(e) => { e.stopPropagation(); onSelect(p.id); }}>
                {active ? 'Currently applied' : 'Use this profile'}
              </button>
            </div>
          );
        })}
      </div>
      <p className="modal-disclaimer">
        <Icon name="info" size={13} /> Discounts are this app’s modelled rates following official SMC Sitilink schemes. Confirm current eligibility and prices on the linked pages.
      </p>
    </Modal>
  );
};

export default FareProfileModal;
