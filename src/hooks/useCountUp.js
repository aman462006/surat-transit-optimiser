import { useEffect, useRef, useState } from 'react';

/**
 * Animate a number from its previous value to `value` with an ease-out curve.
 * GPU-free (text only), respects reduced-motion, and returns a formatted string.
 *
 * @param {number} value    target number
 * @param {object} opts
 * @param {number} opts.duration  ms (default 600)
 * @param {number} opts.decimals  fixed decimals (default inferred: 0)
 * @returns {string} the current formatted value
 */
export function useCountUp(value, { duration = 600, decimals = 0 } = {}) {
  const [display, setDisplay] = useState(value || 0);
  const fromRef = useRef(value || 0);
  const rafRef = useRef(null);

  useEffect(() => {
    const prefersReduced =
      typeof window !== 'undefined' &&
      window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

    const target = Number(value) || 0;
    const from = fromRef.current;

    if (prefersReduced || from === target) {
      fromRef.current = target;
      setDisplay(target);
      return undefined;
    }

    const start = performance.now();
    const tick = (now) => {
      const p = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - p, 3); // easeOutCubic
      const current = from + (target - from) * eased;
      setDisplay(current);
      if (p < 1) {
        rafRef.current = requestAnimationFrame(tick);
      } else {
        fromRef.current = target;
      }
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
  }, [value, duration]);

  const n = Number(display) || 0;
  return decimals > 0 ? n.toFixed(decimals) : String(Math.round(n));
}
