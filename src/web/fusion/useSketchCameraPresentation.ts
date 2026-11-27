import {
  createContext, useContext, useEffect, useLayoutEffect, useMemo, useState, useSyncExternalStore,
} from 'react';
import type { RefObject } from 'react';
import type { CadSketchSupport } from '../../contracts/document';
import type { SketchDisplayFrame, SketchScreenRect } from '../viewport/SketchViewportGeometry';
import { sketchPointToClient } from '../viewport/SketchViewportGeometry';
import { resolveSketchWorkplaneProjection } from '../viewport/SketchWorkplaneProjection';
import { createSketchCameraMapping, type SketchCameraMappingReason, type SketchCameraMappingReady } from './SketchCameraMapping';
import { navigation } from './navigation';

/** A05: actual driver camera (A03) -> one affine mapping (A04) per snapshot/revision. */
export type SketchCameraPresentation =
  | { mode: 'legacy' }
  | { mode: 'camera'; ready: false; reason: SketchCameraMappingReason; aligned: false }
  | { mode: 'camera'; ready: true; revision: number; matrix: string; width: number; height: number; aligned: boolean };

export interface SketchCameraPresentationOptions {
  support: CadSketchSupport;
  stageRef: RefObject<HTMLDivElement | null>;
  frame: SketchDisplayFrame;
  applyInitialFrame(span: number): void;
}

// Normal view only: u along screen +x, v along screen -y, axis-parallel.
function normalBasisScale(ready: SketchCameraMappingReady): number | null {
  const { origin, u, v } = ready.basis;
  const ux = u.x - origin.x, uy = u.y - origin.y, vx = v.x - origin.x, vy = v.y - origin.y;
  const lu = Math.hypot(ux, uy), lv = Math.hypot(vx, vy);
  if (!(lu > 0) || !(lv > 0) || Math.abs(lu - lv) > 0.02 * lu) return null;
  if (!(ux > 0) || Math.abs(uy) > 0.02 * lu) return null;
  if (!(vy < 0) || Math.abs(vx) > 0.02 * lv) return null;
  return lu;
}

// Legacy frame-to-client must provably coincide with the actual camera.
function alignedWithFrame(ready: SketchCameraMappingReady, frame: SketchDisplayFrame, rect: SketchScreenRect): boolean {
  const probes: Array<[number, number]> = [[0, 0], [1, 0], [0, 1]];
  for (const [px, py] of probes) {
    const camera = ready.planeToClient(px, py);
    const legacy = sketchPointToClient(frame, rect, [px, py]);
    if (!camera.ok || !legacy) return false;
    if (Math.hypot(camera.x - legacy.x, camera.y - legacy.y) > 0.5) return false;
  }
  return true;
}

export function useSketchCameraPresentation(options: SketchCameraPresentationOptions): SketchCameraPresentation {
  const { support, stageRef, frame, applyInitialFrame } = options;
  const workplane = useMemo(() => resolveSketchWorkplaneProjection(support), [support]);
  const snapshot = useSyncExternalStore(navigation.subscribeCamera, navigation.cameraSnapshot, navigation.cameraSnapshot);
  const mapping = useMemo(
    () => (workplane.kind === 'origin-plane' ? createSketchCameraMapping(snapshot, workplane) : null),
    [workplane, snapshot],
  );
  const ready = mapping && mapping.ready === true ? mapping : null;

  const [rect, setRect] = useState<SketchScreenRect | null>(null);
  useLayoutEffect(() => {
    const stage = stageRef.current;
    if (!stage) return;
    const measure = () => {
      const box = stage.getBoundingClientRect();
      setRect(previous => (previous && previous.left === box.left && previous.top === box.top
        && previous.width === box.width && previous.height === box.height)
        ? previous : { left: box.left, top: box.top, width: box.width, height: box.height });
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(stage);
    window.addEventListener('resize', measure);
    window.addEventListener('scroll', measure, true);
    return () => {
      observer.disconnect();
      window.removeEventListener('resize', measure);
      window.removeEventListener('scroll', measure, true);
    };
  }, [stageRef]);

  // One normal-view initialization per actual attach or plane change; never per revision.
  const [initialized, setInitialized] = useState(false);
  const [adopted, setAdopted] = useState(false);
  useEffect(() => { setInitialized(false); setAdopted(false); }, [snapshot === null, workplane]);
  useEffect(() => {
    if (workplane.kind !== 'origin-plane' || snapshot === null || initialized) return;
    navigation.orient(workplane.normal);
    setInitialized(true);
  }, [workplane, snapshot, initialized]);

  // Safe initial aligned input only: adopt the actual framing into the 2D state once.
  useEffect(() => {
    if (adopted || !ready || !rect) return;
    const scale = normalBasisScale(ready);
    if (scale === null) return;
    const span = Math.min(rect.width, rect.height) / scale;
    if (!(span >= 2) || !(span <= 100_000)) return;
    applyInitialFrame(span);
    setAdopted(true);
  }, [adopted, ready, rect, applyInitialFrame]);

  const aligned = useMemo(
    () => (ready && rect ? alignedWithFrame(ready, frame, rect) : false),
    [ready, rect, frame],
  );

  return useMemo<SketchCameraPresentation>(() => {
    if (workplane.kind !== 'origin-plane') return { mode: 'legacy' };
    if (!ready || !rect) {
      return { mode: 'camera', ready: false, reason: mapping && mapping.ready === false ? mapping.reason : 'unavailable', aligned: false };
    }
    const { origin, u, v } = ready.basis;
    const a = u.x - origin.x, b = u.y - origin.y, c = origin.x - v.x, d = origin.y - v.y;
    const e = origin.x - rect.left, f = origin.y - rect.top;
    return {
      mode: 'camera', ready: true, revision: ready.revision,
      matrix: `matrix(${a} ${b} ${c} ${d} ${e} ${f})`,
      width: rect.width, height: rect.height, aligned,
    };
  }, [workplane.kind, ready, rect, mapping, aligned]);
}

export const SketchCameraPresentationContext = createContext<SketchCameraPresentation>({ mode: 'legacy' });

export function useSketchCameraPresentationValue(): SketchCameraPresentation {
  return useContext(SketchCameraPresentationContext);
}
