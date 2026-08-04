import React, { useEffect, useRef } from 'react';
import Icon from './Icon';

/**
 * Modal — accessible dialog shell. Closes on ESC / backdrop click, locks body
 * scroll, traps initial focus, and animates in. `size` controls max width.
 */
const Modal = ({ title, subtitle, onClose, size = 'md', headerBadges = null, footer = null, children, className = '' }) => {
  const panelRef = useRef(null);

  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose?.(); };
    document.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    panelRef.current?.focus();
    return () => { document.removeEventListener('keydown', onKey); document.body.style.overflow = prev; };
  }, [onClose]);

  return (
    <div className="modal-backdrop" onClick={onClose} role="presentation">
      <div
        ref={panelRef}
        className={`modal-panel modal-${size} ${className}`}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        tabIndex={-1}
      >
        <button type="button" className="modal-close focus-ring" aria-label="Close" onClick={onClose}>
          <Icon name="x" size={18} />
        </button>
        {(title || subtitle) && (
          <div className="modal-header">
            <div className="modal-header-text">
              {title && <h3 className="modal-title">{title}</h3>}
              {subtitle && <p className="modal-subtitle">{subtitle}</p>}
            </div>
            {headerBadges && <div className="modal-header-badges">{headerBadges}</div>}
          </div>
        )}
        <div className="modal-body">{children}</div>
        {footer && <div className="modal-footer">{footer}</div>}
      </div>
    </div>
  );
};

export default Modal;
