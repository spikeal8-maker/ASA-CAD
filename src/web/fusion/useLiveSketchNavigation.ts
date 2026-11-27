import type * as React from 'react';
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { CadSketchEntity } from '../../contracts/document';
import {
  panSketchViewport, resetSketchViewportState, screenPointToSketchPoint, zoomSketchViewport,
} from '../viewport/SketchViewportGeometry';
import { registerSketchNavigation, useSketchView } from './sketchView';
import type { SketchViewCommand } from './sketchView';
import { fitSketchViewport, sketchFrameForScreen, sketchGridStep } from './sketchPresentation';

export interface LiveSketchNavigationOptions {
  sketchId: string;
  displayedEntities: readonly CadSketchEntity[];
  panMode: boolean;
  onSnapReset: () => void;
}

/** Owns the transient Fusion Sketch 2D navigation: viewport, wheel, pan and registered navigation. */
export function useLiveSketchNavigation({ sketchId, displayedEntities, panMode, onSnapReset }: LiveSketchNavigationOptions) {
  const snapEnabled = useSketchView().settings.snap;
  const stageRef = useRef<HTMLDivElement>(null);
  const [viewport, setViewport] = useState(resetSketchViewportState);
  const [stageSize, setStageSize] = useState({ width: 700, height: 700 });
  const [panning, setPanning] = useState(false);
  const pan = useRef<{ id: number; x: number; y: number } | null>(null);
  const frame = sketchFrameForScreen(viewport, stageSize);
  const step = sketchGridStep(viewport.span, Math.min(stageSize.width, stageSize.height));
  const current = useRef({ viewport, entities: displayedEntities, frame, snapEnabled, step });
  current.current = { viewport, entities: displayedEntities, frame, snapEnabled, step };

  useEffect(() => { setViewport(resetSketchViewportState()); onSnapReset(); }, [sketchId, onSnapReset]);

  useLayoutEffect(() => {
    const stage = stageRef.current;
    if (!stage) return;
    const measure = () => {
      const { width, height } = stage.getBoundingClientRect();
      if (!(width > 0 && height > 0)) return;
      setStageSize(previous => previous.width === width && previous.height === height ? previous : { width, height });
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(stage);
    const wheel = (event: WheelEvent) => {
      event.preventDefault(); event.stopPropagation();
      const state = current.current;
      const rect = stage.getBoundingClientRect();
      const anchor = screenPointToSketchPoint(state.frame, rect, event.clientX, event.clientY) ?? state.viewport.center;
      const delta = event.deltaY * (event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? rect.height : 1);
      setViewport(previous => zoomSketchViewport(previous, Math.exp(Math.max(-600, Math.min(600, delta)) * 0.0015), anchor));
      onSnapReset();
    };
    stage.addEventListener('wheel', wheel, { capture: true, passive: false });
    return () => { observer.disconnect(); stage.removeEventListener('wheel', wheel, true); };
  }, [onSnapReset]);

  useEffect(() => registerSketchNavigation((command: SketchViewCommand) => {
    onSnapReset();
    if (command === 'fit' || command === 'look-at') setViewport(fitSketchViewport(current.current.entities));
    else if (command === 'reset') setViewport(resetSketchViewportState());
    else setViewport(previous => zoomSketchViewport(previous, command === 'zoom-in' ? 0.8 : 1.25, previous.center));
  }), [onSnapReset]);

  const startPan = (event: React.PointerEvent<HTMLDivElement>) => {
    if (event.target instanceof Element && event.target.closest('input,textarea,select,button,label,[contenteditable="true"]')) return;
    if (event.button !== 1 && !(panMode && event.button === 0 && event.pointerType !== 'touch')) return;
    event.preventDefault(); event.stopPropagation();
    pan.current = { id: event.pointerId, x: event.clientX, y: event.clientY };
    event.currentTarget.setPointerCapture(event.pointerId); setPanning(true); onSnapReset();
  };
  const movePan = (event: React.PointerEvent<HTMLDivElement>) => {
    const pending = pan.current;
    if (!pending || pending.id !== event.pointerId) return;
    event.preventDefault(); event.stopPropagation();
    const dx = event.clientX - pending.x, dy = event.clientY - pending.y;
    pending.x = event.clientX; pending.y = event.clientY;
    const rect = event.currentTarget.getBoundingClientRect();
    setViewport(previous => panSketchViewport(previous, rect, dx, dy));
  };
  const endPan = (event: React.PointerEvent<HTMLDivElement>) => {
    if (pan.current?.id !== event.pointerId) return;
    event.preventDefault(); event.stopPropagation(); pan.current = null; setPanning(false);
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
  };
  const resetLostCapture = () => { pan.current = null; setPanning(false); };
  const panByArrow = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (!(event.target instanceof Element) || event.target.closest('input,textarea,select,button,[contenteditable="true"]')) return;
    const direction = { ArrowLeft: [40, 0], ArrowRight: [-40, 0], ArrowUp: [0, 40], ArrowDown: [0, -40] }[event.key];
    if (!direction || event.altKey || event.ctrlKey || event.metaKey) return;
    event.preventDefault(); event.stopPropagation();
    const rect = event.currentTarget.getBoundingClientRect();
    setViewport(previous => panSketchViewport(previous, rect, direction[0], direction[1]));
  };

  return { stageRef, viewport, setViewport, stageSize, panning, pan, frame, step, current,
    startPan, movePan, endPan, resetLostCapture, panByArrow };
}
