import React, { useState } from 'react';
import Modal from '../ui/Modal';
import Button from '../ui/Button';
import Segmented from '../ui/Segmented';
import Icon from '../ui/Icon';
import { useTheme } from '../../context/ThemeContext';

/**
 * SettingsModal — appearance + local-data controls. Small, honest, no accounts.
 */
const SettingsModal = ({ onClose, onAbout }) => {
  const { theme, setTheme } = useTheme();
  const [clearedRecents, setClearedRecents] = useState(false);
  const [resetCal, setResetCal] = useState(false);

  const clearRecents = () => { try { localStorage.removeItem('sto-recent-searches'); } catch { /* noop */ } setClearedRecents(true); };
  const resetCalibration = () => { try { localStorage.removeItem('eta-model-calibration'); } catch { /* noop */ } setResetCal(true); };

  return (
    <Modal title="Settings" subtitle="Preferences are stored on this device only." onClose={onClose} size="sm">
      <div className="settings-group">
        <span className="settings-label">Appearance</span>
        <Segmented
          ariaLabel="Theme"
          options={[{ value: 'light', label: 'Light', icon: <Icon name="sun" size={15} /> }, { value: 'dark', label: 'Dark', icon: <Icon name="moon" size={15} /> }]}
          value={theme}
          onChange={setTheme}
        />
      </div>

      <div className="settings-group">
        <span className="settings-label">Local data</span>
        <div className="settings-row">
          <div className="settings-row-text"><strong>Recent searches</strong><span>Clear saved recent places.</span></div>
          <Button size="sm" variant="subtle" onClick={clearRecents} disabled={clearedRecents}>{clearedRecents ? 'Cleared' : 'Clear'}</Button>
        </div>
        <div className="settings-row">
          <div className="settings-row-text"><strong>Learned ETA calibration</strong><span>Reset the offline traffic model’s self-correction.</span></div>
          <Button size="sm" variant="subtle" onClick={resetCalibration} disabled={resetCal}>{resetCal ? 'Reset' : 'Reset'}</Button>
        </div>
      </div>

      <div className="settings-group">
        <span className="settings-label">About</span>
        <Button variant="secondary" block icon={<Icon name="info" size={16} />} onClick={onAbout}>View project overview</Button>
      </div>
    </Modal>
  );
};

export default SettingsModal;
