import React, { useMemo } from 'react';
import Icon from '../ui/Icon';
import Button from '../ui/Button';
import { SkeletonMetricGrid } from '../ui/Skeleton';
import MetricCard from './MetricCard';
import MeasuredErrorBadge from './MeasuredErrorBadge';
import AIDecisionCard from './AIDecisionCard';
import ModeComparisonCards from './ModeComparisonCards';
import SelectedModeDetail from './SelectedModeDetail';
import ExposureCard from './ExposureCard';
import RouteVariantCards from './RouteVariantCards';
import { comfortScore, recommendationConfidence } from '../../utils/decisionInsights';

const ROAD_MODES = ['private-car', 'auto-pool'];
const MODE_ACCENT = { 'electric-bus': 'var(--mode-brts)', 'auto-pool': 'var(--mode-auto)', 'private-car': 'var(--mode-car)' };
const SHORT = { 'electric-bus': 'BRTS', 'auto-pool': 'Auto', 'private-car': 'Car' };

const walkKmOf = (o) =>
  o?.brtsItinerary?.walkingDistanceKm != null ? o.brtsItinerary.walkingDistanceKm : (o?.walkingRequiredMeters ?? 0) / 1000;

/**
 * DecisionDashboard — the right column. Live telemetry, the AI recommendation,
 * a premium KPI grid for the selected mode, selectable comparison cards, and the
 * mode-specific detail (fare/fuel, road variants, pollution exposure).
 */
