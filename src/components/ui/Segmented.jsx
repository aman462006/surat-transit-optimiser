import React from 'react';

/**
 * Segmented control — a pill group with a sliding active indicator.
 * `options` = [{ value, label, icon? }]. Fully keyboard + ARIA (tablist).
 */
const Segmented = ({ options = [], value, onChange, size = 'md', className = '', ariaLabel }) => {
  const activeIndex = Math.max(0, options.findIndex((o) => o.value === value));
  return (
    <div
      className={`segmented segmented-${size} ${className}`}
      role="tablist"
      aria-label={ariaLabel}
      style={{ '--seg-count': options.length, '--seg-index': activeIndex }}
    >
      <span className="segmented-thumb" aria-hidden="true" />
      {options.map((o) => {
        const active = o.value === value;
        return (
          <button
            key={o.value}
            type="button"
            role="tab"
            aria-selected={active}
            className={`segmented-btn${active ? ' active' : ''} focus-ring`}
            onClick={() => onChange?.(o.value)}
          >
            {o.icon && <span className="segmented-icon">{o.icon}</span>}
            {o.label && <span className="segmented-label">{o.label}</span>}
          </button>
        );
      })}
    </div>
  );
};

export default Segmented;
