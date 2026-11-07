import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import type { CadPoint2 } from '../../../src/contracts/document';
import type { SketchEditingStageProps } from '../../../src/web/SketchEditingStage';
import { CadViewport } from '../../../src/web/CadViewport';
import { SketchDirectToolLayers } from '../../../src/web/SketchDirectToolLayers';
import { SketchSolveStatus } from '../../../src/web/SketchSolveStatus';
import { useActiveSketchSolveOverlay } from '../../../src/web/useActiveSketchSolveOverlay';
import { useSketchEntityDrag } from '../../../src/web/useSketchEntityDrag';
import { SketchSelectionLayer } from '../../../src/web/viewport/SketchSelectionLayer';
import { SketchViewportFrameProvider } from '../../../src/web/viewport/SketchViewportFrameContext';
import {
  panSketchViewport, resetSketchViewportState, screenPointToSketchPoint,
  zoomSketchViewport,
} from '../../../src/web/viewport/SketchViewportGeometry';
import { resolveSketchWorkplaneProjection } from '../../../src/web/viewport/SketchWorkplaneProjection';
import {
  editSketchDimension, publishSketchView, registerSketchCompute, registerSketchNavigation, useSketchView,
} from './sketchView';
import type { SketchViewCommand } from './sketchView';
import {
  fitSketchViewport, resolveSketchSnap, sketchDisplayOverlay, sketchEntityAnchor, sketchFrameForScreen,
  sketchGridStep, sketchGridTicks, sketchPointMarks, sketchProfilePath,
} from './sketchPresentation';
import type { SketchSnap } from './sketchPresentation';
import { SketchDimensionAnnotations } from './SketchDimensionAnnotations';
import { LiveLineInput, handleLiveLineKey, resolveLiveLinePointer } from './LiveLineInput';
import { liveLineInteraction, registerLiveLineSolver } from './LiveLineInteraction';
import type { LiveLineSnap } from './LiveLineInteraction';
import './sketchField.css';

export type { SketchEditingStageProps };
const layerStyle: React.CSSProperties = {
  position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: 'none',
};
const constraintLabels: Record<string, string> = {
  horizontal: 'H', vertical: 'V', coincident: '●', parallel: '∥', perpendicular: '⊥',
  equal: '=', tangent: 'T', concentric: '◎', symmetric: 'S', fixed: 'F', pointOnCurve: 'P',
};
const constraintNames: Record<string, string> = {
  horizontal: 'Горизонтальность', vertical: 'Вертикальность', coincident: 'Совпадение',
  parallel: 'Параллельность', perpendicular: 'Перпендикулярность', equal: 'Равенство',
  tangent: 'Касание', concentric: 'Концентричность', symmetric: 'Симметрия',
  fixed: 'Фиксация', pointOnCurve: 'Точка на кривой',
};
const drawingCommands = new Set(['sketch.line', 'sketch.rectangle', 'sketch.circle', 'sketch.arc']);

