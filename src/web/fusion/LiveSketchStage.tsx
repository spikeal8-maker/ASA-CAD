import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import type { CadPoint2 } from '../../contracts/document';
import type { SketchEditingStageProps } from '../SketchEditingStage';
import { CadViewport } from '../CadViewport';
import { SketchDirectToolLayers } from '../SketchDirectToolLayers';
import { SketchSolveStatus } from '../SketchSolveStatus';
import { useActiveSketchSolveOverlay } from '../useActiveSketchSolveOverlay';
import { useSketchEntityDrag } from '../useSketchEntityDrag';
import { SketchSelectionLayer } from '../viewport/SketchSelectionLayer';
import { SketchViewportFrameProvider } from '../viewport/SketchViewportFrameContext';
import {
  panSketchViewport, resetSketchViewportState, screenPointToSketchPoint,
  zoomSketchViewport,
} from '../viewport/SketchViewportGeometry';
import { resolveSketchWorkplaneProjection } from '../viewport/SketchWorkplaneProjection';
import {
  publishSketchView, registerSketchCompute, registerSketchNavigation, useSketchView,
} from './sketchView';
import type { SketchViewCommand } from './sketchView';
import {
  fitSketchViewport, resolveSketchSnap, sketchDisplayOverlay, sketchFrameForScreen,
  sketchGridStep, sketchPointMarks, sketchProfilePath,
} from './sketchPresentation';
import type { SketchSnap } from './sketchPresentation';
import { SketchGridLayers, SketchAnnotationLayers } from './SketchDisplayLayers';
import { LiveLineInput, handleLiveLineKey, resolveLiveLinePointer } from './LiveLineInput';
import { liveLineInteraction, registerLiveLineSolver } from './LiveLineInteraction';
import type { LiveLineSnap } from './LiveLineInteraction';

