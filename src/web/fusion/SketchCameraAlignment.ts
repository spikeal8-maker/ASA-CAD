// A05: pure camera/frame alignment math extracted from useSketchCameraPresentation.
import type { SketchDisplayFrame, SketchScreenRect } from '../viewport/SketchViewportGeometry';
import { sketchPointToClient } from '../viewport/SketchViewportGeometry';
import type { SketchCameraMappingReady } from './SketchCameraMapping';

/** Normal view only: u along screen +x, v along screen -y, axis-parallel. */
export function normalBasisScale(ready: SketchCameraMappingReady): number | null {
  const { origin, u, v } = ready.basis;
  const ux = u.x - origin.x, uy = u.y - origin.y, vx = v.x - origin.x, vy = v.y - origin.y;
  const lu = Math.hypot(ux, uy), lv = Math.hypot(vx, vy);
  if (!(lu > 0) || !(lv > 0) || Math.abs(lu - lv) > 0.02 * lu) return null;
  if (!(ux > 0) || Math.abs(uy) > 0.02 * lu) return null;
  if (!(vy < 0) || Math.abs(vx) > 0.02 * lv) return null;
  return lu;
}

// Orthographic plane->client is affine: client = origin + (u-origin)*x + (v-origin)*y.
// The affine basis keeps all four SVG frame corners provable even when the camera
// frustum clips them (planeToClient would report 'clipped'); maximum error stays 0.5 CSS px.
export function alignedWithFrame(ready: SketchCameraMappingReady, frame: SketchDisplayFrame, rect: SketchScreenRect): boolean {
  const { origin, u, v } = ready.basis;
  const ax = u.x - origin.x, ay = u.y - origin.y, bx = v.x - origin.x, by = v.y - origin.y;
  const probes: Array<[number, number]> = [
    [0, 0], [1, 0], [0, 1],
    [frame.minX, frame.minY], [frame.maxX, frame.minY], [frame.minX, frame.maxY], [frame.maxX, frame.maxY],
  ];
  for (const [px, py] of probes) {
    const legacy = sketchPointToClient(frame, rect, [px, py]);
    if (!legacy) return false;
    if (Math.hypot(origin.x + ax * px + bx * py - legacy.x, origin.y + ay * px + by * py - legacy.y) > 0.5) return false;
  }
  return true;
}
