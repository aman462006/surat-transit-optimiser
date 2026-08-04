import React from 'react';
import Icon from '../ui/Icon';
import ProgressBar from '../ui/ProgressBar';
import { MiniBars } from '../ui/MiniBars';
import { useCountUp } from '../../hooks/useCountUp';

/**
 * MetricCard — a premium KPI tile. Shows an icon, label (with optional accuracy
 * badge), a count-up value + unit, and one supporting visual: a progress bar,
 * a mini comparison chart, or a badge. Kept deliberately compact for the grid.
 */
const MetricCard = ({
  icon,
  label,
  value,
  unit,
  decimals = 0,
  accent = 'var(--accent)',
  progress = null,       // 0..1
  progressTone = 'accent',
  bars = null,           // [{label, value, color, active}]
  badge = null,          // node
  errorBadge = null,     // node
  hint = null,
  animate = true,
  span = 1,
}) => {
  const numeric = typeof value === 'number';
  const counted = useCountUp(numeric ? value : 0, { decimals, duration: 620 });
  const shown = numeric && animate ? counted : value;

  return (
    <div className={`metric-card${span === 2 ? ' metric-card-wide' : ''}`} style={{ '--metric-accent': accent }}>
      <div className="metric-top">
        <span className="metric-icon"><Icon name={icon} size={16} /></span>
        <span className="metric-label">
          {label}
          {errorBadge}
        </span>
      </div>

      <div className="metric-value-row">
        <span className="metric-value tnum">{shown}</span>
        {unit && <span className="metric-unit">{unit}</span>}
        {badge && <span className="metric-badge-slot">{badge}</span>}
      </div>

      {progress != null && (
        <ProgressBar value={progress} tone={progressTone} color={progressTone === 'custom' ? accent : null} className="metric-progress" />
      )}
      {bars && <MiniBars data={bars} height={30} className="metric-bars" />}
      {hint && <span className="metric-hint">{hint}</span>}
    </div>
  );
};

export default MetricCard;
