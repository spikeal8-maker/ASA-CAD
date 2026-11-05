import React, { useEffect, useMemo, useRef, useState } from 'react';
import type { CadPoint2 } from '../../../src/contracts/document';
import type { SketchEditingStageProps } from '../../../src/web/SketchEditingStage';
import { CadViewport } from '../../../src/web/CadViewport';
import { SketchDirectToolLayers } from '../../../src/web/SketchDirectToolLayers';
import { dimensionLabel, dimensionUnit } from '../../../src/web/SketchDimensionPresentation';
import { SketchSolveStatus } from '../../../src/web/SketchSolveStatus';
import { useActiveSketchSolveOverlay } from '../../../src/web/useActiveSketchSolveOverlay';
import { useSketchEntityDrag } from '../../../src/web/useSketchEntityDrag';
import { SketchSelectionLayer } from '../../../src/web/viewport/SketchSelectionLayer';
import { SketchViewportFrameProvider } from '../../../src/web/viewport/SketchViewportFrameContext';
import {
  panSketchViewport, resetSketchViewportState, screenPointToSketchPoint,
  sketchDisplayFrame, zoomSketchViewport,
} from '../../../src/web/viewport/SketchViewportGeometry';
import { resolveSketchWorkplaneProjection } from '../../../src/web/viewport/SketchWorkplaneProjection';
import {
  editSketchDimension, publishSketchView, registerSketchNavigation, useSketchView,
} from './sketchView';
import type { SketchViewCommand } from './sketchView';
import {
  fitSketchViewport, resolveSketchSnap, sketchEntityAnchor, sketchGridStep,
  sketchPointMarks, sketchProfilePath,
} from './sketchPresentation';
import type { SketchSnap } from './sketchPresentation';

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
  const stageRef = useRef<HTMLDivElement>(null);
  const [viewport, setViewport] = useState(resetSketchViewportState);
  const [screenSize, setScreenSize] = useState(700);
  const [snap, setSnap] = useState<SketchSnap | null>(null);
  const [panning, setPanning] = useState(false);
  const pan = useRef<{ id: number; x: number; y: number } | null>(null);
  const selectionEnabled = props.activeCommand === null && !view.panMode;
  useEffect(() => { setViewport(resetSketchViewportState()); setSnap(null); }, [props.activeSketch.id]);
  useEffect(() => { setSnap(null); }, [props.activeCommand, view.settings.snap]);
  const solve = useActiveSketchSolveOverlay({
    document: props.document, sketch: props.activeSketch, active: true, revisionToken: props.revisionToken,
  });
  const drag = useSketchEntityDrag({
    part: props.document, sketch: props.activeSketch,
    selectedEntityId: props.selectedSketchEntityId, enabled: selectionEnabled,
    previewCandidate: solve.previewCandidate, restorePersistedPreview: solve.restorePersistedPreview,
    commit: props.onSketchEntityTranslate, onRejected: props.onSketchDragRejected,
  });
  const overlay = solve.overlay;
  const entities = overlay?.entities ?? props.activeSketch.entities;
  const frame = sketchDisplayFrame(viewport);
  const projection = resolveSketchWorkplaneProjection(props.activeSketch.support);
  const step = sketchGridStep(viewport.span);
  const unitPerPixel = viewport.span / screenSize;
  const points = useMemo(() => sketchPointMarks(entities), [entities]);
  const profile = useMemo(() => sketchProfilePath(props.activeSketch, entities), [props.activeSketch, entities]);
  const dimensions = props.document.dimensions.filter(dimension => props.activeSketch.dimensionIds.includes(dimension.id));
  const constraints = props.document.constraints.filter(constraint => props.activeSketch.constraintIds.includes(constraint.id));
  const current = useRef({ viewport, entities, frame, snapEnabled: view.settings.snap, step });
  current.current = { viewport, entities, frame, snapEnabled: view.settings.snap, step };

  useEffect(() => {
    const stage = stageRef.current;
    if (!stage) return;
    const measure = () => { const rect = stage.getBoundingClientRect(); setScreenSize(Math.max(1, Math.min(rect.width, rect.height))); };
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
    const support = String(props.activeSketch.support);
    const supportLabel = ['XY', 'XZ', 'YZ'].includes(support) ? support : 'Плоскость грани';
    publishSketchView({
      id: props.activeSketch.id, name: props.activeSketch.name, support,
      supportLabel, planeLabel: supportLabel,
      projection: projection?.kind ?? 'stable-reference', modelContextReady: projection?.modelContextReady ?? false,
      entityCount: entities.length, dimensionCount: dimensions.length, constraintCount: constraints.length,
    }, viewport);
  }, [props.activeSketch.id, props.activeSketch.name, props.activeSketch.support,
    entities.length, dimensions.length, constraints.length, viewport, projection?.kind, projection?.modelContextReady]);

  const snapPoint = (point: CadPoint2): CadPoint2 => {
    const state = current.current;
    const rect = stageRef.current?.getBoundingClientRect();
    const tolerance = state.viewport.span / Math.max(1, Math.min(rect?.width ?? 700, rect?.height ?? 700)) * 10;
    const resolved = resolveSketchSnap(point, state.entities, state.step, tolerance, state.snapEnabled);
    setSnap(resolved);
    return resolved?.point ?? point;
  };
  const startPan = (event: React.PointerEvent<HTMLDivElement>) => {
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
  const gridXs: number[] = [], gridYs: number[] = [];
  for (let x = Math.ceil(frame.minX / step) * step; x <= frame.maxX; x += step) gridXs.push(x);
  for (let y = Math.ceil(frame.minY / step) * step; y <= frame.maxY; y += step) gridYs.push(y);

  return <SketchViewportFrameProvider frame={frame}>
    <div ref={stageRef} className="part-model-stage" data-testid="part-model-stage"
      tabIndex={0} aria-label="Рабочая плоскость эскиза"
      data-sketch-context="isolated-2d" data-sketch-support={props.activeSketch.support}
      data-sketch-projection={projection?.kind ?? ''} data-model-context-ready={projection?.modelContextReady ? 'true' : 'false'}
      data-sketch-view-span={viewport.span} data-sketch-view-center={viewport.center.join(',')}
      data-selected-sketch-entity-id={props.selectedSketchEntityId ?? ''} data-dragging-sketch-entity-id={drag.draggingEntityId ?? ''}
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
      onKeyDownCapture={event => {
        if (!(event.target instanceof Element) || event.target.closest('input,textarea,select,button,[contenteditable="true"]')) return;
        const direction = { ArrowLeft: [40, 0], ArrowRight: [-40, 0], ArrowUp: [0, 40], ArrowDown: [0, -40] }[event.key];
        if (!direction || event.altKey || event.ctrlKey || event.metaKey) return;
        event.preventDefault(); event.stopPropagation();
        const rect = event.currentTarget.getBoundingClientRect();
        setViewport(previous => panSketchViewport(previous, rect, direction[0], direction[1]));
      }}>
      {view.settings.grid && <svg data-sketch-layer="grid" viewBox={frame.viewBox} style={{ ...layerStyle, zIndex: 0 }} aria-hidden="true">
        <g stroke="#dce4eb" strokeWidth="1" vectorEffect="non-scaling-stroke">
          {gridXs.map(x => <line key={`x${x}`} x1={x} y1={frame.minY} x2={x} y2={frame.maxY} vectorEffect="non-scaling-stroke" />)}
          {gridYs.map(y => <line key={`y${y}`} x1={frame.minX} y1={y} x2={frame.maxX} y2={y} vectorEffect="non-scaling-stroke" />)}
        </g>
        <line x1={frame.minX} y1={0} x2={frame.maxX} y2={0} stroke="#cb6b68" strokeWidth="1" vectorEffect="non-scaling-stroke" />
        <line x1={0} y1={frame.minY} x2={0} y2={frame.maxY} stroke="#67a47a" strokeWidth="1" vectorEffect="non-scaling-stroke" />
      </svg>}
      {view.settings.profiles && <svg data-sketch-layer="profiles" data-closed-profile={profile ? 'true' : 'false'} viewBox={frame.viewBox} style={{ ...layerStyle, zIndex: 1 }} aria-hidden="true">
        {profile && <path d={profile} fill="#d9a54b" fillOpacity="0.13" fillRule="evenodd" />}
      </svg>}
      <CadViewport model={null} sketchOverlay={overlay} />
      <SketchSelectionLayer model={overlay} enabled={selectionEnabled}
        selectedEntityId={props.selectedSketchEntityId} draggingEntityId={drag.draggingEntityId}
        onEntitySelect={props.onSketchEntitySelect} onEntityDragStart={drag.start} onEntityDragMove={drag.move}
        onEntityDragEnd={drag.end} onEntityDragCancel={drag.cancel} />
      <SketchDirectToolLayers model={overlay} frame={frame} viewportState={viewport} onViewportStateChange={setViewport}
        activeCommand={props.activeCommand} lineDraft={props.lineDraft} lineCommitting={props.lineCommitting}
        onLineMove={point => props.onSketchLinePointMove(snapPoint(point))} onLinePoint={point => props.onSketchLinePoint(snapPoint(point))}
        rectangleDraft={props.rectangleDraft} rectangleCommitting={props.rectangleCommitting}
        onRectangleMove={point => props.onSketchRectanglePointMove(snapPoint(point))} onRectanglePoint={point => props.onSketchRectanglePoint(snapPoint(point))}
        circleDraft={props.circleDraft} circleCommitting={props.circleCommitting}
        onCircleMove={point => props.onSketchCirclePointMove(snapPoint(point))} onCirclePoint={point => props.onSketchCirclePoint(snapPoint(point))}
        arcDraft={props.arcDraft} arcCommitting={props.arcCommitting}
        onArcMove={point => props.onSketchArcPointMove(snapPoint(point))} onArcPoint={point => props.onSketchArcPoint(snapPoint(point))} />
      {view.settings.points && <svg data-sketch-layer="points" viewBox={frame.viewBox} style={{ ...layerStyle, zIndex: 5 }} aria-hidden="true">
        {points.map((mark, index) => <circle key={`${mark.entityId}:${index}`} data-point-kind={mark.kind} data-entity-id={mark.entityId}
          cx={mark.point[0]} cy={-mark.point[1]} r={unitPerPixel * (mark.kind === 'center' ? 2.5 : 3)}
          fill={mark.kind === 'center' ? '#fff' : '#2e779b'} stroke="#2e779b" strokeWidth="1" vectorEffect="non-scaling-stroke" />)}
      </svg>}
      {view.settings.dimensions && <svg data-sketch-layer="dimensions" viewBox={frame.viewBox} style={{ ...layerStyle, zIndex: 5 }}>
        {dimensions.map((dimension, index) => {
          const entity = entities.find(candidate => candidate.id === dimension.entityIds[0]);
          if (!entity) return null;
          const anchor = sketchEntityAnchor(entity);
          const name = dimension.name && !['width', 'height', 'diameter'].includes(dimension.name)
            ? dimension.name : dimensionLabel(dimension.name, dimension.type);
          const prefix = dimension.type === 'diameter' ? 'Ø' : dimension.type === 'radius' ? 'R' : '';
          const unit = dimensionUnit(dimension.type);
          const text = `${name} = ${prefix}${Number(dimension.value.toFixed(3))}${unit === '°' ? '' : ' '}${unit}`;
          const y = -anchor[1] - unitPerPixel * (18 + (index % 3) * 17);
          return <g key={dimension.id} data-sketch-dimension-id={dimension.id} data-dimension-value={dimension.value}>
            <line x1={anchor[0]} y1={-anchor[1]} x2={anchor[0]} y2={y + 3 * unitPerPixel}
              stroke="#71858e" strokeWidth="1" vectorEffect="non-scaling-stroke" />
            <text x={anchor[0]} y={y} fontSize={12 * unitPerPixel} textAnchor="middle" fill="#29495c"
              stroke="#fff" strokeWidth={3 * unitPerPixel} paintOrder="stroke" fontFamily="Arial, sans-serif"
              style={{ pointerEvents: selectionEnabled && view.dimensionEditReady ? 'all' : 'none', cursor: 'pointer' }}
              onPointerDown={event => event.stopPropagation()} onDoubleClick={event => { event.preventDefault(); event.stopPropagation(); editSketchDimension(dimension.id); }}>
              <title>{`${text} — двойной щелчок для изменения`}</title>{text}
            </text>
          </g>;
        })}
      </svg>}
      {view.settings.constraints && <svg data-sketch-layer="constraints" viewBox={frame.viewBox} style={{ ...layerStyle, zIndex: 5 }} aria-hidden="true">
        {constraints.map((constraint, index) => {
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
        data-snap-point={snap.point.join(',')} data-snap-entity-id={snap.entityId ?? ''} viewBox={frame.viewBox} style={{ ...layerStyle, zIndex: 6 }} aria-hidden="true">
        <rect x={snap.point[0] - 5 * unitPerPixel} y={-snap.point[1] - 5 * unitPerPixel} width={10 * unitPerPixel} height={10 * unitPerPixel}
          fill="none" stroke="#df8430" strokeWidth="1.5" vectorEffect="non-scaling-stroke" />
      </svg>}
      <div className="sketch-solve-hud" data-testid="sketch-solve-hud" data-overlay-source={overlay?.source ?? 'document'}>
        <SketchSolveStatus snapshot={solve.snapshot} />
      </div>
    </div>
  </SketchViewportFrameProvider>;
}
