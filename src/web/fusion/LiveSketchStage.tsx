import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import type { CadPoint2 } from '../../contracts/document';
import { CadViewport } from '../CadViewport';
import { SketchDirectToolLayers } from '../SketchDirectToolLayers';
import { SketchSolveStatus } from '../SketchSolveStatus';
import { useActiveSketchSolveOverlay } from '../useActiveSketchSolveOverlay';
import { useSketchEntityDrag } from '../useSketchEntityDrag';
import { SketchSelectionLayer } from '../viewport/SketchSelectionLayer';
import { resolveSketchWorkplaneProjection } from '../viewport/SketchWorkplaneProjection';
import { registerSketchCompute, useSketchView } from './sketchView';
import { resolveSketchSnap, sketchDisplayOverlay, sketchPointMarks, sketchProfilePath } from './sketchPresentation';
import type { SketchSnap } from './sketchPresentation';
import { useLiveSketchNavigation } from './useLiveSketchNavigation';
import {
  SketchCameraPresentationProvider, SketchGridLayers, SketchAnnotationLayers,
  cameraPresentationData, useLiveLineContextReset, useSketchCameraStage, useSketchViewPublish,
  type FusionSketchStageProps,
} from './SketchDisplayLayers';
import { LiveLineInput, handleLiveLineKey, resolveLiveLinePointer } from './LiveLineInput';
import { liveLineInteraction, registerLiveLineSolver } from './LiveLineInteraction';
import type { LiveLineSnap } from './LiveLineInteraction';

/** Fusion stage; editing, drag preview, solving and entities keep their shared owners. */
export function SketchEditingStage(props: FusionSketchStageProps) {
  const view = useSketchView();
  const lineInteraction = useSyncExternalStore(liveLineInteraction.subscribe, liveLineInteraction.getSnapshot);
  const [lineSettled, setLineSettled] = useState<{ sketchId: string; revision: number } | null>(null);
  const [snap, setSnap] = useState<SketchSnap | LiveLineSnap | null>(null);
  const selectionEnabled = props.activeCommand === null && !view.panMode;
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
  const resetSnap = useCallback(() => setSnap(null), []);
  const { stageRef, viewport, setViewport, stageSize, panning, pan, frame, step, current,
    startPan, movePan, endPan, resetLostCapture, panByArrow } = useLiveSketchNavigation({
    sketchId: props.activeSketch.id, displayedEntities, panMode: view.panMode, onSnapReset: resetSnap,
  });
  const camera = useSketchCameraStage({ support: props.activeSketch.support, renderModel: props.renderModel ?? null, stageRef, frame, setViewport,
    documentId: props.document.documentId, sketchId: props.activeSketch.id });
  // A05 gate: keyboard/coordinate commits only while the real camera is aligned.
  const pres = camera.presentation;
  const gateOpen = pres.mode === 'legacy' || (pres.mode === 'camera' && pres.ready ? pres.aligned : false);
  useLiveLineContextReset({ activeCommand: props.activeCommand, sketchId: props.activeSketch.id, snapEnabled: view.settings.snap,
    constructionVisible: view.settings.construction, reset: resetSnap });

  const projection = resolveSketchWorkplaneProjection(props.activeSketch.support);
  const unitPerPixel = viewport.span / Math.max(1, Math.min(stageSize.width, stageSize.height));
  const points = useMemo(() => sketchPointMarks(displayedEntities), [displayedEntities]);
  const profile = useMemo(() => sketchProfilePath(props.activeSketch, entities), [props.activeSketch, entities]);
  const dimensions = props.document.dimensions.filter(dimension => props.activeSketch.dimensionIds.includes(dimension.id));
  const constraints = props.document.constraints.filter(constraint => props.activeSketch.constraintIds.includes(constraint.id));

  useEffect(() => {
    if (!entities.length || props.activeCommand || drag.draggingEntityId) return;
    return registerSketchCompute(solve.restorePersistedPreview);
  }, [entities.length, props.activeCommand, drag.draggingEntityId, solve.restorePersistedPreview]);

  useSketchViewPublish({ sketch: props.activeSketch, projection, entityCount: entities.length,
    dimensionCount: dimensions.length, constraintCount: constraints.length, viewport, snapshot: solve.snapshot });

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
  return <SketchCameraPresentationProvider value={camera.presentation} frame={frame}>
    <div ref={stageRef} className="part-model-stage live-sketch-field" data-testid="part-model-stage"
      tabIndex={0} aria-label="Рабочая плоскость эскиза"
      data-sketch-context="isolated-2d" data-sketch-support={props.activeSketch.support}
      data-sketch-projection={projection?.kind ?? ''} data-model-context-ready={projection?.modelContextReady ? 'true' : 'false'}
      data-camera={cameraPresentationData(camera.presentation)}
      data-model-empty={camera.renderModel === null ? 'true' : 'false'}
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
      onLostPointerCapture={resetLostCapture}
      onAuxClick={event => { if (event.button === 1) { event.preventDefault(); event.stopPropagation(); } }}
      onPointerLeave={() => { if (!pan.current) setSnap(null); }}
      onDoubleClickCapture={event => {
        if (props.activeCommand !== 'sketch.line' || view.panMode || pan.current || !(event.target instanceof Element)
          || event.target.closest('input,button,label')) return;
        event.preventDefault(); event.stopPropagation();
        liveLineInteraction.finishChain();
      }}
      onKeyDownCapture={event => {
        if (!gateOpen) return;
        if (props.activeCommand === 'sketch.line' && handleLiveLineKey(event)) return;
        panByArrow(event);
      }}>
      <SketchGridLayers frame={frame} step={step} unitPerPixel={unitPerPixel}
        grid={view.settings.grid} profiles={view.settings.profiles} profile={profile} />
      <CadViewport model={camera.renderModel} sketchOverlay={displayOverlay} referencePlanes={props.document.origin.planes} />
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
  </SketchCameraPresentationProvider>;
}
