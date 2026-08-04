import React from 'react';

/**
 * MiniBars — a compact comparison bar chart used inside metric cards.
 * `data` = [{ label, value, color?, active? }]. Bars are normalised to the max.
 * `invert` flips the fill height meaning (used where lower = better visually).
 */
export const MiniBars = ({ data = [], height = 34, className = '' }) => {
  const max = Math.max(...data.map((d) => Math.abs(d.value) || 0), 0.0001);
  return (
    <div className={`minibars ${className}`} style={{ height }}>
      {data.map((d, i) => {
        const h = Math.max(6, (Math.abs(d.value) / max) * 100);
        return (
          <div key={d.label || i} className={`minibar-col${d.active ? ' active' : ''}`}>
            <div className="minibar-track">
              <div
                className="minibar-fill"
                style={{ height: `${h}%`, background: d.color || 'var(--accent)', animationDelay: `${i * 60}ms` }}
                title={`${d.label}: ${d.value}`}
              />
            </div>
            <span className="minibar-label">{d.label}</span>
          </div>
        );
      })}
    </div>
  );
};

/**
 * Sparkline — a tiny inline SVG trend line for a series of numbers.
 */
export const Sparkline = ({ values = [], width = 72, height = 24, color = 'var(--accent)', className = '' }) => {
  if (!values.length) return null;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  const step = width / Math.max(1, values.length - 1);
  const pts = values.map((v, i) => {
    const x = i * step;
    const y = height - ((v - min) / span) * (height - 4) - 2;
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  });
  return (
    <svg className={`sparkline ${className}`} width={width} height={height} viewBox={`0 0 ${width} ${height}`} aria-hidden="true">
      <polyline points={pts.join(' ')} fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
};

export default MiniBars;
