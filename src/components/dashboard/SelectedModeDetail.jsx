import React from 'react';
import Icon from '../ui/Icon';
import { FARE_CONFIG } from '../../utils/fareEngine';

/**
 * SelectedModeDetail — mode-specific settings + explanation for the active card:
 * BRTS fare profile, private-car fuel, and a short "how this is calculated" note.
 * Pure presentation; edit actions open the existing modals via callbacks.
 */
const SettingBar = ({ label, value, onEdit }) => (
  <div className="setting-bar">
    <div className="setting-bar-info">
      <span className="setting-bar-label">{label}</span>
      <span className="setting-bar-value">{value}</span>
    </div>
    <button type="button" className="setting-bar-edit focus-ring" onClick={onEdit}>
      <Icon name="edit" size={13} /> Edit
    </button>
  </div>
);

const SelectedModeDetail = ({ mode, passengerProfile, onEditFare, onEditFuel }) => {
  if (!mode) return null;

  if (mode.id === 'electric-bus') {
    const profile = FARE_CONFIG.PASSENGER_PROFILES[passengerProfile] || FARE_CONFIG.PASSENGER_PROFILES.standard;
    return (
      <div className="mode-detail">
        <SettingBar label="Fare profile" value={profile.name} onEdit={onEditFare} />
        <p className="mode-detail-note">
          Includes bus legs, any transfer stations, and first/last-mile walks between your addresses and stations.
        </p>
      </div>
    );
  }

  if (mode.id === 'private-car') {
    const unit = mode.privateCarFuelUnit || 'L';
    const fuelName = mode.privateCarFuelType === 'diesel' ? 'Diesel' : mode.privateCarFuelType === 'cng' ? 'CNG' : 'Petrol';
    return (
      <div className="mode-detail">
        <SettingBar
          label="Fuel type"
          value={`${fuelName} · ${mode.privateCarCo2KgPerLitre} kg CO₂/${unit}`}
          onEdit={onEditFuel}
        />
        <div className="mode-detail-specs">
          <div><span>Mileage</span><strong>{mode.privateCarMileageKmpl} km/{unit}</strong></div>
          <div><span>Price</span><strong>₹{mode.privateCarFuelPricePerLitre}/{unit}</strong></div>
          <div><span>Fuel used</span><strong>{mode.fuelUsedLitres > 0 ? `${mode.fuelUsedLitres.toFixed(2)} ${unit}` : '—'}</strong></div>
          <div><span>CO₂ factor</span><strong>{mode.privateCarCo2KgPerLitre} kg/{unit}</strong></div>
        </div>
        <p className="mode-detail-note">
          Fuel use is distance ÷ mileage; cost is fuel × your assumed price; CO₂ is fuel × the {fuelName.toLowerCase()} factor.
        </p>
      </div>
    );
  }

  // auto-pool
  return (
    <div className="mode-detail">
      <p className="mode-detail-note">
        Metered Surat auto fare{mode.autoSingleFare ? ` (₹${mode.autoSingleFare} ÷ ${mode.autoOccupancy} riders)` : ''} — lower per-person cost
        than driving alone, with minimal walking to pickup.
      </p>
    </div>
  );
};

export default SelectedModeDetail;
