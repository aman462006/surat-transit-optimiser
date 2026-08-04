import React from 'react';

/**
 * ProgressBar — a thin track with an animated fill (grows on mount).
 * `value` is 0..1. Optional `color` override; otherwise uses accent.
 * `tone` can map to semantic colours (good/warn/bad) for at-a-glance meaning.
 */
const TONE_VAR = {
  accent: 'var(--accent)',
  good: 'var(--success)',
  warn: 'var(--warning)',
  bad: 'var(--danger)',
};

const ProgressBar = ({ value = 0, color = null, tone = 'accent', height = 6, className = '', trackClassName = '' }) => {
  const pct = Math.max(0, Math.min(1, Number(value) || 0)) * 100;
  const fill = color || TONE_VAR[tone] || TONE_VAR.accent;
  return (
    <div
      className={`progress-track ${trackClassName} ${className}`}
      style={{ height }}
      role="progressbar"
      aria-valuenow={Math.round(pct)}
      aria-valuemin={0}
      aria-valuemax={100}
    >
      <div className="progress-fill" style={{ width: `${pct}%`, background: fill }} />
    </div>
  );
};

export default ProgressBar;
