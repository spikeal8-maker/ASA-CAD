import type { CadDocument, CadPartDocument } from '../contracts/document';
import type {
  CadRenderFaceGroup,
  CadRenderModel,
  CadRenderModelProvider,
} from '../contracts/render';
import { OccConverter } from '../../vendor/toubkal/src/services/OccConverter';
import type { OpenCascadePartRuntime } from './OpenCascadePartRuntime';

interface OpenCascadeRuntimeInternals {
  oc: any;
  finalShape: any | null;
}

interface RenderCacheEntry {
  runtimeRevision: number;
  deflection: number;
  model: CadRenderModel;
}

/**
 * M2 presentation adapter. Native OpenCascade and Three.js objects stay inside
 * this runtime layer; callers receive only ASA IDs plus structured-cloneable
 * typed arrays.
 *
 * OpenCascadePartRuntime intentionally kept its M1 public contract minimal. The
 * adapter therefore reads the two runtime-owned fields it needs in one isolated
 * place instead of exposing native shapes through the public product API.
 */
export class OpenCascadePartRenderAdapter implements CadRenderModelProvider {
  private cache: RenderCacheEntry | null = null;

  constructor(private readonly runtime: OpenCascadePartRuntime) {}

  getRenderModel(
    document: Readonly<CadDocument>,
    options: { deflection?: number } = {},
  ): CadRenderModel | null {
    if (document.kind !== 'part') return null;

    const analysis = this.runtime.getLastAnalysis();
    if (!analysis) return null;

    const deflection = options.deflection ?? 0.1;
    if (
      this.cache?.runtimeRevision === analysis.runtimeRevision &&
      this.cache.deflection === deflection
    ) {
      return this.cache.model;
    }

    const internals = this.runtime as unknown as OpenCascadeRuntimeInternals;
    if (!internals.oc || !internals.finalShape) return null;

    const geometry = OccConverter.shapeToThreeGeometry(
      internals.oc,
      internals.finalShape,
      deflection,
    );

    try {
      const position = geometry.getAttribute('position');
      const normal = geometry.getAttribute('normal');
      const index = geometry.getIndex();
      if (!position || !normal || !index) return null;

      const part = document as Readonly<CadPartDocument>;
      const sourceFeature = [...part.features].reverse().find((feature) => !feature.suppressed);
      const body = part.bodies.find((item) => item.visible) ?? part.bodies[0];
      const rawGroups = Array.isArray(geometry.userData.faceGroups)
        ? geometry.userData.faceGroups as Array<{ start: number; count: number; face: number }>
        : [];
      const faceGroups: CadRenderFaceGroup[] = rawGroups.map((group) => ({
        start: group.start,
        count: group.count,
        faceIndex: group.face,
      }));

      const model: CadRenderModel = {
        runtimeRevision: `occ-${analysis.runtimeRevision}`,
        bounds: { ...analysis.bounds },
        meshes: [{
          meshId: String(body?.id ?? sourceFeature?.id ?? document.documentId),
          bodyId: body?.id,
          sourceFeatureId: sourceFeature?.id,
          positions: Float32Array.from(position.array as ArrayLike<number>),
          normals: Float32Array.from(normal.array as ArrayLike<number>),
          indices: Uint32Array.from(index.array as ArrayLike<number>),
          faceGroups,
        }],
      };

      this.cache = { runtimeRevision: analysis.runtimeRevision, deflection, model };
      return model;
    } finally {
      geometry.dispose();
    }
  }
}
