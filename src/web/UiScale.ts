export type CadUiScalePreference = 'auto' | 90 | 100 | 110 | 125 | 150;
export type CadUiScaleResolved = 90 | 100 | 110 | 125 | 150;

export const CAD_UI_SCALE_STORAGE_KEY = 'asa-cad-ui-scale';
export const CAD_UI_SCALE_OPTIONS: readonly CadUiScalePreference[] = ['auto', 90, 100, 110, 125, 150];

export interface CadUiScaleMetrics {
  width: number;
  height: number;
  dpr: number;
}

function isNumericScale(value: number): value is CadUiScaleResolved {
  return value === 90 || value === 100 || value === 110 || value === 125 || value === 150;
}

export function parseUiScalePreference(value: string | null | undefined): CadUiScalePreference | null {
  if (!value) return null;
  const normalized = value.trim().toLocaleLowerCase('en-US');
  if (normalized === 'auto') return 'auto';
  const numeric = Number(normalized.replace('%', ''));
  return isNumericScale(numeric) ? numeric : null;
}

/**
 * Conservative Auto policy from DISPLAY_LAYOUT_SPEC. Effective CSS viewport
 * drives the choice; physical 4K/DPR alone never causes a second scale pass.
 */
export function resolveUiScale(
  preference: CadUiScalePreference,
  metrics: CadUiScaleMetrics,
): CadUiScaleResolved {
  if (preference !== 'auto') return preference;

  // Height protection wins over large width. A short/compact viewport must not
  // auto-grow chrome merely because it is ultrawide.
  if (metrics.height < 900) return 100;

  if (metrics.width >= 3200 && metrics.dpr <= 1.25 && metrics.height >= 1400) return 125;
  if (metrics.width >= 2400 && metrics.height >= 1100) return 110;
  return 100;
}

export function readStoredUiScale(storage: Pick<Storage, 'getItem'> = window.localStorage): CadUiScalePreference {
  try {
    return parseUiScalePreference(storage.getItem(CAD_UI_SCALE_STORAGE_KEY)) ?? 'auto';
  } catch {
    return 'auto';
  }
}

export function writeStoredUiScale(
  preference: CadUiScalePreference,
  storage: Pick<Storage, 'setItem'> = window.localStorage,
): void {
  try {
    storage.setItem(CAD_UI_SCALE_STORAGE_KEY, String(preference));
  } catch {
    // Storage can be unavailable in private/embedded contexts. UI scale still
    // applies to the current session; persistence is best-effort.
  }
}

export interface CadUiScaleController {
  getPreference(): CadUiScalePreference;
  getResolved(): CadUiScaleResolved;
  setPreference(preference: CadUiScalePreference): void;
  dispose(): void;
}

export function installUiScaleController(): CadUiScaleController {
  const params = new URLSearchParams(window.location.search);
  const queryOverride = parseUiScalePreference(params.get('uiScale'));
  let preference: CadUiScalePreference = queryOverride ?? readStoredUiScale();
  let resolved: CadUiScaleResolved = 100;

  const apply = () => {
    resolved = resolveUiScale(preference, {
      width: window.innerWidth,
      height: window.innerHeight,
      dpr: window.devicePixelRatio || 1,
    });
    document.documentElement.dataset.uiScaleMode = String(preference);
    document.documentElement.dataset.uiScale = String(resolved);
    document.documentElement.style.setProperty('--ui-scale-factor', String(resolved / 100));
    // Base shell declares :root { font-size: 14px }. Keep the user scale token
    // authoritative without CSS transforms: inline font-size references the
    // current token and therefore tracks 90/100/110/125/150 data-state rules.
    document.documentElement.style.fontSize = 'var(--ui-root-font)';
  };

  const onResize = () => {
    if (preference === 'auto') apply();
  };

  apply();
  window.addEventListener('resize', onResize, { passive: true });

  return {
    getPreference: () => preference,
    getResolved: () => resolved,
    setPreference(next) {
      preference = next;
      // A query override is test/debug-only. Explicit runtime changes are real
      // user choices and become the persisted preference.
      writeStoredUiScale(next);
      apply();
      window.dispatchEvent(new CustomEvent('asa-cad-ui-scale-change', {
        detail: { preference, resolved },
      }));
    },
    dispose() {
      window.removeEventListener('resize', onResize);
    },
  };
}

declare global {
  interface Window {
    __ASA_CAD_UI_SCALE__?: CadUiScaleController;
  }
}
