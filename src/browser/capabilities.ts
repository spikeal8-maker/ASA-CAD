export type CadCapabilityTier = 'full' | 'constrained' | 'unsupported';

export interface CadBrowserCapabilityEnvironment {
  webAssembly: boolean;
  sharedArrayBuffer: boolean;
  crossOriginIsolated: boolean;
  webgl: boolean;
  webgl2: boolean;
  hardwareConcurrency?: number;
  deviceMemoryGb?: number;
  touchPoints?: number;
}

export interface CadBrowserCapabilityResult {
  tier: CadCapabilityTier;
  supported: boolean;
  reasons: string[];
  warnings: string[];
  features: CadBrowserCapabilityEnvironment;
}

/**
 * Current imported runtime requirements. This is intentionally separated from
 * responsive layout: a narrow phone can be capable, and a large old desktop can
 * be unsupported.
 */
export function evaluateCadCapabilities(
  features: CadBrowserCapabilityEnvironment,
): CadBrowserCapabilityResult {
  const reasons: string[] = [];
  const warnings: string[] = [];

  if (!features.webAssembly) reasons.push('WebAssembly is unavailable');
  if (!features.webgl) reasons.push('WebGL is unavailable');

  // Current pinned OpenCascade/Toubkal browser build requires SAB isolation.
  if (!features.sharedArrayBuffer) reasons.push('SharedArrayBuffer is unavailable');
  if (!features.crossOriginIsolated) reasons.push('CAD route is not cross-origin isolated');

  if (reasons.length > 0) {
    return { tier: 'unsupported', supported: false, reasons, warnings, features };
  }

  if (!features.webgl2) warnings.push('WebGL2 unavailable; rendering compatibility may be reduced');
  if (features.hardwareConcurrency !== undefined && features.hardwareConcurrency < 4) {
    warnings.push(`Only ${features.hardwareConcurrency} logical CPU threads reported`);
  }
  if (features.deviceMemoryGb !== undefined && features.deviceMemoryGb < 4) {
    warnings.push(`Only ${features.deviceMemoryGb} GB device memory reported`);
  }

  return {
    tier: warnings.length > 0 ? 'constrained' : 'full',
    supported: true,
    reasons,
    warnings,
    features,
  };
}

export function probeCurrentBrowserCapabilities(): CadBrowserCapabilityResult {
  if (typeof window === 'undefined' || typeof document === 'undefined' || typeof navigator === 'undefined') {
    return evaluateCadCapabilities({
      webAssembly: typeof WebAssembly !== 'undefined',
      sharedArrayBuffer: typeof SharedArrayBuffer !== 'undefined',
      crossOriginIsolated: false,
      webgl: false,
      webgl2: false,
    });
  }

  const canvas = document.createElement('canvas');
  let webgl2 = false;
  let webgl = false;
  try {
    webgl2 = Boolean(canvas.getContext('webgl2'));
    webgl = webgl2 || Boolean(canvas.getContext('webgl')) || Boolean(canvas.getContext('experimental-webgl'));
  } catch {
    webgl = false;
    webgl2 = false;
  }

  const nav = navigator as Navigator & { deviceMemory?: number };
  return evaluateCadCapabilities({
    webAssembly: typeof WebAssembly !== 'undefined',
    sharedArrayBuffer: typeof SharedArrayBuffer !== 'undefined',
    crossOriginIsolated: window.crossOriginIsolated === true,
    webgl,
    webgl2,
    hardwareConcurrency: nav.hardwareConcurrency || undefined,
    deviceMemoryGb: typeof nav.deviceMemory === 'number' ? nav.deviceMemory : undefined,
    touchPoints: typeof nav.maxTouchPoints === 'number' ? nav.maxTouchPoints : undefined,
  });
}
