import React from 'react';
import Icon from '../ui/Icon';
import Badge from '../ui/Badge';
import { prosCons, shortModeLabel } from '../../utils/decisionInsights';

const MODE_ICON = { 'electric-bus': 'bus', 'auto-pool': 'rickshaw', 'private-car': 'car' };
const MODE_TONE = { 'electric-bus': 'brts', 'auto-pool': 'auto', 'private-car': 'car' };
const MODE_ACCENT = { 'electric-bus': 'var(--mode-brts)', 'auto-pool': 'var(--mode-auto)', 'private-car': 'var(--mode-car)' };

const buildCo2 = (o) => {
  const r = o?.co2EmissionsRange;
  if (Array.isArray(r) && r.length === 2) return `${r[0].toFixed(1)}–${r[1].toFixed(1)}`;
  return `${o?.co2Emissions ?? '—'}`;
};

/**
 * ModeComparisonCards — the three travel options as premium, selectable cards.
 * The AI pick carries a "Recommended" ribbon and lifted styling. Each card shows
 * headline metrics, per-mode PM2.5 dose (when available) and quick pros/cons.
 */
const ModeComparisonCards = ({ ranked, selectedId, onSelect, exposureByMode = {} }) => {
  if (!ranked?.length) return null;
  const recommendedId = ranked[0].id;

  return (
    <div className="compare-cards stagger">
      {ranked.map((o) => {
        const isRec = o.id === recommendedId;
        const isSel = o.id === selectedId;
        const tone = MODE_TONE[o.id] || 'neutral';
        const accent = MODE_ACCENT[o.id] || 'var(--accent)';
        const dose = exposureByMode[o.id];
        const { pros, cons } = prosCons(o, ranked);

        return (
          <button
            type="button"
            key={o.id}
            className={`compare-card focus-ring${isSel ? ' selected' : ''}${isRec ? ' recommended' : ''}`}
            style={{ '--mode-accent': accent }}
            onClick={() => onSelect(o.id)}
            aria-pressed={isSel}
          >
            {isRec && <span className="compare-ribbon"><Icon name="sparkles" size={11} /> Recommended</span>}

            <div className="compare-card-head">
              <span className="compare-icon"><Icon name={MODE_ICON[o.id] || 'car'} size={20} /></span>
              <div className="compare-title">
                <span className="compare-name">{shortModeLabel(o.id)}</span>
                <span className="compare-full">{o.name}</span>
              </div>
              {isSel && <span className="compare-check"><Icon name="checkCircle" size={18} /></span>}
            </div>

            <div className="compare-metrics">
              <div className="compare-metric">
                <span className="cm-val tnum">{o.travelTime}</span>
                <span className="cm-unit">min</span>
              </div>
              <div className="compare-metric">
                <span className="cm-val tnum">₹{Math.round(o.tripCost)}</span>
                <span className="cm-unit">{o.id === 'private-car' ? 'fuel' : o.id === 'auto-pool' ? 'shared' : 'fare'}</span>
              </div>
              <div className="compare-metric">
                <span className="cm-val tnum">{buildCo2(o)}</span>
                <span className="cm-unit">kg CO₂</span>
              </div>
              <div className="compare-metric">
                {dose ? (
                  <>
                    <span className="cm-val tnum" style={{ color: dose.pm25Class?.color }}>{dose.inhaledPm25Ug}</span>
                    <span className="cm-unit">µg PM2.5</span>
                  </>
                ) : (
                  <>
                    <span className="cm-val tnum">{o.transfersRequired ?? 0}</span>
                    <span className="cm-unit">transfers</span>
                  </>
                )}
              </div>
            </div>

            {(pros.length > 0 || cons.length > 0) && (
              <div className="compare-proscons">
                {pros.map((p) => (
                  <span key={p} className="pc-item pc-pro"><Icon name="check" size={12} />{p}</span>
                ))}
                {cons.map((c) => (
                  <span key={c} className="pc-item pc-con"><Icon name="minus" size={12} />{c}</span>
                ))}
              </div>
            )}

            <span className="compare-select-hint">
              {isSel ? 'Showing on map' : <>Select <Icon name="arrowRight" size={13} /></>}
            </span>
          </button>
        );
      })}
    </div>
  );
};

export default ModeComparisonCards;
