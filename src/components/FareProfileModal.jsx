import React from 'react';
import { getPassengerProfiles } from '../utils/fareEngine';

/**
 * FareProfileModal
 * Opens when the rider picks BRTS. Lets them choose a fare profile (standard,
 * digital, student, senior, prepaid pass), explains what each one IS, and tells
 * them HOW to avail it with a link to the official SMC Sitilink page. Selecting a
 * profile applies its discount to the BRTS fare immediately.
 */
const FareProfileModal = ({ selectedId, onSelect, onClose }) => {
  const profiles = getPassengerProfiles();

  const discountLabel = (rate) => {
    if (rate >= 1) return 'Unlimited';
    if (rate > 0) return `${Math.round(rate * 100)}% off`;
    return 'No discount';
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="fare-profile-modal" onClick={(e) => e.stopPropagation()}>
        <button type="button" className="modal-close-btn" aria-label="Close" onClick={onClose}>×</button>

        <div className="modal-header">
          <div>
            <h3>Choose your BRTS fare profile</h3>
            <p className="modal-subtitle">
              Pick the option that applies to you — its discount and offers are applied to your
              Sitilink fare straight away. You can change this any time with “Edit”.
            </p>
          </div>
        </div>

        <div className="fare-profile-list">
          {profiles.map((p) => {
            const isActive = selectedId === p.id;
            return (
              <div
                key={p.id}
                className={`fare-profile-option${isActive ? ' active' : ''}`}
                role="button"
                tabIndex={0}
                onClick={() => onSelect(p.id)}
                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onSelect(p.id); } }}
              >
                <div className="fare-profile-option-head">
                  <span className="fare-profile-name">{p.name}</span>
                  <span className={`fare-profile-discount${p.discountRate > 0 ? ' has-discount' : ''}`}>
                    {discountLabel(p.discountRate)}
                  </span>
                  {isActive && <span className="fare-profile-selected-badge">✓ Selected</span>}
                </div>

                <p className="fare-profile-info">{p.info}</p>

                <div className="fare-profile-avail">
                  <span className="fare-profile-avail-label">How to avail</span>
                  <p className="fare-profile-avail-text">{p.howToAvail}</p>
                  {p.availUrl && (
                    <a
                      className="fare-profile-avail-link"
                      href={p.availUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={(e) => e.stopPropagation()}
                    >
                      🔗 {p.availLabel || 'Official Sitilink page'}
                    </a>
                  )}
                </div>

                <button
                  type="button"
                  className={`fare-profile-choose-btn${isActive ? ' chosen' : ''}`}
                  onClick={(e) => { e.stopPropagation(); onSelect(p.id); }}
                >
                  {isActive ? 'Currently applied' : 'Use this profile'}
                </button>
              </div>
            );
          })}
        </div>

        <p className="fare-profile-disclaimer">
          ℹ️ Discounts shown are this app’s modelled rates and concessions follow official SMC Sitilink
          schemes. Confirm current eligibility, documents and prices on the linked official pages —
          fare policy can change.
        </p>

        <button type="button" className="fare-profile-done-btn" onClick={onClose}>Done</button>
      </div>
    </div>
  );
};

export default FareProfileModal;
