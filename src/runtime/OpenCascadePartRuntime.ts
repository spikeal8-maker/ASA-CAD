import type {
  CadDimension,
  CadDocument,
  CadFeature,
  CadPartDocument,
  CadSketch,
  CadSketchEntity,
  CadSketchLineEntity,
  CadStableReference,
} from '../contracts/document';
import type { CadFeatureId, CadSketchEntityId, CadSketchId } from '../contracts/ids';
import type {
  CadReferenceCaptureRequest,
  CadRuntimeAdapter,
  CadRuntimeDiagnostic,
  CadRuntimeRecomputeResult,
  CadRuntimeReferenceCaptureResult,
} from '../contracts/runtime';
import {
  captureEdge,
  captureFace,
  captureFaceAtPoint,
  captureVertex,
  resolveEdge,
  resolveFace,
  type EdgeSig,
  type FaceSig,
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

interface SketchPlane {
  z: number;
  normal: readonly [number, number, number];
}

interface RectangleProfile {
  centerX: number;
  centerY: number;
  width: number;
  height: number;
}

interface CircleProfile {
  centerX: number;
  centerY: number;
  diameter: number;
}

function finiteNumber(value: unknown, label: string): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) throw new Error(`${label} must be a finite number`);
  return value;
}

function tuple2(value: unknown, label: string): readonly [number, number] {
  if (!Array.isArray(value) || value.length < 2) throw new Error(`${label} must be a 2D tuple`);
  return [finiteNumber(value[0], `${label}[0]`), finiteNumber(value[1], `${label}[1]`)];
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
    const sketchId = String(feature.parameters.sketchId) as CadSketchId;
    const sketch = this.requireSketch(part, sketchId);
    const plane = this.resolveSketchPlane(part, sketch);
    if (Math.abs(plane.normal[2]) < 0.999) {
      throw new Error('M1 protected extrude currently supports XY-parallel sketch planes only');
    }
    const profile = this.rectangleProfile(part, sketch);
    const distance = finiteNumber(feature.parameters.distance, `${feature.name}.distance`);
    if (distance <= 0) throw new Error(`${feature.name}: distance must be positive`);

    const wire = this.rectangleWire(profile, plane.z);
    const faceMaker = new this.oc.BRepBuilderAPI_MakeFace_15(wire, true);
    const symmetric = Boolean(feature.parameters.symmetric);
    const reverse = Boolean(feature.parameters.reverse);
    const startZ = symmetric ? plane.z - distance / 2 : reverse ? plane.z - distance : plane.z;
    const baseFace = faceMaker.Shape();
    const translatedFace = Math.abs(startZ - plane.z) > 1e-9
      ? this.translate(baseFace, 0, 0, startZ - plane.z)
      : baseFace;
    const vector = new this.oc.gp_Vec_4(0, 0, distance);
    const prism = new this.oc.BRepPrimAPI_MakePrism_1(translatedFace, vector, false, true);
    const result = prism.Shape();
    vector.delete?.();
    faceMaker.delete?.();
    wire.delete?.();
    return result;
  }

  private evaluateCutExtrude(part: CadPartDocument, feature: CadFeature, target: any): any {
    const sketchId = String(feature.parameters.sketchId) as CadSketchId;
    const sketch = this.requireSketch(part, sketchId);
    this.resolveSketchPlane(part, sketch); // validates persistent face support when used
    const circle = this.circleProfile(part, sketch);
    const targetBounds = this.bounds(target);
    const radius = circle.diameter / 2;

    let z0: number;
    let depth: number;
    if (feature.parameters.end === 'through-all') {
      z0 = targetBounds.minZ - 1;
      depth = targetBounds.maxZ - targetBounds.minZ + 2;
    } else {
      depth = finiteNumber(feature.parameters.distance, `${feature.name}.distance`);
      if (depth <= 0) throw new Error(`${feature.name}: blind distance must be positive`);
      z0 = targetBounds.maxZ - depth;
    }

    const cylinderMaker = new this.oc.BRepPrimAPI_MakeCylinder_1(radius, depth);
    const tool = this.translate(cylinderMaker.Shape(), circle.centerX, circle.centerY, z0);
    const operation = new this.oc.BRepAlgoAPI_Cut_3(target, tool, new this.oc.Message_ProgressRange_1());
    operation.Build(new this.oc.Message_ProgressRange_1());
    if (!operation.IsDone()) throw new Error(`${feature.name}: OpenCascade cut failed`);
    const result = operation.Shape();
    cylinderMaker.delete?.();
    tool.delete?.();
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
      const edgeSignature = this.edgeSignature(reference);
      const resolved = resolveEdge(this.oc, target, edgeSignature);
      if (resolved.rejected) {
        throw new Error(`${feature.name}: stable edge reference unresolved (${resolved.reason ?? 'ambiguous'})`);
      }
      const edge = this.nthEdge(target, resolved.index);
      if (!edge) throw new Error(`${feature.name}: resolved edge ${resolved.index} is unavailable`);
      operation.Add_2(radius, edge);
      edge.delete?.();
    }

    operation.Build(new this.oc.Message_ProgressRange_1());
    if (!operation.IsDone()) throw new Error(`${feature.name}: OpenCascade fillet failed`);
    return operation.Shape();
  }

  private resolveSketchPlane(part: CadPartDocument, sketch: CadSketch): SketchPlane {
    if (sketch.support === 'XY') return { z: 0, normal: [0, 0, 1] };
    if (sketch.support === 'XZ' || sketch.support === 'YZ') {
      throw new Error(`M1 protected runtime does not yet evaluate ${sketch.support} sketches`);
    }

    const reference = part.stableReferences.find((item) => item.id === sketch.support);
    if (!reference) throw new Error(`${sketch.name}: support reference ${sketch.support} is missing`);
    const ownerId = reference.ownerFeatureId;
    if (!ownerId) throw new Error(`${sketch.name}: support reference has no source feature`);
    const ownerShape = this.featureShapes.get(ownerId);
    if (!ownerShape) throw new Error(`${sketch.name}: source feature ${ownerId} is not built yet`);

    const faceSignature = this.faceSignature(reference);
    const resolved = resolveFace(this.oc, ownerShape, faceSignature);
    if (resolved.rejected) {
      throw new Error(`${sketch.name}: support face unresolved (${resolved.reason ?? 'ambiguous'})`);
    }
    const live = captureFace(this.oc, ownerShape, resolved.index);
    if (!live || live.kind !== 'face' || !live.axis) throw new Error(`${sketch.name}: support face is not measurable`);
    if (live.surf !== 'plane') throw new Error(`${sketch.name}: only planar support is allowed`);
    return { z: live.centroid[2], normal: live.axis };
  }

  private rectangleProfile(part: CadPartDocument, sketch: CadSketch): RectangleProfile {
    const rectangle = sketch.entities
      .filter((entity): entity is CadSketchLineEntity => entity.type === 'line' && String(entity.data.role ?? '').startsWith('rectangle-edge-'))
      .sort((a, b) => String(a.data.role).localeCompare(String(b.data.role)));
    if (rectangle.length !== 4) throw new Error(`${sketch.name}: M1 extrude requires one rectangle profile`);

    const points: Array<readonly [number, number]> = [];
    for (const entity of rectangle) {
      points.push(tuple2(entity.data.from, `${entity.id}.from`));
      points.push(tuple2(entity.data.to, `${entity.id}.to`));
    }
    const xs = points.map((point) => point[0]);
    const ys = points.map((point) => point[1]);
    const minX = Math.min(...xs);
    const maxX = Math.max(...xs);
    const minY = Math.min(...ys);
    const maxY = Math.max(...ys);
    const centerX = (minX + maxX) / 2;
    const centerY = (minY + maxY) / 2;

    const horizontalIds = rectangle
      .filter((entity) => ['rectangle-edge-0', 'rectangle-edge-2'].includes(String(entity.data.role)))
      .map((entity) => entity.id);
    const verticalIds = rectangle
      .filter((entity) => ['rectangle-edge-1', 'rectangle-edge-3'].includes(String(entity.data.role)))
      .map((entity) => entity.id);

    const widthDimension = this.findDrivingDimension(part, sketch, horizontalIds, 'width');
    const heightDimension = this.findDrivingDimension(part, sketch, verticalIds, 'height');
    const width = widthDimension?.value ?? maxX - minX;
    const height = heightDimension?.value ?? maxY - minY;
    if (width <= 0 || height <= 0) throw new Error(`${sketch.name}: rectangle dimensions must be positive`);

    return { centerX, centerY, width, height };
  }

  private circleProfile(part: CadPartDocument, sketch: CadSketch): CircleProfile {
    const circle = sketch.entities.find((entity) => entity.type === 'circle');
    if (!circle) throw new Error(`${sketch.name}: M1 cut requires one circle`);
    const center = tuple2(circle.data.center, `${circle.id}.center`);
    const diameterDimension = this.findDrivingDimension(part, sketch, [circle.id], 'diameter');
    const diameter = diameterDimension?.value ?? finiteNumber(circle.data.diameter, `${circle.id}.diameter`);
    if (diameter <= 0) throw new Error(`${sketch.name}: circle diameter must be positive`);
    return { centerX: center[0], centerY: center[1], diameter };
  }

  private findDrivingDimension(
    part: CadPartDocument,
    sketch: CadSketch,
    entityIds: CadSketchEntityId[],
    preferredName: string,
  ): CadDimension | undefined {
    const ids = new Set(sketch.dimensionIds);
    return part.dimensions.find((dimension) =>
      ids.has(dimension.id)
      && dimension.driving
      && (dimension.name === preferredName || dimension.entityIds.some((id) => entityIds.includes(id))),
    );
  }

  private rectangleWire(profile: RectangleProfile, z: number): any {
    const halfW = profile.width / 2;
    const halfH = profile.height / 2;
    const points = [
      [profile.centerX - halfW, profile.centerY - halfH, z],
      [profile.centerX + halfW, profile.centerY - halfH, z],
      [profile.centerX + halfW, profile.centerY + halfH, z],
      [profile.centerX - halfW, profile.centerY + halfH, z],
    ] as const;
    const polygon = new this.oc.BRepBuilderAPI_MakePolygon_1();
    for (const [x, y, pz] of points) {
      const point = new this.oc.gp_Pnt_3(x, y, pz);
      polygon.Add_1(point);
      point.delete?.();
    }
    polygon.Close();
    const wire = polygon.Wire();
    polygon.delete?.();
    return wire;
  }

  private translate(shape: any, x: number, y: number, z: number): any {
    const transform = new this.oc.gp_Trsf_1();
    const vector = new this.oc.gp_Vec_4(x, y, z);
    transform.SetTranslation_1(vector);
    const operation = new this.oc.BRepBuilderAPI_Transform_2(shape, transform, true);
    const result = operation.Shape();
    vector.delete?.();
    transform.delete?.();
    return result;
  }

  private bounds(shape: any): RuntimeBounds {
    const result: RuntimeBounds = {
      minX: Infinity,
      minY: Infinity,
      minZ: Infinity,
      maxX: -Infinity,
      maxY: -Infinity,
      maxZ: -Infinity,
    };
    const explorer = new this.oc.TopExp_Explorer_2(
      shape,
      this.oc.TopAbs_ShapeEnum.TopAbs_VERTEX,
      this.oc.TopAbs_ShapeEnum.TopAbs_SHAPE,
    );
    while (explorer.More()) {
      const vertex = this.oc.TopoDS.Vertex_1(explorer.Current());
      const point = this.oc.BRep_Tool.Pnt(vertex);
      result.minX = Math.min(result.minX, point.X());
      result.minY = Math.min(result.minY, point.Y());
      result.minZ = Math.min(result.minZ, point.Z());
      result.maxX = Math.max(result.maxX, point.X());
      result.maxY = Math.max(result.maxY, point.Y());
      result.maxZ = Math.max(result.maxZ, point.Z());
      point.delete?.();
      vertex.delete?.();
      explorer.Next();
    }
    explorer.delete?.();
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

  private nthEdge(shape: any, index: number): any | null {
    const explorer = new this.oc.TopExp_Explorer_2(
      shape,
      this.oc.TopAbs_ShapeEnum.TopAbs_EDGE,
      this.oc.TopAbs_ShapeEnum.TopAbs_SHAPE,
    );
    let current = 0;
    while (explorer.More()) {
      if (current === index) {
        const edge = this.oc.TopoDS.Edge_1(explorer.Current());
        explorer.delete?.();
        return edge;
      }
      current++;
      explorer.Next();
    }
    explorer.delete?.();
    return null;
  }

  private edgeSignature(reference: CadStableReference): EdgeSig {
    if (reference.locator.kind !== 'edge') throw new Error(`Reference ${reference.id} is not an edge`);
    return reference.locator as unknown as EdgeSig;
  }

  private faceSignature(reference: CadStableReference): FaceSig {
    if (reference.locator.kind !== 'face') throw new Error(`Reference ${reference.id} is not a face`);
    return reference.locator as unknown as FaceSig;
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
