import React from 'react';
import Icon from '../ui/Icon';
import Button from '../ui/Button';
import { useTheme } from '../../context/ThemeContext';

/**
 * TopNav — brand, theme toggle, About + Settings. Sticky, glassy, minimal.
 */
const TopNav = ({ onAbout, onSettings }) => {
  const { theme, toggleTheme } = useTheme();
  const isDark = theme === 'dark';

  return (
    <header className="topnav">
      <div className="topnav-left">
        <div className="topnav-brand">
          <span className="brand-mark">
            <Icon name="logo" size={19} strokeWidth={2.4} />
          </span>
          <span className="brand-text">
            <span className="brand-title">Surat Transit Optimiser</span>
            <span className="brand-sub">Multimodal transport decisions</span>
          </span>
        </div>
      </div>

      <div className="topnav-actions">
        <Button
          variant="ghost"
          size="md"
          iconOnly
          className="theme-toggle"
          onClick={toggleTheme}
          aria-label={isDark ? 'Switch to light theme' : 'Switch to dark theme'}
          title={isDark ? 'Light mode' : 'Dark mode'}
          icon={<Icon name={isDark ? 'sun' : 'moon'} size={19} />}
        />
        <Button
          variant="ghost"
          size="md"
          iconOnly
          onClick={onAbout}
          aria-label="About this project"
          title="About"
          icon={<Icon name="info" size={19} />}
        />
        <Button
          variant="ghost"
          size="md"
          iconOnly
          onClick={onSettings}
          aria-label="Settings"
          title="Settings"
          icon={<Icon name="settings" size={18} />}
        />
      </div>
    </header>
  );
};

export default TopNav;
