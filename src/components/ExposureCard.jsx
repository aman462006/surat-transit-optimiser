import React from 'react';
import { AQI_BANDS } from '../utils/airQualityService';

/**
 * ExposureCard
 * Splits exposure into two honest layers:
 *  - AMBIENT: the air quality on the route (US-EPA AQI guideline, 6 colour bands),
 *    sourced from live CPCB stations → WAQI → CAMS model.
 *  - PERSONAL: what you actually inhale in the chosen mode, after applying that
 *    mode's microenvironment factor (open auto vs enclosed AC car/bus) × time.
 */
const Badge = ({ cls }) => (
  <span
    className={`exposure-badge exposure-${cls.level}`}
    style={{ background: `${cls.color}22`, color: cls.color, border: `1px solid ${cls.color}` }}
  >
    {cls.short || cls.name}
  </span>
);

const SourceLine = ({ exposure }) => {
  if (exposure.source === 'cpcb') {
    return (
      <p className="exposure-source-line measured">
        ✅ Live CPCB sensors{exposure.stationsUsed > 1 ? ` (${exposure.stationsUsed} stations, interpolated along route)` : ''} —
        nearest <strong>{exposure.stationName}</strong>
        {exposure.stationDistanceKm != null ? ` ${exposure.stationDistanceKm} km away` : ''}
        {exposure.measuredAt ? ` · ${exposure.measuredAt}` : ''}
        {exposure.dominant ? ` · main pollutant ${exposure.dominant.toUpperCase()}` : ''}
      </p>
    );
  }
  if (exposure.source === 'station') {
    return (
      <p className="exposure-source-line measured">
        ✅ Measured at <strong>{exposure.stationName}</strong>
        {exposure.stationDistanceKm != null ? ` · ${exposure.stationDistanceKm} km from route` : ''}
        {exposure.measuredAt ? ` · ${exposure.measuredAt}` : ''}
        {exposure.dominant ? ` · main pollutant ${exposure.dominant.toUpperCase()}` : ''}
      </p>
    );
  }
  return (
    <p className="exposure-source-line modelled">
      📡 Modelled estimate (Copernicus CAMS) — no nearby ground station.
    </p>
  );
};

const ExposureCard = ({ exposure, modeExposure, modeName, isLoading }) => {
  if (isLoading) {
    return (
      <div className="exposure-card">
        <div className="exposure-head"><span className="exposure-title">🫁 Pollution exposure</span></div>
        <p className="exposure-loading">
          <span className="spinner-mini" style={{ display: 'inline-block', verticalAlign: 'middle', marginRight: '8px' }}></span>
          Measuring air quality along your route…
        </p>
      </div>
    );
  }

  if (!exposure || !exposure.ok) {
    return (
      <div className="exposure-card">
        <div className="exposure-head"><span className="exposure-title">🫁 Pollution exposure</span></div>
        <p className="exposure-loading">Live air-quality data is unavailable right now.</p>
      </div>
    );
  }

  const { avgAqi, peakAqi, avgPm25, avgPm10, segments, aqiClass, pm25Class } = exposure;

  return (
    <div className="exposure-card" style={{ borderLeft: `4px solid ${aqiClass.color}` }}>
      <div className="exposure-head">
        <span className="exposure-title">🫁 Pollution exposure</span>
        <Badge cls={aqiClass} />
      </div>

      <SourceLine exposure={exposure} />

      {/* Ambient: the air on the route */}
      <p className="exposure-headline">
        Air on this route:{' '}
        <strong style={{ color: aqiClass.color }}>{avgAqi} AQI</strong> per 500 m
        <span className="exposure-sub"> ({segments} × 500 m segments{peakAqi > avgAqi ? `, peak ${peakAqi}` : ''})</span>
      </p>

      <div className="exposure-grid">
        <div className="exposure-metric" style={{ borderColor: aqiClass.color, background: `${aqiClass.color}14` }}>
          <span className="exposure-metric-label">Air Quality Index</span>
          <span className="exposure-metric-val" style={{ color: aqiClass.color }}>{avgAqi}</span>
          <span className="exposure-metric-unit">{aqiClass.name}</span>
          <Badge cls={aqiClass} />
        </div>
        <div className="exposure-metric" style={{ borderColor: pm25Class.color, background: `${pm25Class.color}14` }}>
          <span className="exposure-metric-label">PM2.5 (ambient)</span>
          <span className="exposure-metric-val" style={{ color: pm25Class.color }}>{avgPm25}</span>
          <span className="exposure-metric-unit">µg/m³ per 500 m</span>
          <Badge cls={pm25Class} />
        </div>
      </div>

      {/* Personal: what you actually inhale in the chosen mode */}
      {modeExposure && (
        <div className="exposure-dose" style={{ borderColor: `${modeExposure.pm25Class.color}55` }}>
          <div className="exposure-dose-head">
            <span>Your exposure in <strong>{modeName}</strong></span>
            <span className="exposure-factor-pill" style={{ color: modeExposure.pm25Class.color, borderColor: modeExposure.pm25Class.color }}>
              ×{modeExposure.factor}
            </span>
          </div>
          <p className="exposure-factor-note">{modeExposure.factorLabel}</p>
          <div className="exposure-dose-row">
            <span>Effective PM2.5 you breathe</span>
            <strong style={{ color: modeExposure.pm25Class.color }}>{modeExposure.effectivePm25} µg/m³</strong>
          </div>
          <div className="exposure-dose-row">
            <span>PM2.5 inhaled over {modeExposure.durationMins} min</span>
            <strong>≈ {modeExposure.inhaledPm25Ug} µg</strong>
          </div>
          <div className="exposure-dose-row">
            <span>Cumulative dose</span>
            <strong>{modeExposure.dosePm25} µg·h/m³</strong>
          </div>
          <p className="exposure-dose-note">
            Personal dose = ambient PM2.5 × mode factor × time. Open vehicles and longer
            trips raise it; enclosed AC modes lower it.{avgPm10 != null ? ` Ambient PM10 ≈ ${avgPm10} µg/m³.` : ''}
          </p>
        </div>
      )}

      <p className="exposure-advice" style={{ color: aqiClass.color }}>
        {aqiClass.advice}
      </p>

      {/* Official US-EPA AQI guideline — all six bands */}
      <div className="exposure-legend">
        {AQI_BANDS.map((b) => (
          <div key={b.level} className="exposure-legend-item">
            <span className="exposure-legend-dot" style={{ background: b.color }}></span>
            <span className="exposure-legend-name">{b.short}</span>
            <span className="exposure-legend-range">{b.range}</span>
          </div>
        ))}
      </div>

      <p className="exposure-source">
        Guideline: US-EPA AQI · Data: {
          exposure.source === 'cpcb' ? 'CPCB live stations (data.gov.in)'
            : exposure.source === 'station' ? 'WAQI ground station'
            : 'Open-Meteo / CAMS model'
        }
      </p>
    </div>
  );
};

export default ExposureCard;
