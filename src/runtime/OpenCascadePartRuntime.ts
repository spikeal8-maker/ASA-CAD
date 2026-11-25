import type {
  CadDocument,
  CadFeature,
  CadPartDocument,
  CadSketch,
} from '../contracts/document';
import type { CadFeatureId, CadSketchId } from '../contracts/ids';
import { buildSketchProfile, CadSketchProfileError, type CadSketchProfile } from '../application/SketchProfile';
import { profilePrism } from './OpenCascadeProfileSolid';
import { resolveFilletReferenceEdge, resolveSketchReferenceFrame } from './OpenCascadeReferenceResolver';
import type {
  CadReferenceCaptureRequest,
  CadRuntimeAdapter,
  CadRuntimeDiagnostic,
  CadRuntimeRecomputeResult,
  CadRuntimeReferenceCaptureResult,
} from '../contracts/runtime';
import {
  captureEdge,
  captureFaceAtPoint,
  captureVertex,
} from '../../vendor/toubkal/src/services/StableRef';

interface RuntimeBounds {
  minX: number;
  minY: number;
  minZ: number;
  maxX: number;
  maxY: number;
  maxZ: number;
}

export interface OpenCascadePartAnalysis {
  bounds: RuntimeBounds;
  volume: number;
  featureCount: number;
  runtimeRevision: number;
}


function finiteNumber(value: unknown, label: string): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) throw new Error(`${label} must be a finite number`);
  return value;
}

function distance3(a: readonly number[], b: readonly number[]): number {
  return Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
}

/**
 * First ASA-owned concrete runtime adapter. It intentionally implements only the
 * protected M1 Part slice. OCC objects remain private to this class.
 */
export class OpenCascadePartRuntime implements CadRuntimeAdapter {
  private readonly oc: any;
  private featureShapes = new Map<string, any>();
  private finalShape: any | null = null;
  private runtimeRevision = 0;
  private lastAnalysis: OpenCascadePartAnalysis | null = null;
  private disposed = false;

  constructor(openCascade: any) {
    if (!openCascade) throw new Error('OpenCascade instance is required');
    this.oc = openCascade;
  }

  getLastAnalysis(): Readonly<OpenCascadePartAnalysis> | null {
    return this.lastAnalysis;
  }

