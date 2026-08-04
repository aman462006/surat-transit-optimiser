import { useCallback, useState } from 'react';

const KEY = 'sto-recent-searches';
const MAX = 6;

const read = () => {
  try {
    const raw = localStorage.getItem(KEY);
    const arr = raw ? JSON.parse(raw) : [];
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
};

/**
 * Persisted recent place selections (deduped by displayName, newest first).
 * Each entry: { displayName, fullName, lat, lng }.
 */
export function useRecentSearches() {
  const [recents, setRecents] = useState(read);

  const addRecent = useCallback((place) => {
    if (!place || place.lat == null || place.lng == null) return;
    setRecents((prev) => {
      const entry = {
        displayName: place.displayName || place.fullName || 'Saved place',
        fullName: place.fullName || '',
        lat: place.lat,
        lng: place.lng,
      };
      const next = [entry, ...prev.filter((p) => p.displayName !== entry.displayName)].slice(0, MAX);
      try { localStorage.setItem(KEY, JSON.stringify(next)); } catch { /* noop */ }
      return next;
    });
  }, []);

  const clearRecents = useCallback(() => {
    setRecents([]);
    try { localStorage.removeItem(KEY); } catch { /* noop */ }
  }, []);

  return { recents, addRecent, clearRecents };
}

/** A few well-known Surat destinations offered as one-tap presets. */
export const SURAT_PRESETS = [
  { displayName: 'Surat Railway Station', fullName: 'Railway Station Rd, Surat', lat: 21.2049, lng: 72.8411 },
  { displayName: 'Dumas Beach', fullName: 'Dumas, Surat', lat: 21.0870, lng: 72.7108 },
  { displayName: 'VR Surat Mall', fullName: 'Dumas Rd, Magdalla, Surat', lat: 21.1490, lng: 72.7735 },
  { displayName: 'SVNIT', fullName: 'Ichchhanath, Surat', lat: 21.1670, lng: 72.7830 },
  { displayName: 'Surat Airport', fullName: 'Magdalla, Surat', lat: 21.1140, lng: 72.7418 },
  { displayName: 'Adajan', fullName: 'Adajan, Surat', lat: 21.1959, lng: 72.7933 },
];
