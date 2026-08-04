import { useEffect, useState } from 'react';

/**
 * Subscribe to a CSS media query. SSR-safe, updates on viewport changes.
 * @param {string} query e.g. '(max-width: 900px)'
 */
export function useMediaQuery(query) {
  const [matches, setMatches] = useState(() => {
    if (typeof window === 'undefined') return false;
    return window.matchMedia(query).matches;
  });

  useEffect(() => {
    if (typeof window === 'undefined') return undefined;
    const mql = window.matchMedia(query);
    const onChange = (e) => setMatches(e.matches);
    setMatches(mql.matches);
    mql.addEventListener('change', onChange);
    return () => mql.removeEventListener('change', onChange);
  }, [query]);

  return matches;
}

// Shared breakpoints (kept in sync with CSS)
export const useIsMobile = () => useMediaQuery('(max-width: 768px)');
export const useIsTablet = () => useMediaQuery('(min-width: 769px) and (max-width: 1100px)');
export const useIsDesktop = () => useMediaQuery('(min-width: 1101px)');
