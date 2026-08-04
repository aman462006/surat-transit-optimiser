import React from 'react';
import Icon from '../ui/Icon';
import Badge from '../ui/Badge';
import { useCountUp } from '../../hooks/useCountUp';
import { shortModeLabel, recommendationConfidence, whyBullets, tradeoff } from '../../utils/decisionInsights';

const MODE_ICON = { 'electric-bus': 'bus', 'auto-pool': 'rickshaw', 'private-car': 'car' };

/**
 * AIDecisionCard — ChatGPT-style reasoning panel. Names the recommended mode,
 * lists why it wins, surfaces the key tradeoff, and shows a confidence gauge.
 * All content is derived from the live recommendation ranking + exposure data.
 */
const AIDecisionCard = ({ ranked, exposureByMode = {}, onChoose, selectedId }) => {
  const recommended = ranked?.[0] || null;
  const confidence = recommended ? recommendationConfidence(ranked) : 0;
  const conf = useCountUp(confidence, { duration: 800 }); // hook must run every render
  if (!recommended) return null;

  const bullets = whyBullets(recommended, ranked, exposureByMode);
  const trade = tradeoff(recommended, ranked);
  const modeIcon = MODE_ICON[recommended.id] || 'sparkles';
  const isSelected = selectedId === recommended.id;

  return (
    <div className="ai-card scale-in">
      <div className="ai-card-glow" aria-hidden="true" />
      <div className="ai-head">
        <span className="ai-chip"><Icon name="sparkles" size={13} /> AI recommendation</span>
        <Badge tone="neutral" variant="outline" size="sm">
          <Icon name="target" size={11} /> {confidence}% confidence
        </Badge>
      </div>

      <div className="ai-pick">
        <span className="ai-pick-icon"><Icon name={modeIcon} size={22} /></span>
        <div className="ai-pick-text">
          <span className="ai-pick-eyebrow">Best overall for this trip</span>
          <h3 className="ai-pick-name">{recommended.name}</h3>
        </div>
        <div className="ai-pick-figures">
          <span className="ai-fig"><b className="tnum">{recommended.travelTime}</b> min</span>
          <span className="ai-fig-sep" />
          <span className="ai-fig"><b className="tnum">₹{Math.round(recommended.tripCost)}</b></span>
        </div>
      </div>

      {bullets.length > 0 && (
        <ul className="ai-reasons">
          {bullets.map((b, i) => (
            <li key={i} style={{ animationDelay: `${0.1 + i * 0.06}s` }}>
              <Icon name="check" size={14} className="ai-reason-check" />
              <span>{b}</span>
            </li>
          ))}
        </ul>
      )}

      {trade && (
        <div className="ai-tradeoff">
          <Icon name="scale" size={14} />
          <span><b>Tradeoff.</b> {trade}</span>
        </div>
      )}

      {/* Confidence gauge */}
      <div className="ai-confidence">
        <div className="ai-conf-labels">
          <span>Recommendation confidence</span>
          <span className="ai-conf-val tnum">{conf}%</span>
        </div>
        <div className="ai-conf-track">
          <div className="ai-conf-fill" style={{ width: `${confidence}%` }} />
        </div>
      </div>

      {onChoose && (
        <button
          type="button"
          className={`ai-cta focus-ring${isSelected ? ' is-selected' : ''}`}
          onClick={() => onChoose(recommended.id)}
        >
          {isSelected ? <><Icon name="check" size={16} /> {shortModeLabel(recommended.id)} selected</>
                      : <>Choose {shortModeLabel(recommended.id)} <Icon name="arrowRight" size={16} /></>}
        </button>
      )}
    </div>
  );
};

export default AIDecisionCard;
