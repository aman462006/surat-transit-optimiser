import React from 'react';

/**
 * Button — variants: primary | secondary | ghost | subtle | danger.
 * sizes: sm | md | lg. Optional leading/trailing icon nodes, loading state,
 * and iconOnly (square) mode. All buttons get the accessible focus ring.
 */
const Button = React.forwardRef(function Button(
  {
    variant = 'secondary',
    size = 'md',
    icon = null,
    trailingIcon = null,
    iconOnly = false,
    loading = false,
    block = false,
    className = '',
    children,
    disabled,
    ...rest
  },
  ref
) {
  return (
    <button
      ref={ref}
      className={[
        'btn',
        `btn-${variant}`,
        `btn-${size}`,
        iconOnly ? 'btn-icon-only' : '',
        block ? 'btn-block' : '',
        loading ? 'is-loading' : '',
        'focus-ring',
        className,
      ].filter(Boolean).join(' ')}
      disabled={disabled || loading}
      {...rest}
    >
      {loading && <span className="spinner spinner-sm btn-spinner" />}
      {!loading && icon && <span className="btn-icon">{icon}</span>}
      {!iconOnly && children != null && <span className="btn-label">{children}</span>}
      {!loading && trailingIcon && <span className="btn-icon btn-icon-trailing">{trailingIcon}</span>}
    </button>
  );
});

export default Button;
