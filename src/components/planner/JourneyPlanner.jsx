import React from 'react';
import Icon from '../ui/Icon';
import Button from '../ui/Button';
import Segmented from '../ui/Segmented';
import LocationInput from './LocationInput';
import { useRecentSearches, SURAT_PRESETS } from '../../hooks/useRecentSearches';

const DEPARTURE_OPTIONS = [
  { value: 'now', label: 'Now' },
  { value: 'morning-rush', label: 'AM peak' },
  { value: 'midday-offpeak', label: 'Midday' },
  { value: 'evening-rush', label: 'PM peak' },
  { value: 'night-freeflow', label: 'Night' },
];

/**
 * JourneyPlanner — the left column. Origin/destination with autocomplete, swap,
 * quick presets, recent searches and a departure-time selector. Reads/writes
 * planner state owned by App; records recents locally.
 */
const JourneyPlanner = ({
  source, destination,
  sourceText, destText,
  isSourceFocused, isDestFocused,
  isLoadingSourceSearch, isLoadingDestSearch,
  sourceSuggestions, destSuggestions,
  onSourceTextChange, onDestTextChange,
  onSourceFocus, onSourceBlur, onDestFocus, onDestBlur,
  onSelectSuggestion, onUseLocation, onClearPoint, onSwap, onQuickPick,
  departureTime, onDepartureChange,
  routeError, locationError, isLoadingRoute,
}) => {
  const { recents, addRecent, clearRecents } = useRecentSearches();

  const pick = (place, kind) => { onSelectSuggestion(place, kind); addRecent(place); };
  const quick = (place) => { onQuickPick(place); addRecent(place); };

  const bothSet = source && destination;

  return (
    <div className="planner">
      <div className="planner-head">
        <h2 className="planner-title">Plan your journey</h2>
        <p className="planner-sub">Compare every way to cross Surat — by time, cost, CO₂ and the air you’ll breathe.</p>
      </div>

      {/* Endpoints */}
      <div className="planner-endpoints">
        <div className="endpoints-rail" aria-hidden="true">
          <span className="rail-line" />
        </div>
        <div className="endpoints-fields">
          <LocationInput
            kind="source"
            label="Origin"
            placeholder="Search a starting place…"
            value={sourceText}
            filled={!!source}
            focused={isSourceFocused}
            loading={isLoadingSourceSearch}
            suggestions={sourceSuggestions}
            onChange={onSourceTextChange}
            onFocus={onSourceFocus}
            onBlur={onSourceBlur}
            onPick={(p) => pick(p, 'source')}
            onClear={() => onClearPoint('source')}
            onUseLocation={onUseLocation}
          />
          <LocationInput
            kind="destination"
            label="Destination"
            placeholder="Search a destination…"
            value={destText}
            filled={!!destination}
            focused={isDestFocused}
            loading={isLoadingDestSearch}
            suggestions={destSuggestions}
            onChange={onDestTextChange}
            onFocus={onDestFocus}
            onBlur={onDestBlur}
            onPick={(p) => pick(p, 'destination')}
            onClear={() => onClearPoint('destination')}
            onUseLocation={onUseLocation}
          />
        </div>
        <button
          type="button"
          className="swap-btn focus-ring"
          onClick={onSwap}
          disabled={!source && !destination}
          title="Swap origin and destination"
          aria-label="Swap origin and destination"
        >
          <Icon name="swap" size={16} />
        </button>
      </div>

      {/* Alerts */}
      {routeError && (
        <div className="inline-alert inline-alert-warn fade-in">
          <Icon name="alert" size={16} /><span>{routeError}</span>
        </div>
      )}
      {locationError && (
        <div className="inline-alert inline-alert-danger fade-in">
          <Icon name="alert" size={16} /><span>{locationError}</span>
        </div>
      )}

      {/* Departure time */}
      <div className="planner-block">
        <div className="section-title-row">
          <span className="section-title"><Icon name="clock" size={15} /> Departure</span>
        </div>
        <Segmented
          size="sm"
          ariaLabel="Departure time"
          options={DEPARTURE_OPTIONS}
          value={departureTime}
          onChange={onDepartureChange}
        />
      </div>

      {/* Quick presets */}
      <div className="planner-block">
        <div className="section-title-row">
          <span className="section-title"><Icon name="star" size={15} /> Quick presets</span>
        </div>
        <div className="chip-row">
          {SURAT_PRESETS.map((p) => (
            <button key={p.displayName} type="button" className="chip focus-ring" onClick={() => quick(p)}>
              <Icon name="pin" size={13} />{p.displayName}
            </button>
          ))}
        </div>
      </div>

      {/* Recent searches */}
      {recents.length > 0 && (
        <div className="planner-block">
          <div className="section-title-row">
            <span className="section-title"><Icon name="history" size={15} /> Recent</span>
            <button type="button" className="link-btn" onClick={clearRecents}>Clear</button>
          </div>
          <div className="recent-list">
            {recents.map((p, i) => (
              <button key={`${p.displayName}-${i}`} type="button" className="recent-item focus-ring" onClick={() => quick(p)}>
                <span className="recent-icon"><Icon name="history" size={15} /></span>
                <span className="recent-text">
                  <span className="recent-name">{p.displayName}</span>
                  {p.fullName && <span className="recent-full">{p.fullName}</span>}
                </span>
                <Icon name="arrowRight" size={15} className="recent-go" />
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Status hint */}
      {!bothSet && !isLoadingRoute && (
        <div className="planner-hint">
          <span className="planner-hint-step"><span className="step-num">1</span> Set an origin</span>
          <span className="planner-hint-step"><span className="step-num">2</span> Set a destination</span>
          <span className="planner-hint-step"><span className="step-num">3</span> Compare modes on the map</span>
        </div>
      )}
    </div>
  );
};

export default JourneyPlanner;
