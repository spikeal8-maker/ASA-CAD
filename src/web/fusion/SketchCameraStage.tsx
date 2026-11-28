import React, { useCallback, useEffect, useRef } from 'react';
import type { Dispatch, ReactNode, RefObject, SetStateAction } from 'react';
import type { CadSketchSupport } from '../../contracts/document';
import type { CadRenderModel } from '../../contracts/render';
import type { SketchDisplayFrame, SketchViewportState } from '../viewport/SketchViewportGeometry';
import { DEFAULT_SKETCH_VIEWPORT_STATE } from '../viewport/SketchViewportGeometry';
import { SketchViewportFrameProvider } from '../viewport/SketchViewportFrameContext';
import {
  SketchCameraPresentationContext, useSketchCameraPresentation,
  type SketchCameraPresentation,
} from './useSketchCameraPresentation';
import { registerSketchMutationReadiness } from '../SketchMutationReadiness';

/** A05: local-space bounding box of the visible client rectangle (bounded grid count). */
export function visibleLocalBounds(camera: { a: number; b: number; c: number; d: number; e: number; f: number; width: number; height: number }) {
  const det = camera.a * camera.d - camera.b * camera.c;
  if (!(Math.abs(det) > 1e-12)) return null;
  const A = camera.d / det, B = -camera.b / det, C = -camera.c / det, D = camera.a / det;
  const E = (camera.c * camera.f - camera.e * camera.d) / det, F = (camera.b * camera.e - camera.a * camera.f) / det;
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
  for (const [x, y] of [[0, 0], [camera.width, 0], [0, camera.height], [camera.width, camera.height]]) {
    const lx = A * x + B * y + E, ly = C * x + D * y + F;
    if (lx < minX) minX = lx; if (lx > maxX) maxX = lx;
    if (ly < minY) minY = ly; if (ly > maxY) maxY = ly;
  }
  return { minX, maxX, minY, maxY };
}

/** A05: compact presentation state for the stage marker and browser tests. */
export function cameraPresentationData(presentation: SketchCameraPresentation): string {
  if (presentation.mode === 'legacy') return 'legacy';
  if (!presentation.ready) return `not-ready:${presentation.reason}`;
  return `ready:${presentation.revision}:${presentation.aligned ? 'aligned' : 'gated'}`;
}

/**
 * A05 stage provider: camera context + shared frame. For an empty model the
 * redundant 3D reference visuals are suppressed by CSS while the actual canvas
 * and driver stay alive, real and navigable; a body keeps its world rendering.
 */
export function SketchCameraPresentationProvider(props: {
  value: SketchCameraPresentation;
  frame: SketchDisplayFrame;
  children?: ReactNode;
}) {
  return <SketchCameraPresentationContext.Provider value={props.value}>
    <SketchViewportFrameProvider frame={props.frame}>
      {props.children}
      <style>{`.live-sketch-field[data-model-empty="true"] .cad-viewport-canvas{visibility:hidden}`}</style>
    </SketchViewportFrameProvider>
  </SketchCameraPresentationContext.Provider>;
}

/**
 * A05: stage camera wiring; adopts the actual framing into the 2D state once,
 * only from the default reset. A05 v2: registers the live readiness getter for
 * the shared mutation gate, keyed by actual document + sketch identity; the
 * getter reads the current presentation at each attempt (not a cached Boolean),
 * and a stale cleanup token never removes a newer attachment.
 */
export function useSketchCameraStage(options: {
  support: CadSketchSupport;
  renderModel: CadRenderModel | null;
  stageRef: RefObject<HTMLDivElement | null>;
  frame: SketchDisplayFrame;
  setViewport: Dispatch<SetStateAction<SketchViewportState>>;
  documentId?: string;
  sketchId?: string;
}): { presentation: SketchCameraPresentation; renderModel: CadRenderModel | null } {
  const applyInitialFrame = useCallback((span: number) => {
    options.setViewport(previous => {
      if (previous.center[0] !== DEFAULT_SKETCH_VIEWPORT_STATE.center[0]
        || previous.center[1] !== DEFAULT_SKETCH_VIEWPORT_STATE.center[1]
        || previous.span !== DEFAULT_SKETCH_VIEWPORT_STATE.span) return previous;
      const next = Math.min(100_000, Math.max(2, span));
      return next === previous.span ? previous : { center: [0, 0], span: next };
    });
  }, [options.setViewport]);
  const presentation = useSketchCameraPresentation({ support: options.support, stageRef: options.stageRef, frame: options.frame, applyInitialFrame });
  const latest = useRef(presentation);
  latest.current = presentation;
  useEffect(() => {
    const { documentId, sketchId } = options;
    if (!documentId || !sketchId) return;
    return registerSketchMutationReadiness(documentId, sketchId, () => {
      const current = latest.current;
      return current.mode === 'legacy'
        || (current.mode === 'camera' && current.ready ? current.aligned : false);
    });
  }, [options.documentId, options.sketchId]);
  return { presentation, renderModel: options.renderModel };
}
