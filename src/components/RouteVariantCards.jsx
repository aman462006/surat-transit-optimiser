import React from 'react';

/**
 * RouteVariantCards
 * Shown for open-road modes (car / auto) where more than one road corridor
 * exists. Presents three selectable paths side by side:
 *   • Fastest      — least travel time
 *   • Cleanest Air — least PM2.5 exposure dose along the way
 *   • Balanced     — time, distance and exposure weighted equally
 *
 * Selecting a card redraws that path on the map and updates the exposure panel.
 * When every corridor passes through near-identical air, a note says so rather
 * than implying a meaningful "cleaner" choice exists.
 */

const VARIANTS = [
  { key: 'fastest',  icon: '⚡', title: 'Fastest',      blurb: 'Least time' },
  { key: 'cleanest', icon: '🫁', title: 'Cleanest Air', blurb: 'Lowest PM2.5 air' },
  { key: 'balanced', icon: '⚖️', title: 'Balanced',     blurb: '½ time · ½ air' }
];

const RouteVariantCards = ({ routeOptions, selectedVariant, onSelectVariant, isLoading }) => {
  if (isLoading) {
    return (
      <div className="variant-cards">
        <div className="variant-cards-head">
          <span className="variant-cards-title">🛣️ Road route options</span>
        </div>
        <p className="variant-loading">
          <span className="spinner-mini" style={{ display: 'inline-block', verticalAlign: 'middle', marginRight: '8px' }}></span>
          Comparing road corridors for cleaner air…
        </p>
      </div>
    );
  }

  if (!routeOptions || !routeOptions.options || routeOptions.options.length < 2) {
    return null; // nothing to compare — only one viable road route
  }

  const { options, fastestIdx, cleanestIdx, balancedIdx, negligible } = routeOptions;
  const idxFor = { fastest: fastestIdx, cleanest: cleanestIdx, balanced: balancedIdx };

  // When the air barely differs between corridors, the 50/50 time+air score is
  // dominated by travel time, so Balanced lands on the same route as Fastest.
  // Surface exactly why, so identical cards don't read as a bug.
  const balancedMatchesFastest = balancedIdx === fastestIdx;
  const fastestConc = options[fastestIdx]?.ambient?.avgPm25;
  const cleanestConc = options[cleanestIdx]?.ambient?.avgPm25;
  const airGap = (fastestConc != null && cleanestConc != null)
    ? Math.max(0, +(fastestConc - cleanestConc).toFixed(1))
    : null;

  return (
    <div className="variant-cards">
      <div className="variant-cards-head">
        <span className="variant-cards-title">🛣️ Road route options</span>
        <span className="variant-cards-sub">{options.length} routes explored (BFS)</span>
      </div>

      <div className="variant-card-grid">
        {VARIANTS.map((v) => {
          const opt = options[idxFor[v.key]];
          if (!opt) return null;
          const pm = opt.ambient?.pm25Class;
          const swatch = pm?.color || '#94a3b8';
          const isActive = selectedVariant === v.key;

          return (
            <button
              key={v.key}
              type="button"
              className={`variant-card${isActive ? ' active' : ''}`}
              style={isActive ? { borderColor: swatch, boxShadow: `0 0 0 2px ${swatch}55` } : undefined}
              onClick={() => onSelectVariant(v.key)}
            >
              <div className="variant-card-head">
                <span className="variant-card-icon">{v.icon}</span>
                <span className="variant-card-title">{v.title}</span>
              </div>
              <span className="variant-card-blurb">{v.blurb}</span>

              <div className="variant-card-metrics">
                <div className="variant-metric">
                  <span className="variant-metric-val">{opt.durationMins}</span>
                  <span className="variant-metric-unit">min</span>
                </div>
                <div className="variant-metric">
                  <span className="variant-metric-val">{opt.distanceKm}</span>
                  <span className="variant-metric-unit">km</span>
                </div>
                <div className="variant-metric">
                  <span className="variant-metric-val" style={{ color: swatch }}>
                    {opt.ambient ? opt.ambient.avgPm25 : '—'}
                  </span>
                  <span className="variant-metric-unit">
                    PM2.5{opt.ambient?.uncertaintyPct != null ? ` ±${opt.ambient.uncertaintyPct}%` : ''}
                  </span>
                </div>
              </div>

              <div className="variant-card-pm" style={{ background: `${swatch}1a`, color: swatch }}>
                <span className="variant-pm-dot" style={{ background: swatch }}></span>
                {opt.ambient ? `${pm?.short || pm?.name} air` : 'air data unavailable'}
              </div>
            </button>
          );
        })}
      </div>

      {balancedMatchesFastest ? (
        <p className="variant-note">
          ℹ️ <strong>Balanced is showing the same route as Fastest.</strong> That's because the
          air barely differs between corridors{airGap != null ? ` — the cleanest is only ~${airGap} µg/m³ lower in PM2.5` : ''}.
          With time and air weighted 50/50, such a small air gap can't outweigh the time saved, so the
          quickest route also wins on balance. When routes run through more varied air, Balanced will pick a different corridor.
        </p>
      ) : negligible && (
        <p className="variant-note">
          ℹ️ These corridors pass through similar air — the exposure difference is minimal here.
          Pick on time or distance.
        </p>
      )}
    </div>
  );
};

export default RouteVariantCards;
