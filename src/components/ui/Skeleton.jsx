import React from 'react';

/**
 * Skeleton — shimmering placeholder. Compose freely; presets below cover the
 * common loading states (metric cards, list rows, the map).
 */
const Skeleton = ({ w = '100%', h = 14, r = 8, className = '', style }) => (
  <span
    className={`skeleton ${className}`}
    style={{ display: 'block', width: w, height: h, borderRadius: r, ...style }}
  />
);

export const SkeletonMetricGrid = ({ count = 4 }) => (
  <div className="metric-grid" aria-hidden="true">
    {Array.from({ length: count }).map((_, i) => (
      <div key={i} className="card card-padded metric-card">
        <Skeleton w="55%" h={11} />
        <Skeleton w="70%" h={26} style={{ marginTop: 12 }} />
        <Skeleton w="100%" h={6} r={999} style={{ marginTop: 14 }} />
      </div>
    ))}
  </div>
);

export const SkeletonRows = ({ count = 3 }) => (
  <div className="skeleton-rows" aria-hidden="true">
    {Array.from({ length: count }).map((_, i) => (
      <div key={i} className="skeleton-row">
        <Skeleton w={40} h={40} r={12} />
        <div style={{ flex: 1 }}>
          <Skeleton w="60%" h={12} />
          <Skeleton w="40%" h={10} style={{ marginTop: 8 }} />
        </div>
      </div>
    ))}
  </div>
);

export default Skeleton;
