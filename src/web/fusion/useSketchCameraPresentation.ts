import {
  createContext, useContext, useEffect, useLayoutEffect, useMemo, useRef, useState, useSyncExternalStore,
} from 'react';
import type { RefObject } from 'react';
import type { CadSketchSupport } from '../../contracts/document';
import type { SketchDisplayFrame, SketchScreenRect } from '../viewport/SketchViewportGeometry';
import { resolveSketchWorkplaneProjection } from '../viewport/SketchWorkplaneProjection';
import { createSketchCameraMapping, type SketchCameraMappingReason } from './SketchCameraMapping';
import { alignedWithFrame, normalBasisScale } from './SketchCameraAlignment';
import { navigation } from './navigation';

/** A05: actual driver camera (A03) -> one affine mapping (A04) per snapshot/revision. */
export type SketchCameraPresentation =
  | { mode: 'legacy' }
  | { mode: 'camera'; ready: false; reason: SketchCameraMappingReason; aligned: false }
  | { mode: 'camera'; ready: true; revision: number; matrix: string; a: number; b: number; c: number; d: number; e: number; f: number; width: number; height: number; aligned: boolean };

export interface SketchCameraPresentationOptions {
  support: CadSketchSupport;
  stageRef: RefObject<HTMLDivElement | null>;
  frame: SketchDisplayFrame;
  applyInitialFrame(span: number): void;
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

  // One normal-view init per attach/plane change, never per revision: a ref set before
  // the action survives the synchronous store re-render (a pending setState would not).
  const oriented = useRef(false);
  const adopted = useRef(false);
  const stage = stageRef.current;
  useEffect(() => { oriented.current = false; adopted.current = false; }, [stage, snapshot === null, workplane]);
  useEffect(() => {
    if (workplane.kind !== 'origin-plane' || snapshot === null || oriented.current) return;
    oriented.current = true;
    navigation.orient(workplane.normal);
  }, [workplane, snapshot]);
  // Safe initial aligned input only: adopt the actual framing into the 2D state once.
  useEffect(() => {
    if (adopted.current || !ready || !rect) return;
    const scale = normalBasisScale(ready);
    if (scale === null) return;
    const span = Math.min(rect.width, rect.height) / scale;
    if (!(span >= 2) || !(span <= 100_000)) return;
    adopted.current = true;
    applyInitialFrame(span);
  }, [ready, rect, applyInitialFrame]);

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
      matrix: `matrix(${a} ${b} ${c} ${d} ${e} ${f})`, a, b, c, d, e, f,
      width: rect.width, height: rect.height, aligned,
    };
  }, [workplane.kind, ready, rect, mapping, aligned]);
}

export const SketchCameraPresentationContext = createContext<SketchCameraPresentation>({ mode: 'legacy' });

export function useSketchCameraPresentationValue(): SketchCameraPresentation {
  return useContext(SketchCameraPresentationContext);
}
