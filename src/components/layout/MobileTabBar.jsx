import React from 'react';
import Icon from '../ui/Icon';

/**
 * MobileTabBar — bottom navigation on phones. Switches the single visible
 * column (plan / map / results). `resultsCount` shows a badge on Results.
 */
const TABS = [
  { id: 'plan', label: 'Plan', icon: 'search' },
  { id: 'map', label: 'Map', icon: 'map' },
  { id: 'results', label: 'Results', icon: 'sparkles' },
];

const MobileTabBar = ({ view, onChange, resultsCount = 0 }) => (
  <nav className="mobile-tabbar" aria-label="Primary">
    {TABS.map((t) => (
      <button
        key={t.id}
        type="button"
        className={`tabbar-btn${view === t.id ? ' active' : ''}`}
        aria-current={view === t.id ? 'page' : undefined}
        onClick={() => onChange(t.id)}
      >
        <Icon name={t.icon} size={21} strokeWidth={view === t.id ? 2.4 : 2} />
        <span>{t.label}</span>
        {t.id === 'results' && resultsCount > 0 && (
          <span className="tabbar-badge">{resultsCount}</span>
        )}
      </button>
    ))}
  </nav>
);

export default MobileTabBar;
