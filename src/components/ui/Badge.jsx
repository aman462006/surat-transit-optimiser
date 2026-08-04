import React from 'react';

/**
 * Badge / Pill.
 * tone: neutral | accent | success | warning | danger | brts | auto | car.
 * variant: soft (tinted fill) | solid | outline.
 * Accepts a `color` override (used for AQI bands / dynamic swatches).
 */
const Badge = ({
  tone = 'neutral',
  variant = 'soft',
  size = 'md',
  icon = null,
  dot = false,
  color = null,
  className = '',
  style,
  children,
}) => {
  const dynamic = color
    ? variant === 'solid'
      ? { background: color, color: '#fff', borderColor: color }
      : { background: `${color}1f`, color, borderColor: `${color}66` }
    : undefined;

  return (
    <span
      className={`badge badge-${tone} badge-${variant} badge-${size} ${className}`}
      style={{ ...dynamic, ...style }}
    >
      {dot && <span className="badge-dot" style={color ? { background: color } : undefined} />}
      {icon && <span className="badge-icon">{icon}</span>}
      {children}
    </span>
  );
};

export default Badge;