/** Prototype replacement: all editing, drag preview, solving and entity rendering are product owners. */
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
  const gridXs = sketchGridTicks(frame.minX, frame.maxX, step);
  const gridYs = sketchGridTicks(frame.minY, frame.maxY, step);

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
      {view.settings.grid && <svg data-sketch-layer="grid" data-grid-minor-step={step} data-grid-major-step={step * 5}
        viewBox={frame.viewBox} style={{ ...layerStyle, zIndex: 0 }} aria-hidden="true">
        <g className="live-sketch-grid-lines" strokeWidth="1">
          {gridXs.map(({ value: x, major }) => <line key={`x${x}`} data-grid-axis="x" data-grid-kind={major ? 'major' : 'minor'}
            x1={x} y1={frame.minY} x2={x} y2={frame.maxY} vectorEffect="non-scaling-stroke" />)}
          {gridYs.map(({ value: y, major }) => <line key={`y${y}`} data-grid-axis="y" data-grid-kind={major ? 'major' : 'minor'}
            x1={frame.minX} y1={y} x2={frame.maxX} y2={y} vectorEffect="non-scaling-stroke" />)}
        </g>
        <circle data-sketch-origin-ring="true" data-outer-radius-px="12" cx={0} cy={0} r={10.5 * unitPerPixel}
          fill="none" stroke="#8f9188" strokeOpacity=".55" strokeWidth="3" vectorEffect="non-scaling-stroke" />
        <line data-sketch-axis="x" x1={frame.minX} y1={0} x2={frame.maxX} y2={0}
          stroke="#ff6b6b" strokeWidth="1" vectorEffect="non-scaling-stroke" />
        <line data-sketch-axis="y" x1={0} y1={frame.minY} x2={0} y2={frame.maxY}
          stroke="#38d744" strokeWidth="1" vectorEffect="non-scaling-stroke" />
        <g className="live-sketch-grid-labels" fontSize={16 * unitPerPixel} strokeWidth={3 * unitPerPixel}>
          {gridXs.filter(tick => tick.major && tick.value < 0).map(({ value }) =>
            <text key={`label-x${value}`} data-grid-label-axis="x" data-grid-label-value={value}
              transform={`translate(${value} ${7 * unitPerPixel}) rotate(90)`} dominantBaseline="middle">{value}</text>)}
          {gridYs.filter(tick => tick.major && tick.value < 0).map(({ value }) =>
            <text key={`label-y${value}`} data-grid-label-axis="y" data-grid-label-value={-value}
              transform={`translate(${10 * unitPerPixel} ${value - 3 * unitPerPixel}) rotate(90)`}
              dominantBaseline="middle" textAnchor="end">{-value}</text>)}
        </g>
      </svg>}
      {view.settings.profiles && <svg data-sketch-layer="profiles" data-closed-profile={profile ? 'true' : 'false'} viewBox={frame.viewBox} style={{ ...layerStyle, zIndex: 1 }} aria-hidden="true">
        {profile && <path d={profile} fill="#67b9d8" fillOpacity="0.17" fillRule="evenodd" />}
      </svg>}
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
      {view.settings.points && <svg data-sketch-layer="points" viewBox={frame.viewBox} style={{ ...layerStyle, zIndex: 5 }} aria-hidden="true">
        {points.map((mark, index) => <circle key={`${mark.entityId}:${index}`} data-point-kind={mark.kind} data-entity-id={mark.entityId}
          cx={mark.point[0]} cy={-mark.point[1]} r={unitPerPixel * 4}
          fill="#fff" stroke="#929b9e" strokeWidth="1" vectorEffect="non-scaling-stroke" />)}
      </svg>}
      {view.settings.dimensions && <svg data-sketch-layer="dimensions" viewBox={frame.viewBox} style={{ ...layerStyle, zIndex: 5 }}>
        <SketchDimensionAnnotations dimensions={dimensions} entities={entities} displayedIds={displayedIds}
          unitPerPixel={unitPerPixel} editable={selectionEnabled && view.dimensionEditReady} onEdit={editSketchDimension} />
      </svg>}
      {view.settings.constraints && <svg data-sketch-layer="constraints" viewBox={frame.viewBox} style={{ ...layerStyle, zIndex: 5 }} aria-hidden="true">
        {constraints.map((constraint, index) => {
          if (!constraint.entityIds.every(id => displayedIds.has(id))) return null;
          const entity = entities.find(candidate => candidate.id === constraint.entityIds[0]);
          if (!entity) return null;
          const anchor = sketchEntityAnchor(entity);
          return <text key={constraint.id} data-sketch-constraint-id={constraint.id} data-constraint-type={constraint.type}
            x={anchor[0] + unitPerPixel * (10 + (index % 4) * 14)} y={-anchor[1] + unitPerPixel * 16}
            fontSize={12 * unitPerPixel} fill="#28724d" fontFamily="Arial, sans-serif" stroke="#fff" strokeWidth={3 * unitPerPixel} paintOrder="stroke">
            <title>{constraintNames[constraint.type] ?? constraint.type}</title>{constraintLabels[constraint.type] ?? constraint.type}
          </text>;
        })}
      </svg>}
      {view.settings.snap && snap && drawingCommands.has(props.activeCommand ?? '') && <svg data-sketch-layer="snap" data-snap-kind={snap.kind}
        data-snap-point={snap.point.join(',')} data-snap-entity-id={'entityId' in snap ? snap.entityId ?? '' : 'ref' in snap ? snap.ref?.entityId ?? '' : ''} viewBox={frame.viewBox} style={{ ...layerStyle, zIndex: 6 }} aria-hidden="true">
        <rect x={snap.point[0] - 5 * unitPerPixel} y={-snap.point[1] - 5 * unitPerPixel} width={10 * unitPerPixel} height={10 * unitPerPixel}
          fill="none" stroke="#df8430" strokeWidth="1.5" vectorEffect="non-scaling-stroke" />
      </svg>}
      {props.activeCommand === 'sketch.line' && <LiveLineInput frame={frame} size={stageSize}
        focusStage={() => stageRef.current?.focus({ preventScroll: true })} />}
      <div className="sketch-solve-hud" data-testid="sketch-solve-hud" data-overlay-source={overlay?.source ?? 'document'}>
        <SketchSolveStatus snapshot={solve.snapshot} />
      </div>
    </div>
  </SketchViewportFrameProvider>;
}
