import type { CadBodyId, CadFeatureId, CadSketchEntityId, CadSketchId } from '../../contracts/ids';

export type ViewportSelectionMode = 'none' | 'face' | 'edge' | 'sketch';
export type ViewportPoint3 = readonly [number, number, number];

interface ViewportPickCandidateBase {
  /** Ray distance in current viewport world units. Lower is closer. */
  distance: number;
  point: ViewportPoint3;
}

export interface ViewportBodyCandidate extends ViewportPickCandidateBase {
  kind: 'body';
  meshId: string;
  bodyId: CadBodyId;
  sourceFeatureId?: CadFeatureId;
}

export interface ViewportFaceCandidate extends ViewportPickCandidateBase {
  kind: 'face';
  meshId: string;
  bodyId?: CadBodyId;
  sourceFeatureId?: CadFeatureId;
  faceIndex: number;
}

export interface ViewportEdgeCandidate extends ViewportPickCandidateBase {
  kind: 'edge';
  meshId: string;
  bodyId?: CadBodyId;
  sourceFeatureId?: CadFeatureId;
  segmentIndex?: number;
}

/** Future M3 Sketch overlay candidate; no Three/vendor object crosses this seam. */
export interface ViewportSketchEntityCandidate extends ViewportPickCandidateBase {
  kind: 'sketch-entity';
  sketchId: CadSketchId;
  entityId: CadSketchEntityId;
}

export type ViewportPickCandidate =
  | ViewportBodyCandidate
  | ViewportFaceCandidate
  | ViewportEdgeCandidate
  | ViewportSketchEntityCandidate;

export interface ViewportPickResolution {
  primary: ViewportPickCandidate | null;
  ordered: ViewportPickCandidate[];
  /** More than one distinct semantic candidate is effectively under the cursor. */
  ambiguous: boolean;
}

/**
 * Filters candidates by the active tool, collapses duplicate triangle/segment
 * hits onto one semantic CAD target and ranks nearest first.
 */
export function resolveViewportPickCandidates(
  candidates: readonly ViewportPickCandidate[],
  mode: ViewportSelectionMode,
): ViewportPickResolution {
  const compatible = candidates.filter((candidate) => isCompatible(candidate, mode));
  const nearestByKey = new Map<string, ViewportPickCandidate>();

  for (const candidate of compatible) {
    if (!Number.isFinite(candidate.distance) || candidate.distance < 0) continue;
    const key = viewportCandidateKey(candidate);
    const current = nearestByKey.get(key);
    if (!current || candidate.distance < current.distance) nearestByKey.set(key, candidate);
  }

  const ordered = [...nearestByKey.values()].sort((a, b) => {
    const distance = a.distance - b.distance;
    return Math.abs(distance) > Number.EPSILON
      ? distance
      : viewportCandidateKey(a).localeCompare(viewportCandidateKey(b));
  });
  const primary = ordered[0] ?? null;
  if (!primary) return { primary: null, ordered, ambiguous: false };

  // A farther object behind the front target is not an ambiguity. Treat nearby
  // candidates as competing only within a small relative ray-depth band.
  const depthTolerance = Math.max(1e-6, Math.abs(primary.distance) * 0.015);
  const ambiguous = ordered.slice(1).some(
    (candidate) => Math.abs(candidate.distance - primary.distance) <= depthTolerance,
  );
  return { primary, ordered, ambiguous };
}

export function viewportCandidateKey(candidate: ViewportPickCandidate): string {
  switch (candidate.kind) {
    case 'body':
      return `body:${candidate.bodyId}`;
    case 'face':
      return `face:${candidate.meshId}:${candidate.faceIndex}`;
    case 'edge':
      return `edge:${candidate.meshId}:${candidate.segmentIndex ?? 'unknown'}`;
    case 'sketch-entity':
      return `sketch:${candidate.sketchId}:${candidate.entityId}`;
  }
}

function isCompatible(candidate: ViewportPickCandidate, mode: ViewportSelectionMode): boolean {
  if (mode === 'none') return candidate.kind === 'body';
  if (mode === 'face') return candidate.kind === 'face';
  if (mode === 'edge') return candidate.kind === 'edge';
  return candidate.kind === 'sketch-entity';
}
