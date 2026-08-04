import React from 'react';

/**
 * Card — the base elevated surface. `interactive` adds hover lift; `as` lets it
 * render as a button/section; `accent` paints a left rail in a colour.
 */
const Card = React.forwardRef(function Card(
  { as: Tag = 'div', interactive = false, accent = null, padded = true, className = '', style, children, ...rest },
  ref
) {
  return (
    <Tag
      ref={ref}
      className={[
        'card',
        interactive ? 'card-interactive focus-ring' : '',
        padded ? 'card-padded' : '',
        accent ? 'card-accented' : '',
        className,
      ].filter(Boolean).join(' ')}
      style={accent ? { '--card-accent': accent, ...style } : style}
      {...rest}
    >
      {children}
    </Tag>
  );
});

export default Card;