export type { SketchEditingStageProps };
/** Fusion stage; editing, drag preview, solving and entities keep their shared owners. */
export function SketchEditingStage(props: SketchEditingStageProps) {
  const view = useSketchView();
  const lineInteraction = useSyncExternalStore(liveLineInteraction.subscribe, liveLineInteraction.getSnapshot);
  const [lineSettled, setLineSettled] = useState<{ sketchId: string; revision: number } | null>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const [viewport, setViewport] = useState(resetSketchViewportState);
  const [stageSize, setStageSize] = useState({ width: 700, height: 700 });
  const [snap, setSnap] = useState<SketchSnap | LiveLineSnap | null>(null);
  const [panning, setPanning] = useState(false);
  const pan = useRef<{ id: number; x: number; y: number } | null>(null);
  const selectionEnabled = props.activeCommand === null && !view.panMode;
  useEffect(() => { setViewport(resetSketchViewportState()); setSnap(null); }, [props.activeSketch.id]);
  useEffect(() => {
    setSnap(null);
    const line = liveLineInteraction.getSnapshot();
    liveLineInteraction.setPointerContext({ point: line.to ?? [0, 0], snap: null });
  }, [props.activeCommand, props.activeSketch.id, view.settings.snap, view.settings.construction]);
  const solve = useActiveSketchSolveOverlay({
    document: props.document, sketch: props.activeSketch, active: true, revisionToken: props.revisionToken,
  });
  const drag = useSketchEntityDrag({
    part: props.document, sketch: props.activeSketch,
    selectedEntityId: props.selectedSketchEntityId, enabled: selectionEnabled,
    previewCandidate: solve.previewCandidate, restorePersistedPreview: solve.restorePersistedPreview,
    commit: props.onSketchEntityTranslate, onRejected: props.onSketchDragRejected,
  });
  const lineSolveState = useRef({ document: props.document, sketch: props.activeSketch,
    revision: props.revisionToken, restore: solve.restorePersistedPreview });
  lineSolveState.current = { document: props.document, sketch: props.activeSketch,
    revision: props.revisionToken, restore: solve.restorePersistedPreview };
  const lineSolveMounted = useRef(true);
  useEffect(() => { lineSolveMounted.current = true; return () => { lineSolveMounted.current = false; }; }, []);
  const lineFingerprint = (value: typeof lineSolveState.current) => JSON.stringify([
    value.sketch.entities,
    value.document.constraints.filter(item => value.sketch.constraintIds.includes(item.id)),
    value.document.dimensions.filter(item => value.sketch.dimensionIds.includes(item.id)),
  ]);
  const settleLineSolve = useCallback(async () => {
    for (let attempt = 0; attempt < 4; attempt += 1) {
      await new Promise<void>(resolve => requestAnimationFrame(() => resolve()));
      if (!lineSolveMounted.current) throw new Error('Рабочая плоскость эскиза закрыта');
      const before = lineSolveState.current, fingerprint = lineFingerprint(before);
      // Reuse the sole active SketchSolveSession. The awaited request is bound
      // to document identity, complete sketch intent and the observed revision.
      const snapshot = await before.restore();
      const after = lineSolveState.current;
      if (!lineSolveMounted.current) throw new Error('Рабочая плоскость эскиза закрыта');
      if (after.document !== before.document || after.sketch.id !== before.sketch.id
        || after.revision !== before.revision || lineFingerprint(after) !== fingerprint
        || snapshot.status === 'solving') continue;
      if (snapshot.status === 'solved' && snapshot.converged && snapshot.sketchId === before.sketch.id) {
        setLineSettled({ sketchId: before.sketch.id, revision: before.revision });
      } else setLineSettled(null);
      return snapshot;
    }
    throw new Error('Решение эскиза изменилось во время построения. Дождитесь завершения расчёта');
  }, []);
  useLayoutEffect(() => registerLiveLineSolver(props.activeSketch.id, settleLineSolve),
    [props.activeSketch.id, settleLineSolve]);
  const lineReady = props.activeSketch.entities.length === 0
    || (lineSettled?.sketchId === props.activeSketch.id && lineSettled.revision === props.revisionToken);
  useEffect(() => {
    if (props.activeCommand !== 'sketch.line' || lineInteraction.committing || lineReady) return;
    void settleLineSolve().catch(error => {
      if (lineSolveMounted.current) props.onSketchDragRejected(String(error));
    });
  }, [props.activeCommand, props.revisionToken, props.activeSketch.id, lineInteraction.committing, lineReady, settleLineSolve]);
  const overlay = solve.overlay;
  const entities = overlay?.entities ?? props.activeSketch.entities;
  const displayOverlay = useMemo(() => sketchDisplayOverlay(overlay, view.settings.construction),
    [overlay, view.settings.construction]);
  const displayedEntities = displayOverlay?.entities ?? entities;
  const displayedIds = useMemo(() => new Set(displayedEntities.map(entity => entity.id)), [displayedEntities]);
  const frame = sketchFrameForScreen(viewport, stageSize);
  const projection = resolveSketchWorkplaneProjection(props.activeSketch.support);
  const step = sketchGridStep(viewport.span, Math.min(stageSize.width, stageSize.height));
  const unitPerPixel = viewport.span / Math.max(1, Math.min(stageSize.width, stageSize.height));
  const points = useMemo(() => sketchPointMarks(displayedEntities), [displayedEntities]);
  const profile = useMemo(() => sketchProfilePath(props.activeSketch, entities), [props.activeSketch, entities]);
  const dimensions = props.document.dimensions.filter(dimension => props.activeSketch.dimensionIds.includes(dimension.id));
  const constraints = props.document.constraints.filter(constraint => props.activeSketch.constraintIds.includes(constraint.id));
  const current = useRef({ viewport, entities: displayedEntities, frame, snapEnabled: view.settings.snap, step });
  current.current = { viewport, entities: displayedEntities, frame, snapEnabled: view.settings.snap, step };

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
      setSnap(null);
    };
    stage.addEventListener('wheel', wheel, { capture: true, passive: false });
    return () => { observer.disconnect(); stage.removeEventListener('wheel', wheel, true); };
  }, []);

  useEffect(() => registerSketchNavigation((command: SketchViewCommand) => {
    setSnap(null);
    if (command === 'fit' || command === 'look-at') setViewport(fitSketchViewport(current.current.entities));
    else if (command === 'reset') setViewport(resetSketchViewportState());
    else setViewport(previous => zoomSketchViewport(previous, command === 'zoom-in' ? 0.8 : 1.25, previous.center));
  }), []);

  useEffect(() => {
    if (!entities.length || props.activeCommand || drag.draggingEntityId) return;
    return registerSketchCompute(solve.restorePersistedPreview);
  }, [entities.length, props.activeCommand, drag.draggingEntityId, solve.restorePersistedPreview]);

  useEffect(() => {
    const support = String(props.activeSketch.support);
    const supportLabel = ['XY', 'XZ', 'YZ'].includes(support) ? support : 'Плоскость грани';
    publishSketchView({
      id: props.activeSketch.id, name: props.activeSketch.name, support,
      supportLabel, planeLabel: supportLabel,
      projection: projection?.kind ?? 'stable-reference', modelContextReady: projection?.modelContextReady ?? false,
      entityCount: entities.length, dimensionCount: dimensions.length, constraintCount: constraints.length,
    }, viewport, solve.snapshot);
  }, [props.activeSketch.id, props.activeSketch.name, props.activeSketch.support,
    entities.length, dimensions.length, constraints.length, viewport, projection?.kind, projection?.modelContextReady, solve.snapshot]);

  const snapPoint = (point: CadPoint2): CadPoint2 => {
    const state = current.current;
    const rect = stageRef.current?.getBoundingClientRect();
    const tolerance = state.viewport.span / Math.max(1, Math.min(rect?.width ?? 700, rect?.height ?? 700)) * 10;
    const resolved = resolveSketchSnap(point, state.entities, state.step, tolerance, state.snapEnabled);
    setSnap(resolved);
    return resolved?.point ?? point;
  };
  const linePoint = (point: CadPoint2): CadPoint2 => {
    const state = current.current;
    const rect = stageRef.current?.getBoundingClientRect();
    const units = state.viewport.span / Math.max(1, Math.min(rect?.width ?? 700, rect?.height ?? 700));
    const context = resolveLiveLinePointer(point, state.entities, units, state.snapEnabled);
    liveLineInteraction.setPointerContext(context);
    setSnap(context.snap);
    return context.point;
  };
  const startPan = (event: React.PointerEvent<HTMLDivElement>) => {
    if (event.target instanceof Element && event.target.closest('input,textarea,select,button,label,[contenteditable="true"]')) return;
    if (event.button !== 1 && !(view.panMode && event.button === 0 && event.pointerType !== 'touch')) return;
    event.preventDefault(); event.stopPropagation();
    pan.current = { id: event.pointerId, x: event.clientX, y: event.clientY };
    event.currentTarget.setPointerCapture(event.pointerId); setPanning(true); setSnap(null);
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

  return <SketchViewportFrameProvider frame={frame}>
    <div ref={stageRef} className="part-model-stage live-sketch-field" data-testid="part-model-stage"
      tabIndex={0} aria-label="Рабочая плоскость эскиза"
      data-sketch-context="isolated-2d" data-sketch-support={props.activeSketch.support}
      data-sketch-projection={projection?.kind ?? ''} data-model-context-ready={projection?.modelContextReady ? 'true' : 'false'}
      data-sketch-view-span={viewport.span} data-sketch-view-center={viewport.center.join(',')}
      data-sketch-grid-step={step} data-sketch-construction-visible={view.settings.construction ? 'true' : 'false'}
      data-selected-sketch-entity-id={props.selectedSketchEntityId ?? ''} data-dragging-sketch-entity-id={drag.draggingEntityId ?? ''}
      data-line-solver-ready={String(lineReady)}
      data-sketch-panning={panning ? 'true' : 'false'} data-sketch-snap-enabled={view.settings.snap ? 'true' : 'false'}
      style={{ cursor: panning ? 'grabbing' : view.panMode ? 'grab' : undefined }}
      onPointerDownCapture={event => {
        if (event.target instanceof Element && !event.target.closest('input,textarea,select,button,[contenteditable="true"]')) {
          event.currentTarget.focus({ preventScroll: true });
        }
        startPan(event);
      }}
      onFocusCapture={event => {
        // Drawing surfaces focus themselves, then unmount after a commit. Keep
        // canvas focus on the persistent stage so App shortcuts retain a target.
        if (event.target instanceof SVGElement) event.currentTarget.focus({ preventScroll: true });
      }}
      onPointerMoveCapture={movePan} onPointerUpCapture={endPan} onPointerCancelCapture={endPan}
      onLostPointerCapture={() => { pan.current = null; setPanning(false); }}
      onAuxClick={event => { if (event.button === 1) { event.preventDefault(); event.stopPropagation(); } }}
      onPointerLeave={() => { if (!pan.current) setSnap(null); }}
      onDoubleClickCapture={event => {
        if (props.activeCommand !== 'sketch.line' || view.panMode || pan.current || !(event.target instanceof Element)
          || event.target.closest('input,button,label')) return;
        event.preventDefault(); event.stopPropagation();
        liveLineInteraction.finishChain();
      }}
      onKeyDownCapture={event => {
        if (props.activeCommand === 'sketch.line' && handleLiveLineKey(event)) return;
        if (!(event.target instanceof Element) || event.target.closest('input,textarea,select,button,[contenteditable="true"]')) return;
        const direction = { ArrowLeft: [40, 0], ArrowRight: [-40, 0], ArrowUp: [0, 40], ArrowDown: [0, -40] }[event.key];
        if (!direction || event.altKey || event.ctrlKey || event.metaKey) return;
        event.preventDefault(); event.stopPropagation();
        const rect = event.currentTarget.getBoundingClientRect();
        setViewport(previous => panSketchViewport(previous, rect, direction[0], direction[1]));
      }}>
      <SketchGridLayers frame={frame} step={step} unitPerPixel={unitPerPixel}
        grid={view.settings.grid} profiles={view.settings.profiles} profile={profile} />
      <CadViewport model={null} sketchOverlay={displayOverlay} />
      <SketchSelectionLayer model={displayOverlay} enabled={selectionEnabled}
        selectedEntityId={props.selectedSketchEntityId} draggingEntityId={drag.draggingEntityId}
        onEntitySelect={props.onSketchEntitySelect} onEntityDragStart={drag.start} onEntityDragMove={drag.move}
        onEntityDragEnd={drag.end} onEntityDragCancel={drag.cancel} />
      <SketchDirectToolLayers model={displayOverlay} frame={frame} viewportState={viewport} onViewportStateChange={setViewport}
        activeCommand={props.activeCommand} lineDraft={props.lineDraft} lineCommitting={props.lineCommitting || !lineReady}
        onLineMove={point => { if (lineReady) props.onSketchLinePointMove(linePoint(point)); }} onLinePoint={point => { if (lineReady) return props.onSketchLinePoint(linePoint(point)); }}
        rectangleDraft={props.rectangleDraft} rectangleCommitting={props.rectangleCommitting}
        onRectangleMove={point => props.onSketchRectanglePointMove(snapPoint(point))} onRectanglePoint={point => props.onSketchRectanglePoint(snapPoint(point))}
        circleDraft={props.circleDraft} circleCommitting={props.circleCommitting}
        onCircleMove={point => props.onSketchCirclePointMove(snapPoint(point))} onCirclePoint={point => props.onSketchCirclePoint(snapPoint(point))}
        arcDraft={props.arcDraft} arcCommitting={props.arcCommitting}
        onArcMove={point => props.onSketchArcPointMove(snapPoint(point))} onArcPoint={point => props.onSketchArcPoint(snapPoint(point))} />
      <SketchAnnotationLayers frame={frame} unitPerPixel={unitPerPixel} view={view}
        points={points} dimensions={dimensions} entities={entities} constraints={constraints}
        displayedIds={displayedIds} selectionEnabled={selectionEnabled} snap={snap}
        activeCommand={props.activeCommand} />
      {props.activeCommand === 'sketch.line' && <LiveLineInput frame={frame} size={stageSize}
        focusStage={() => stageRef.current?.focus({ preventScroll: true })} />}
      <div className="sketch-solve-hud" data-testid="sketch-solve-hud" data-overlay-source={overlay?.source ?? 'document'}>
        <SketchSolveStatus snapshot={solve.snapshot} />
      </div>
    </div>
  </SketchViewportFrameProvider>;
}
