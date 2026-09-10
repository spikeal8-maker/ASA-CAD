import type { CadDocument } from './document';
import type { CadBodyId, CadFeatureId } from './ids';

export interface CadRenderBounds {
  minX: number;
  minY: number;
  minZ: number;
  maxX: number;
  maxY: number;
  maxZ: number;
}

/** Transient face mapping for viewport picking. Never persist faceIndex. */
export interface CadRenderFaceGroup {
  start: number;
  count: number;
  faceIndex: number;
}

/**
 * Kernel-neutral tessellated body. Typed arrays are structured-cloneable and
 * can later move across a Worker boundary without exposing OCC/Three objects.
 */
export interface CadRenderMesh {
  meshId: string;
  bodyId?: CadBodyId;
  sourceFeatureId?: CadFeatureId;
  positions: Float32Array;
  normals: Float32Array;
  indices: Uint32Array;
  faceGroups: CadRenderFaceGroup[];
}

export interface CadRenderModel {
  runtimeRevision: string;
  bounds: CadRenderBounds;
  meshes: CadRenderMesh[];
}

/**
 * One transient viewport hit. `faceIndex` and `segmentIndex` are presentation
 * details only; persistent modeling commands must convert the world-space point
 * to an ASA stable reference through CadApplication.captureReference().
 */
export interface CadViewportPick {
  kind: 'face' | 'edge';
  meshId: string;
  bodyId?: CadBodyId;
  sourceFeatureId?: CadFeatureId;
  point: readonly [number, number, number];
  faceIndex?: number;
  segmentIndex?: number;
}

export interface CadRenderModelProvider {
  getRenderModel(
    document: Readonly<CadDocument>,
    options?: { deflection?: number },
  ): CadRenderModel | null;
}
