import { useSyncExternalStore } from 'react';

const QUERY = '(min-width: 900px)';

function subscribe(listener: () => void) {
  const media = window.matchMedia(QUERY);
  media.addEventListener('change', listener);
  return () => media.removeEventListener('change', listener);
}

/** Layout breakpoint of the same KOMPAS shell; never selects a different runtime. */
export function useKompasDesktop(): boolean {
  return useSyncExternalStore(subscribe, () => window.matchMedia(QUERY).matches, () => true);
}