const DecisionDashboard = ({
  recommendations,
  hasRoute,
  isLoadingRoute,
  roadDistance,
  googleDuration,
  isLoadingGoogle,
  etaLabel,
  accuracy,
  selectedTransit,
  onSelectMode,
  selectedMode,
  exposureByMode,
  exposure,
  selectedModeExposure,
  isLoadingExposure,
  passengerProfile,
  onEditFare,
  onEditFuel,
  roadRouteOptions,
  selectedRouteVariant,
  onSelectVariant,
  isLoadingRouteOptions,
  onOpenComparison,
}) => {
  const ranked = recommendations || [];
  const active = selectedMode || ranked[0] || null;

  const metricBars = useMemo(() => {
    if (!ranked.length) return { time: [], cost: [], co2: [] };
    const mk = (pick) => ranked.map((o) => ({
      label: SHORT[o.id] || '—',
      value: pick(o),
      color: MODE_ACCENT[o.id],
      active: o.id === (active?.id),
    }));
    return {
      time: mk((o) => o.travelTime),
      cost: mk((o) => o.tripCost),
      co2: mk((o) => o.co2Emissions),
    };
  }, [ranked, active]);

  // ---- Empty / loading states ----
  if (!hasRoute) {
    return (
      <div className="dashboard">
        <div className="dashboard-head">
          <h2 className="dashboard-title">Decision dashboard</h2>
        </div>
        <div className="empty-block">
          <span className="empty-icon"><Icon name="sparkles" size={22} /></span>
          <h4>Plan a trip to begin</h4>
          <p>Set an origin and destination. We’ll compare BRTS, shared auto and a private-car baseline — then recommend the best option.</p>
        </div>
      </div>
    );
  }

  if (isLoadingRoute || !ranked.length) {
    return (
      <div className="dashboard">
        <div className="dashboard-head"><h2 className="dashboard-title">Decision dashboard</h2></div>
        <SkeletonMetricGrid count={4} />
      </div>
    );
  }

  const confidence = recommendationConfidence(ranked);
  const comfort = comfortScore(active);
  const dose = active ? exposureByMode?.[active.id] : null;
  const accent = MODE_ACCENT[active?.id] || 'var(--accent)';

  return (
    <div className="dashboard stagger">
      <div className="dashboard-head">
        <h2 className="dashboard-title">Decision dashboard</h2>
        <span className="dashboard-sub">For your selected route in Surat</span>
      </div>

      {/* Live telemetry */}
      <div className="telemetry-row">
        <div className="telemetry-item">
          <span className="telemetry-label">Road distance <MeasuredErrorBadge error={accuracy?.distance} /></span>
          <span className="telemetry-val tnum">{roadDistance}<span className="telemetry-unit">km</span></span>
        </div>
        <div className="telemetry-divider" />
        <div className="telemetry-item">
          <span className="telemetry-label">{etaLabel} {!isLoadingGoogle && <MeasuredErrorBadge error={accuracy?.eta} />}</span>
          <span className="telemetry-val tnum">
            {isLoadingGoogle ? <span className="spinner spinner-sm" /> : googleDuration}
            <span className="telemetry-unit">min</span>
          </span>
        </div>
      </div>

      {/* AI recommendation */}
      <AIDecisionCard ranked={ranked} exposureByMode={exposureByMode} onChoose={onSelectMode} selectedId={selectedTransit} />

      {/* KPI grid for selected mode */}
      <div className="dashboard-section">
        <div className="section-title-row">
          <span className="section-title"><Icon name="gauge" size={15} /> {active?.name} metrics</span>
        </div>
        <div className="metric-grid">
          <MetricCard icon="clock" label="Travel time" value={active.travelTime} unit="min" accent={accent} bars={metricBars.time} />
          <MetricCard icon="wallet" label="Cost" value={Math.round(active.tripCost)} unit="₹" accent={accent} bars={metricBars.cost} />
          <MetricCard icon="leaf" label="CO₂ emitted" value={active.co2Emissions} unit="kg" decimals={2} accent="var(--success)" bars={metricBars.co2} />
          <MetricCard
            icon="wind" label="PM2.5 inhaled"
            value={dose ? dose.inhaledPm25Ug : 0} unit="µg"
            decimals={0}
            accent={dose?.pm25Class?.color || 'var(--text-muted)'}
            hint={dose ? `×${dose.factor} vs walking` : 'measuring…'}
          />
          <MetricCard icon="shield" label="Comfort" value={comfort} unit="/100" accent="var(--accent)" progress={comfort / 100} progressTone="custom" />
          <MetricCard icon="footprints" label="Walking" value={walkKmOf(active)} unit="km" decimals={2} accent="var(--mode-walk)" />
          <MetricCard icon="transfer" label="Transfers" value={active.transfersRequired ?? 0} unit="" accent="var(--mode-transfer)" />
          <MetricCard icon="target" label="Confidence" value={confidence} unit="%" accent="var(--accent)" progress={confidence / 100} progressTone="custom" />
        </div>
      </div>

      {/* Comparison cards */}
      <div className="dashboard-section">
        <div className="section-title-row">
          <span className="section-title"><Icon name="scale" size={15} /> Compare all options</span>
          <button type="button" className="link-btn" onClick={onOpenComparison}>Full table</button>
        </div>
        <ModeComparisonCards ranked={ranked} selectedId={selectedTransit} onSelect={onSelectMode} exposureByMode={exposureByMode} />
      </div>

      {/* Selected mode detail */}
      {active && (
        <div className="dashboard-section">
          <div className="section-title-row">
            <span className="section-title"><Icon name={active.id === 'electric-bus' ? 'bus' : active.id === 'auto-pool' ? 'rickshaw' : 'car'} size={15} /> {active.name}</span>
          </div>
          <SelectedModeDetail mode={active} passengerProfile={passengerProfile} onEditFare={onEditFare} onEditFuel={onEditFuel} />
        </div>
      )}

      {/* Road variants (car / auto) */}
      {ROAD_MODES.includes(selectedTransit) && (
        <RouteVariantCards
          routeOptions={roadRouteOptions}
          selectedVariant={selectedRouteVariant}
          onSelectVariant={onSelectVariant}
          isLoading={isLoadingRouteOptions}
        />
      )}

      {/* Exposure */}
      <ExposureCard exposure={exposure} modeExposure={selectedModeExposure} modeName={active?.name} isLoading={isLoadingExposure} />

      <Button variant="secondary" block icon={<Icon name="scale" size={16} />} onClick={onOpenComparison}>
        Open side-by-side comparison
      </Button>
    </div>
  );
};

export default DecisionDashboard;
