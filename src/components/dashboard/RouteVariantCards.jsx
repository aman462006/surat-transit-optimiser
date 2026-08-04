import React from 'react';
import Icon from '../ui/Icon';

/**
 * RouteVariantCards (redesigned) — for open-road modes (car/auto), three
 * selectable corridors: Fastest, Cleanest Air, Balanced. Data + copy logic is
 * preserved from the original; presentation matches the new system.
 */
const VARIANTS = [
  { key: 'fastest', icon: 'zap', title: 'Fastest', blurb: 'Least time' },
  { key: 'cleanest', icon: 'wind', title: 'Cleanest', blurb: 'Lowest PM2.5' },
  { key: 'balanced', icon: 'scale', title: 'Balanced', blurb: '½ time · ½ air' },
];

const RouteVariantCards = ({ routeOptions, selectedVariant, onSelectVariant, isLoading }) => {
  if (isLoading) {
    return (
      <div className="card card-padded variants">
        <div className="section-title-row"><span className="section-title"><Icon name="route" size={15} /> Road route options</span></div>
        <p className="exp-loading"><span className="spinner spinner-sm" /> Comparing corridors for cleaner air…</p>
      </div>
    );
  }
  if (!routeOptions || !routeOptions.options || routeOptions.options.length < 2) return null;

  const { options, fastestIdx, cleanestIdx, balancedIdx, negligible } = routeOptions;
  const idxFor = { fastest: fastestIdx, cleanest: cleanestIdx, balanced: balancedIdx };

  const allSame = cleanestIdx === fastestIdx && balancedIdx === fastestIdx;
  const balancedMatchesFastest = balancedIdx === fastestIdx;
  const fastestConc = options[fastestIdx]?.ambient?.avgPm25;
  const cleanestConc = options[cleanestIdx]?.ambient?.avgPm25;
  const airGap = fastestConc != null && cleanestConc != null ? Math.max(0, +(fastestConc - cleanestConc).toFixed(1)) : null;

  return (
    <div className="card card-padded variants">
      <div className="section-title-row">
        <span className="section-title"><Icon name="route" size={15} /> Road route options</span>
        <span className="section-caption">{options.length} explored</span>
      </div>

      <div className="variant-grid">
        {VARIANTS.map((v) => {
          const opt = options[idxFor[v.key]];
          if (!opt) return null;
          const swatch = opt.ambient?.pm25Class?.color || 'var(--text-muted)';
          const active = selectedVariant === v.key;
          return (
            <button
              key={v.key}
              type="button"
              className={`variant-btn focus-ring${active ? ' active' : ''}`}
              style={active ? { borderColor: swatch, boxShadow: `0 0 0 2px ${swatch}44` } : undefined}
              onClick={() => onSelectVariant(v.key)}
            >
              <span className="variant-btn-head">
                <Icon name={v.icon} size={14} /><span className="variant-btn-title">{v.title}</span>
              </span>
              <span className="variant-btn-blurb">{v.blurb}</span>
              <span className="variant-btn-metrics">
                <span><b className="tnum">{opt.durationMins}</b> min</span>
                <span><b className="tnum">{opt.distanceKm}</b> km</span>
              </span>
              <span className="variant-btn-air" style={{ background: `${swatch}1a`, color: swatch }}>
                <span className="variant-air-dot" style={{ background: swatch }} />
                {opt.ambient ? `${opt.ambient.avgPm25} PM2.5` : 'no air data'}
              </span>
            </button>
          );
        })}
      </div>

      {allSame ? (
        <p className="inline-alert inline-alert-info variant-note">
          <Icon name="info" size={14} /><span><strong>All three are the same route here.</strong> A cleaner detour would add distance for {airGap != null ? `~${airGap} µg/m³` : 'negligible'} less PM2.5. On longer trips they’ll differ.</span>
        </p>
      ) : balancedMatchesFastest ? (
        <p className="inline-alert inline-alert-info variant-note">
          <Icon name="info" size={14} /><span><strong>Balanced matches Fastest</strong> — air barely differs{airGap != null ? ` (cleanest only ~${airGap} µg/m³ lower)` : ''}, so the quicker route also wins on balance.</span>
        </p>
      ) : negligible ? (
        <p className="inline-alert inline-alert-info variant-note">
          <Icon name="info" size={14} /><span>These corridors pass through similar air — pick on time or distance.</span>
        </p>
      ) : null}
    </div>
  );
};

export default RouteVariantCards;
