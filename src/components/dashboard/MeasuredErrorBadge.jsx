import React, { useState } from 'react';
import Icon from '../ui/Icon';

/**
 * MeasuredErrorBadge — inline ± accuracy chip for a displayed value. Expands to
 * explain the reason and, when present, how the error shrinks over time. When no
 * live source exists it shows an honest "live n/a" chip instead of a fake number.
 */
const MeasuredErrorBadge = ({ error }) => {
  const [open, setOpen] = useState(false);
  if (!error) return null;
  const measured = error.measured;

  return (
    <span className="err-badge-wrap">
      <button
        type="button"
        className={measured ? `err-badge sev-${error.severity}` : 'err-badge unmeasured'}
        aria-expanded={open}
        onClick={(e) => { e.stopPropagation(); setOpen((v) => !v); }}
        title={error.reason}
      >
        {measured
          ? `${error.label ? `${error.label} ` : ''}${error.absLabel} (${error.pctLabel})`
          : <><Icon name="alert" size={11} /> live n/a</>}
      </button>
      {open && (
        <span className="err-popover" role="tooltip">
          {measured && <strong className="err-popover-title">{error.title || 'Measured error'}: {error.signedLabel}</strong>}
          <span className="err-popover-reason">{error.reason}</span>
          {error.mitigation && <span className="err-popover-mitigation"><Icon name="trendDown" size={12} /> {error.mitigation}</span>}
        </span>
      )}
    </span>
  );
};

export default MeasuredErrorBadge;
