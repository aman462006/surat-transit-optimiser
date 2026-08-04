import React from 'react';
import { AQI_BANDS } from '../../utils/airQualityService';
import Icon from '../ui/Icon';

/**
 * ExposureCard (redesigned) — two honest layers of air-quality info:
 *  · AMBIENT   the air on the route (US-EPA AQI, live CPCB → WAQI → CAMS)
 *  · PERSONAL  what you actually inhale in the chosen mode (× microenvironment × time)
 * All data logic is preserved from the original; only the presentation changed.
 */
const SourceLine = ({ exposure }) => {
  if (exposure.source === 'cpcb') {
    return (
      <p className="exp-source ok">
        <Icon name="checkCircle" size={13} /> Live CPCB sensors{exposure.stationsUsed > 1 ? ` · ${exposure.stationsUsed} stations` : ''} — nearest <strong>{exposure.stationName}</strong>
        {exposure.stationDistanceKm != null ? ` (${exposure.stationDistanceKm} km)` : ''}
        {exposure.dominant ? ` · main ${exposure.dominant.toUpperCase()}` : ''}
      </p>
    );
  }
  if (exposure.source === 'station') {
    return (
      <p className="exp-source ok">
        <Icon name="checkCircle" size={13} /> Measured at <strong>{exposure.stationName}</strong>
        {exposure.stationDistanceKm != null ? ` · ${exposure.stationDistanceKm} km from route` : ''}
      </p>
    );
  }
  return (
    <p className="exp-source modelled">
      <Icon name="cloud" size={13} /> Modelled estimate (Copernicus CAMS) — no nearby ground station.
    </p>
  );
};

const ExposureCard = ({ exposure, modeExposure, modeName, isLoading }) => {
  if (isLoading) {
    return (
      <div className="card card-padded exp-card">
        <div className="section-title-row"><span className="section-title"><Icon name="wind" size={15} /> Pollution exposure</span></div>
        <p className="exp-loading"><span className="spinner spinner-sm" /> Measuring air quality along your route…</p>
      </div>
    );
  }
  if (!exposure || !exposure.ok) {
    return (
      <div className="card card-padded exp-card">
        <div className="section-title-row"><span className="section-title"><Icon name="wind" size={15} /> Pollution exposure</span></div>
        <p className="exp-loading">Live air-quality data is unavailable right now.</p>
      </div>
    );
  }

  const { avgAqi, peakAqi, avgPm25, avgPm10, segments, aqiClass, pm25Class, uncertaintyPct } = exposure;
  const errLabel = uncertaintyPct != null ? `±${uncertaintyPct}%` : null;

  return (
    <div className="card card-padded exp-card card-accented" style={{ '--card-accent': aqiClass.color }}>
      <div className="section-title-row">
        <span className="section-title"><Icon name="wind" size={15} /> Pollution exposure</span>
        <span className="exp-band" style={{ background: `${aqiClass.color}1f`, color: aqiClass.color, borderColor: `${aqiClass.color}66` }}>
          {aqiClass.short || aqiClass.name}
        </span>
      </div>

      <SourceLine exposure={exposure} />

      <div className="exp-grid">
        <div className="exp-metric" style={{ borderColor: `${aqiClass.color}55`, background: `${aqiClass.color}0f` }}>
          <span className="exp-metric-label">Air Quality Index</span>
          <span className="exp-metric-val tnum" style={{ color: aqiClass.color }}>{avgAqi}</span>
          <span className="exp-metric-sub">{aqiClass.name}{peakAqi > avgAqi ? ` · peak ${peakAqi}` : ''}</span>
        </div>
        <div className="exp-metric" style={{ borderColor: `${pm25Class.color}55`, background: `${pm25Class.color}0f` }}>
          <span className="exp-metric-label">PM2.5 ambient</span>
          <span className="exp-metric-val tnum" style={{ color: pm25Class.color }}>{avgPm25}</span>
          <span className="exp-metric-sub">µg/m³{errLabel ? ` · ${errLabel}` : ''}</span>
        </div>
      </div>

      <p className="exp-note">Averaged over {segments} × 500 m segments{avgPm10 != null ? ` · PM10 ≈ ${avgPm10} µg/m³` : ''}.</p>

      {modeExposure && (
        <div className="exp-dose" style={{ borderColor: `${modeExposure.pm25Class.color}44` }}>
          <div className="exp-dose-head">
            <span>Your dose in <strong>{modeName}</strong></span>
            <span className="exp-factor" style={{ color: modeExposure.pm25Class.color, borderColor: modeExposure.pm25Class.color }}>×{modeExposure.factor}</span>
          </div>
          <p className="exp-factor-note">{modeExposure.factorLabel}</p>
          <div className="exp-dose-rows">
            <div className="exp-dose-row"><span>Effective PM2.5 breathed</span><strong style={{ color: modeExposure.pm25Class.color }} className="tnum">{modeExposure.effectivePm25} µg/m³</strong></div>
            <div className="exp-dose-row"><span>Inhaled over {modeExposure.durationMins} min</span><strong className="tnum">≈ {modeExposure.inhaledPm25Ug} µg</strong></div>
            <div className="exp-dose-row"><span>Cumulative dose</span><strong className="tnum">{modeExposure.dosePm25} µg·h/m³</strong></div>
          </div>
        </div>
      )}

      <p className="exp-advice" style={{ color: aqiClass.color }}>{aqiClass.advice}</p>

      <div className="exp-legend">
        {AQI_BANDS.map((b) => (
          <div key={b.level} className="exp-legend-item">
            <span className="exp-legend-dot" style={{ background: b.color }} />
            <span className="exp-legend-name">{b.short}</span>
          </div>
        ))}
      </div>

      <p className="exp-src-foot">
        US-EPA AQI · {exposure.source === 'cpcb' ? 'CPCB live (data.gov.in)' : exposure.source === 'station' ? 'WAQI station' : 'Open-Meteo / CAMS'}
      </p>
    </div>
  );
};

export default ExposureCard;
