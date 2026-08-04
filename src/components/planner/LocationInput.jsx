import React, { useId } from 'react';
import Icon from '../ui/Icon';

/**
 * LocationInput — one endpoint row (origin or destination) with an autocomplete
 * dropdown, GPS button and clear affordance. Presentation only; all state and
 * handlers are owned by the JourneyPlanner / App.
 */
const LocationInput = ({
  kind, // 'source' | 'destination'
  label,
  placeholder,
  value,
  filled,
  focused,
  loading,
  suggestions = [],
  onChange,
  onFocus,
  onBlur,
  onPick,
  onClear,
  onUseLocation,
}) => {
  const listId = useId();
  const showList = focused && (loading || suggestions.length > 0);
  const dotClass = kind === 'source' ? 'endpoint-dot-source' : 'endpoint-dot-dest';

  return (
    <div className="loc-input">
      <span className={`endpoint-dot ${dotClass}`} aria-hidden="true">
        {kind === 'destination' ? <Icon name="pin" size={13} strokeWidth={2.6} /> : null}
      </span>

      <div className="loc-field">
        <label className="loc-label" htmlFor={`${listId}-input`}>{label}</label>
        <div className="loc-row">
          <input
            id={`${listId}-input`}
            type="text"
            className="loc-text"
            placeholder={placeholder}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            onFocus={onFocus}
            onBlur={onBlur}
            autoComplete="off"
            role="combobox"
            aria-expanded={showList}
            aria-controls={listId}
            aria-autocomplete="list"
          />
        </div>
      </div>

      <div className="loc-actions">
        <button
          type="button"
          className="loc-gps focus-ring"
          onClick={() => onUseLocation(kind)}
          title="Use current location"
          aria-label={`Use current location for ${label}`}
        >
          <Icon name="locate" size={16} />
        </button>
        {filled && (
          <button
            type="button"
            className="loc-clear focus-ring"
            onClick={onClear}
            title="Clear"
            aria-label={`Clear ${label}`}
          >
            <Icon name="x" size={15} />
          </button>
        )}
      </div>

      {showList && (
        <div className="autocomplete" id={listId} role="listbox">
          {loading ? (
            <div className="autocomplete-loading">
              <span className="spinner spinner-sm" /> Searching places…
            </div>
          ) : (
            suggestions.map((place, idx) => (
              <button
                key={`${place.displayName}-${idx}`}
                type="button"
                role="option"
                aria-selected="false"
                className="autocomplete-item"
                onMouseDown={(e) => { e.preventDefault(); onPick(place); }}
              >
                <span className="autocomplete-pin"><Icon name="pin" size={15} /></span>
                <span className="autocomplete-text">
                  <span className="autocomplete-name">{place.displayName}</span>
                  <span className="autocomplete-full">{place.fullName}</span>
                </span>
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
};

export default LocationInput;