  async recompute(document: Readonly<CadDocument>): Promise<CadRuntimeRecomputeResult> {
    this.assertAlive();
    this.clearShapes();

    if (document.kind !== 'part') {
      return {
        ok: false,
        diagnostics: [{
          severity: 'error',
          code: 'M1_RUNTIME_PART_ONLY',
          message: `M1 OpenCascade runtime currently supports Part only, got ${document.kind}`,
        }],
      };
    }

    const diagnostics: CadRuntimeDiagnostic[] = [];
    try {
      let currentShape: any | null = null;
      for (const feature of document.features) {
        if (feature.suppressed) continue;
        currentShape = this.evaluateFeature(document, feature, currentShape);
        this.featureShapes.set(feature.id, currentShape);
      }

      this.finalShape = currentShape;
      this.runtimeRevision++;
      if (currentShape) {
        this.lastAnalysis = {
          bounds: this.bounds(currentShape),
          volume: this.volume(currentShape),
          featureCount: document.features.filter((feature) => !feature.suppressed).length,
          runtimeRevision: this.runtimeRevision,
        };
      } else {
        this.lastAnalysis = null;
      }

      return {
        ok: true,
        diagnostics,
        runtimeRevision: `occ-${this.runtimeRevision}`,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      diagnostics.push({ severity: 'error', code: 'M1_RECOMPUTE_FAILED', message });
      this.finalShape = null;
      this.lastAnalysis = null;
      return { ok: false, diagnostics };
    }
  }

  async captureReference(
    document: Readonly<CadDocument>,
    request: CadReferenceCaptureRequest,
  ): Promise<CadRuntimeReferenceCaptureResult> {
    this.assertAlive();
    if (document.kind !== 'part') throw new Error('M1 reference capture currently supports Part only');

    let shape = this.featureShapes.get(request.sourceFeatureId);
    if (!shape) {
      const rebuilt = await this.recompute(document);
      if (!rebuilt.ok) throw new Error(rebuilt.diagnostics[0]?.message ?? 'Cannot rebuild source feature');
      shape = this.featureShapes.get(request.sourceFeatureId);
    }
    if (!shape) throw new Error(`No runtime shape for feature ${request.sourceFeatureId}`);

    let locator: Record<string, unknown> | null = null;
    if (request.kind === 'face') {
      const signature = captureFaceAtPoint(this.oc, shape, [...request.point] as [number, number, number]);
      if (signature) locator = { ...signature };
    } else if (request.kind === 'edge') {
      const index = this.nearestEdgeIndex(shape, request.point);
      const signature = index >= 0 ? captureEdge(this.oc, shape, index) : null;
      if (signature) locator = { ...signature };
    } else {
      const index = this.nearestVertexIndex(shape, request.point);
      const signature = index >= 0 ? captureVertex(this.oc, shape, index) : null;
      if (signature) locator = { ...signature };
    }

    if (!locator) throw new Error(`Could not capture ${request.kind} reference on feature ${request.sourceFeatureId}`);

    return {
      ownerFeatureId: request.sourceFeatureId,
      semanticRole: request.semanticRole,
      locator,
    };
  }

  dispose(): void {
    if (this.disposed) return;
    this.clearShapes();
    this.disposed = true;
  }

  private evaluateFeature(part: CadPartDocument, feature: CadFeature, currentShape: any | null): any {
    switch (feature.type) {
      case 'extrude':
        return this.evaluateExtrude(part, feature);
      case 'cut-extrude':
        if (!currentShape) throw new Error(`${feature.name}: cut has no target body`);
        return this.evaluateCutExtrude(part, feature, currentShape);
      case 'fillet':
        if (!currentShape) throw new Error(`${feature.name}: fillet has no target body`);
        return this.evaluateFillet(part, feature, currentShape);
      default:
        throw new Error(`M1 runtime does not implement feature type ${feature.type}`);
    }
  }

  private evaluateExtrude(part: CadPartDocument, feature: CadFeature): any {
    const sketch = this.requireSketch(part, String(feature.parameters.sketchId) as CadSketchId);
    const frame = resolveSketchReferenceFrame(this.oc, part, sketch, this.featureShapes);
    const profile = this.sketchProfile(sketch);
    const distance = finiteNumber(feature.parameters.distance, `${feature.name}.distance`);
    if (distance <= 0) throw new Error(`${feature.name}: distance must be positive`);
    const symmetric = Boolean(feature.parameters.symmetric);
    const reverse = Boolean(feature.parameters.reverse);
    const start = symmetric ? -distance / 2 : reverse ? -distance : 0;
    return profilePrism(this.oc, profile, frame, start, distance);
  }

  private evaluateCutExtrude(part: CadPartDocument, feature: CadFeature, target: any): any {
    const sketch = this.requireSketch(part, String(feature.parameters.sketchId) as CadSketchId);
    const frame = resolveSketchReferenceFrame(this.oc, part, sketch, this.featureShapes);
    const profile = this.sketchProfile(sketch);
    let tool: any;
    if (feature.parameters.end === 'through-all') {
      const b = this.bounds(target);
      const span = Math.hypot(b.maxX - b.minX, b.maxY - b.minY, b.maxZ - b.minZ)
        + Math.hypot(...frame.origin) + Math.hypot((b.minX + b.maxX) / 2, (b.minY + b.maxY) / 2, (b.minZ + b.maxZ) / 2) + 2;
      tool = profilePrism(this.oc, profile, frame, -span, 2 * span);
    } else {
      // Blind cut removes material from the Sketch plane against its normal.
      const depth = finiteNumber(feature.parameters.distance, `${feature.name}.distance`);
      if (depth <= 0) throw new Error(`${feature.name}: blind distance must be positive`);
      tool = profilePrism(this.oc, profile, frame, -depth, depth);
    }
    const operation = new this.oc.BRepAlgoAPI_Cut_3(target, tool, new this.oc.Message_ProgressRange_1());
    operation.Build(new this.oc.Message_ProgressRange_1());
    if (!operation.IsDone()) throw new Error(`${feature.name}: OpenCascade cut failed`);
    const result = operation.Shape();
    operation.delete?.();
    return result;
  }

  private evaluateFillet(part: CadPartDocument, feature: CadFeature, target: any): any {
    const radius = finiteNumber(feature.parameters.radius, `${feature.name}.radius`);
    if (radius <= 0) throw new Error(`${feature.name}: radius must be positive`);
    if (feature.inputReferences.length === 0) throw new Error(`${feature.name}: no stable edge references`);

    const filletShape = this.oc.ChFi3d_FilletShape?.ChFi3d_Rational ?? 0;
    const operation = new this.oc.BRepFilletAPI_MakeFillet(target, filletShape);

    for (const referenceId of feature.inputReferences) {
      const reference = part.stableReferences.find((item) => item.id === referenceId);
      if (!reference) throw new Error(`${feature.name}: missing stable reference ${referenceId}`);
      const edge = resolveFilletReferenceEdge(this.oc, target, reference, feature.name, this.featureShapes);
      operation.Add_2(radius, edge);
      edge.delete?.();
    }

    operation.Build(new this.oc.Message_ProgressRange_1());
    if (!operation.IsDone()) throw new Error(`${feature.name}: OpenCascade fillet failed`);
    return operation.Shape();
  }

  /** Profile from solved Sketch geometry (SolvedSketchPartRuntimeAdapter runs the solver first). */
  private sketchProfile(sketch: CadSketch): CadSketchProfile {
    try {
      return buildSketchProfile(sketch);
    } catch (error) {
      if (error instanceof CadSketchProfileError) throw new Error(`${sketch.name}: ${error.message}`);
      throw error;
    }
  }

  /** Exact analytic bounds (arcs/cylinders included), not just vertex positions. */
  private bounds(shape: any): RuntimeBounds {
    const box = new this.oc.Bnd_Box_1();
    this.oc.BRepBndLib.AddOptimal(shape, box, false, false);
    const min = box.CornerMin();
    const max = box.CornerMax();
    const result = { minX: min.X(), minY: min.Y(), minZ: min.Z(), maxX: max.X(), maxY: max.Y(), maxZ: max.Z() };
    min.delete?.();
    max.delete?.();
    box.delete?.();
    return result;
  }

  private volume(shape: any): number {
    const properties = new this.oc.GProp_GProps_1();
    this.oc.BRepGProp.VolumeProperties_1(shape, properties, true, false, false);
    const result = properties.Mass();
    properties.delete?.();
    return result;
  }

  private nearestEdgeIndex(shape: any, point: readonly [number, number, number]): number {
    let bestIndex = -1;
    let bestDistance = Infinity;
    for (let index = 0; index < 2048; index++) {
      const signature = captureEdge(this.oc, shape, index);
      if (!signature) break;
      const distance = distance3(signature.mid, point);
      if (distance < bestDistance) {
        bestDistance = distance;
        bestIndex = index;
      }
    }
    return bestIndex;
  }

  private nearestVertexIndex(shape: any, point: readonly [number, number, number]): number {
    let bestIndex = -1;
    let bestDistance = Infinity;
    for (let index = 0; index < 4096; index++) {
      const signature = captureVertex(this.oc, shape, index);
      if (!signature) break;
      const distance = distance3(signature.pos, point);
      if (distance < bestDistance) {
        bestDistance = distance;
        bestIndex = index;
      }
    }
    return bestIndex;
  }

  private requireSketch(part: CadPartDocument, id: CadSketchId): CadSketch {
    const sketch = part.sketches.find((item) => item.id === id);
    if (!sketch) throw new Error(`Runtime cannot find sketch ${id}`);
    return sketch;
  }

  private clearShapes(): void {
    const seen = new Set<any>();
    for (const shape of this.featureShapes.values()) {
      if (shape && !seen.has(shape)) {
        seen.add(shape);
        try { shape.delete?.(); } catch { /* best effort WASM wrapper cleanup */ }
      }
    }
    if (this.finalShape && !seen.has(this.finalShape)) {
      try { this.finalShape.delete?.(); } catch { /* best effort */ }
    }
    this.featureShapes.clear();
    this.finalShape = null;
  }

  private assertAlive(): void {
    if (this.disposed) throw new Error('OpenCascadePartRuntime is disposed');
  }
}
