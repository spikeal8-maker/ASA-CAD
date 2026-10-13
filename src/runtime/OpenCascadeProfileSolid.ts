import type { CadProfileLoop, CadSketchProfile } from '../application/SketchProfile';
import type { CadPoint2 } from '../contracts/document';
import { planeFramePoint, type CadSketchPlaneFrame } from '../contracts/sketchWorkplane';

/**
 * OpenCascade adapter for a validated Sketch profile placed on a plane frame.
 * Produces a prism swept along the frame normal; holes are cut as separate
 * prisms so wire orientation never decides what is material. OCC objects stay
 * inside the runtime layer.
 */
export function profilePrism(
  oc: any,
  profile: Readonly<CadSketchProfile>,
  frame: Readonly<CadSketchPlaneFrame>,
  start: number,
  length: number,
): any {
  if (!(length > 0)) throw new Error('Profile prism length must be positive');
  let solid = loopPrism(oc, profile.outer, frame, start, length);
  const margin = Math.max(length * 1e-3, 1e-3);
  for (const hole of profile.holes) {
    const tool = loopPrism(oc, hole, frame, start - margin, length + 2 * margin);
    const progress = new oc.Message_ProgressRange_1();
    const operation = new oc.BRepAlgoAPI_Cut_3(solid, tool, progress);
    operation.Build(new oc.Message_ProgressRange_1());
    if (!operation.IsDone()) throw new Error('OpenCascade could not cut a profile hole');
    solid = operation.Shape();
    operation.delete?.();
    progress.delete?.();
  }
  return solid;
}

function loopPrism(oc: any, loop: Readonly<CadProfileLoop>, frame: Readonly<CadSketchPlaneFrame>, start: number, length: number): any {
  const wire = loopWire(oc, loop, frame);
  const faceMaker = new oc.BRepBuilderAPI_MakeFace_15(wire, true);
  if (!faceMaker.IsDone()) throw new Error('OpenCascade could not build a face from the profile contour');
  let face = faceMaker.Shape();
  const [nx, ny, nz] = frame.normal;
  if (Math.abs(start) > 1e-12) face = translate(oc, face, nx * start, ny * start, nz * start);
  const vector = new oc.gp_Vec_4(nx * length, ny * length, nz * length);
  const prism = new oc.BRepPrimAPI_MakePrism_1(face, vector, false, true);
  const result = prism.Shape();
  vector.delete?.();
  faceMaker.delete?.();
  wire.delete?.();
  return result;
}

function loopWire(oc: any, loop: Readonly<CadProfileLoop>, frame: Readonly<CadSketchPlaneFrame>): any {
  const wireMaker = new oc.BRepBuilderAPI_MakeWire_1();
  const pnt = (point: CadPoint2) => new oc.gp_Pnt_3(...planeFramePoint(frame, point));
  if (loop.circle) {
    const axis = new oc.gp_Ax2_2(
      pnt(loop.circle.center),
      new oc.gp_Dir_4(...frame.normal),
      new oc.gp_Dir_4(...frame.u),
    );
    const circle = new oc.gp_Circ_2(axis, loop.circle.radius);
    wireMaker.Add_1(new oc.BRepBuilderAPI_MakeEdge_8(circle).Edge());
  } else {
    for (const segment of loop.segments) {
      const edgeMaker = segment.kind === 'line'
        ? new oc.BRepBuilderAPI_MakeEdge_3(pnt(segment.from), pnt(segment.to))
        : new oc.BRepBuilderAPI_MakeEdge_24(new oc.Handle_Geom_Curve_2(
          new oc.GC_MakeArcOfCircle_4(pnt(segment.from), pnt(segment.mid), pnt(segment.to)).Value().get(),
        ));
      if (!edgeMaker.IsDone()) throw new Error(`OpenCascade could not build profile ${segment.kind}`);
      wireMaker.Add_1(edgeMaker.Edge());
    }
  }
  if (!wireMaker.IsDone()) throw new Error('OpenCascade could not join the profile contour into one wire');
  const wire = wireMaker.Wire();
  wireMaker.delete?.();
  return wire;
}

function translate(oc: any, shape: any, x: number, y: number, z: number): any {
  const transform = new oc.gp_Trsf_1();
  const vector = new oc.gp_Vec_4(x, y, z);
  transform.SetTranslation_1(vector);
  const operation = new oc.BRepBuilderAPI_Transform_2(shape, transform, true);
  const result = operation.Shape();
  vector.delete?.();
  transform.delete?.();
  return result;
}
