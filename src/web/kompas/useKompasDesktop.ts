import { useSyncExternalStore } from 'react';

const QUERY = '(min-width: 900px)';

function subscribe(listener: () => void) {
  const media = window.matchMedia(QUERY);
  media.addEventListener('change', listener);
  return () => media.removeEventListener('change', listener);
}

/** Desktop widths use the KOMPAS shell of the frozen reference; phones keep the compact shell. */
export function useKompasDesktop(): boolean {
  return useSyncExternalStore(subscribe, () => window.matchMedia(QUERY).matches, () => true);
}
