import type { CadPartDocument, CadSketch, CadStableReference } from '../contracts/document';
import type { CadPlaneName } from '../contracts/commands';
import { originPlaneFrame, sketchPlaneFrame, type CadSketchPlaneFrame } from '../contracts/sketchWorkplane';
import { captureFace, resolveEdge, resolveFace, type EdgeSig, type FaceSig } from '../../vendor/toubkal/src/services/StableRef';

/** ASA validation and native retrieval around the existing StableRef resolver; no fallback matching. */
export function resolveFilletReferenceEdge(
  oc: any, target: any, reference: CadStableReference, featureName: string,
  featureShapes: ReadonlyMap<string, any>,
): any {
  const ownerId = reference.ownerFeatureId;
  if (ownerId !== undefined && !featureShapes.has(ownerId)) {
    throw new Error(featureName + ': source feature ' + ownerId + ' is not built yet');
  }
  if (reference.locator.kind !== 'edge') throw new Error('Reference ' + reference.id + ' is not an edge');
  const resolved = resolveEdge(oc, target, reference.locator as unknown as EdgeSig);
  if (resolved.rejected) {
    throw new Error(featureName + ': stable edge reference unresolved (' + (resolved.reason ?? 'ambiguous') + ')');
  }

  // StableRef.resolveEdge indexes a deduplicated map, not raw explorer occurrences.
  const map = new oc.TopTools_IndexedMapOfShape_1();
  const explorer = new oc.TopExp_Explorer_2(target, oc.TopAbs_ShapeEnum.TopAbs_EDGE, oc.TopAbs_ShapeEnum.TopAbs_SHAPE);
  try {
    while (explorer.More()) {
      const current = explorer.Current();
      try { map.Add(current); } finally { current.delete(); }
      explorer.Next();
    }
    if (resolved.index < 0 || resolved.index >= map.Extent()) {
      throw new Error(featureName + ': resolved edge ' + resolved.index + ' is unavailable');
    }
    const key = map.FindKey(resolved.index + 1);
    try { return oc.TopoDS.Edge_1(key); } finally { key.delete(); }
  } finally {
    explorer.delete();
    map.delete();
  }
}

export function resolveSketchReferenceFrame(
  oc: any, part: Readonly<CadPartDocument>, sketch: CadSketch, featureShapes: ReadonlyMap<string, any>,
): CadSketchPlaneFrame {
  if (sketch.support === 'XY' || sketch.support === 'XZ' || sketch.support === 'YZ') {
    return originPlaneFrame(sketch.support as CadPlaneName);
  }

  const reference = part.stableReferences.find(item => item.id === sketch.support);
  if (!reference) throw new Error(sketch.name + ': support reference ' + sketch.support + ' is missing');
  const ownerId = reference.ownerFeatureId;
  if (!ownerId) throw new Error(sketch.name + ': support reference has no source feature');
  const ownerShape = featureShapes.get(ownerId);
  if (!ownerShape) throw new Error(sketch.name + ': source feature ' + ownerId + ' is not built yet');
  if (reference.locator.kind !== 'face') throw new Error('Reference ' + reference.id + ' is not a face');

  const signature = reference.locator as unknown as FaceSig;
  const resolved = resolveFace(oc, ownerShape, signature);
  if (resolved.rejected) {
    throw new Error(sketch.name + ': support face unresolved (' + (resolved.reason ?? 'ambiguous') + ')');
  }
  const live = captureFace(oc, ownerShape, resolved.index);
  if (!live || live.kind !== 'face' || !live.axis) throw new Error(sketch.name + ': support face is not measurable');
  if (live.surf !== 'plane') throw new Error(sketch.name + ': only planar support is allowed');

  // Plane normals carry orientation. A geometrically close opposite face is a broken support.
  const normal = signature.axis;
  if (signature.surf === 'plane' && normal
    && normal[0] * live.axis[0] + normal[1] * live.axis[1] + normal[2] * live.axis[2] <= 0) {
    throw new Error(sketch.name + ': support face orientation changed');
  }
  return sketchPlaneFrame(live.axis, live.centroid);
}
