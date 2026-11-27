import React, { useCallback, useEffect } from 'react';
import type { Dispatch, ReactNode, RefObject, SetStateAction } from 'react';
import type { CadConstraint, CadDimension, CadSketch, CadSketchEntity, CadSketchSupport } from '../../contracts/document';
import type { CadRenderModel } from '../../contracts/render';
import type { SketchEditingStageProps } from '../SketchEditingStage';
import type { SketchDisplayFrame, SketchViewportState } from '../viewport/SketchViewportGeometry';
import { DEFAULT_SKETCH_VIEWPORT_STATE } from '../viewport/SketchViewportGeometry';
import { SketchViewportFrameProvider } from '../viewport/SketchViewportFrameContext';
import type { SketchWorkplaneProjection } from '../viewport/SketchWorkplaneProjection';
import {
  SketchCameraPresentationContext, useSketchCameraPresentation, useSketchCameraPresentationValue,
  type SketchCameraPresentation,
} from './useSketchCameraPresentation';
import type { LiveLineSnap } from './LiveLineInteraction';
import { liveLineInteraction } from './LiveLineInteraction';
import { SketchDimensionAnnotations } from './SketchDimensionAnnotations';
import { sketchGridTicks, sketchEntityAnchor, type SketchPointMark, type SketchSnap } from './sketchPresentation';
import { editSketchDimension, publishSketchView, type SketchViewSnapshot } from './sketchView';
import type { CadSketchSolveSnapshot } from '../../application/SketchSolveSession';

/** A05: ready actual-camera presentation, or null to keep the legacy frame basis. */
function useCameraPresentation() {
  const presentation = useSketchCameraPresentationValue();
  return presentation.mode === 'camera' && presentation.ready ? presentation : null;
}

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

interface GridProps {
  frame: SketchDisplayFrame;
  step: number;
  unitPerPixel: number;
  grid: boolean;
  profiles: boolean;
  profile: string | null;
}
/** Grid and profile decoration share the active stage's exact display frame. */
export function SketchGridLayers({ frame, step, unitPerPixel, grid, profiles, profile }: GridProps) {
  const gridXs = sketchGridTicks(frame.minX, frame.maxX, step);
  const gridYs = sketchGridTicks(frame.minY, frame.maxY, step);
  const camera = useCameraPresentation();
  const svgBasis = {
    viewBox: camera ? `0 0 ${camera.width} ${camera.height}` : frame.viewBox,
    preserveAspectRatio: (camera ? 'none' : 'xMidYMid meet') as 'none' | 'xMidYMid meet',
  };
  return <>
      {grid && <svg data-sketch-layer="grid" data-grid-minor-step={step} data-grid-major-step={step * 5}
        {...svgBasis} style={{ ...layerStyle, zIndex: 0 }} aria-hidden="true">
        <g transform={camera?.matrix}>
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
        </g>
      </svg>}
      {profiles && <svg data-sketch-layer="profiles" data-closed-profile={profile ? 'true' : 'false'} {...svgBasis} style={{ ...layerStyle, zIndex: 1 }} aria-hidden="true">
        <g transform={camera?.matrix}>
        {profile && <path d={profile} fill="#67b9d8" fillOpacity="0.17" fillRule="evenodd" />}
        </g>
      </svg>}
  </>;
}

interface AnnotationProps {
  frame: SketchDisplayFrame;
  unitPerPixel: number;
  view: SketchViewSnapshot;
  points: readonly SketchPointMark[];
  dimensions: readonly CadDimension[];
  entities: readonly CadSketchEntity[];
  constraints: readonly CadConstraint[];
  displayedIds: ReadonlySet<string>;
  selectionEnabled: boolean;
  snap: SketchSnap | LiveLineSnap | null;
  activeCommand: string | null;
}
/** Constraint glyphs and dimensions render existing document intent only. */
export function SketchAnnotationLayers({ frame, unitPerPixel, view, points, dimensions,
  entities, constraints, displayedIds, selectionEnabled, snap, activeCommand }: AnnotationProps) {
  const camera = useCameraPresentation();
  const svgBasis = {
    viewBox: camera ? `0 0 ${camera.width} ${camera.height}` : frame.viewBox,
    preserveAspectRatio: (camera ? 'none' : 'xMidYMid meet') as 'none' | 'xMidYMid meet',
  };
  return <>
      {view.settings.points && <svg data-sketch-layer="points" {...svgBasis} style={{ ...layerStyle, zIndex: 5 }} aria-hidden="true">
        <g transform={camera?.matrix}>
        {points.map((mark, index) => <circle key={`${mark.entityId}:${index}`} data-point-kind={mark.kind} data-entity-id={mark.entityId}
          cx={mark.point[0]} cy={-mark.point[1]} r={unitPerPixel * 4}
          fill="#fff" stroke="#929b9e" strokeWidth="1" vectorEffect="non-scaling-stroke" />)}
        </g>
      </svg>}
      {view.settings.dimensions && <svg data-sketch-layer="dimensions" {...svgBasis} style={{ ...layerStyle, zIndex: 5 }}>
        <g transform={camera?.matrix}>
        <SketchDimensionAnnotations dimensions={dimensions} entities={entities} displayedIds={displayedIds}
          unitPerPixel={unitPerPixel} editable={selectionEnabled && view.dimensionEditReady} onEdit={editSketchDimension} />
        </g>
      </svg>}
      {view.settings.constraints && <svg data-sketch-layer="constraints" {...svgBasis} style={{ ...layerStyle, zIndex: 5 }} aria-hidden="true">
        <g transform={camera?.matrix}>
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
        </g>
      </svg>}
      {view.settings.snap && snap && drawingCommands.has(activeCommand ?? '') && <svg data-sketch-layer="snap" data-snap-kind={snap.kind}
        data-snap-point={snap.point.join(',')} data-snap-entity-id={'entityId' in snap ? snap.entityId ?? '' : 'ref' in snap ? snap.ref?.entityId ?? '' : ''} {...svgBasis} style={{ ...layerStyle, zIndex: 6 }} aria-hidden="true">
        <g transform={camera?.matrix}>
        <rect x={snap.point[0] - 5 * unitPerPixel} y={-snap.point[1] - 5 * unitPerPixel} width={10 * unitPerPixel} height={10 * unitPerPixel}
          fill="none" stroke="#df8430" strokeWidth="1.5" vectorEffect="non-scaling-stroke" />
        </g>
      </svg>}
  </>;
}

/** A05: Fusion sketch stage props; the optional render model keeps the body in world space. */
export type FusionSketchStageProps = SketchEditingStageProps & { renderModel?: CadRenderModel | null };

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

/** A05: stage camera wiring; adopts the actual framing into the 2D state once, only from the default reset. */
export function useSketchCameraStage(options: {
  support: CadSketchSupport;
  renderModel: CadRenderModel | null;
  stageRef: RefObject<HTMLDivElement | null>;
  frame: SketchDisplayFrame;
  setViewport: Dispatch<SetStateAction<SketchViewportState>>;
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
  return { presentation, renderModel: options.renderModel };
}

/** Publishes the live Sketch presentation state; moved out of the stage assembly. */
export function useSketchViewPublish(options: {
  sketch: Readonly<CadSketch>;
  projection: SketchWorkplaneProjection | null;
  entityCount: number;
  dimensionCount: number;
  constraintCount: number;
  viewport: SketchViewportState;
  snapshot: Readonly<CadSketchSolveSnapshot>;
}) {
  const { sketch, projection, entityCount, dimensionCount, constraintCount, viewport, snapshot } = options;
  useEffect(() => {
    const support = String(sketch.support);
    const supportLabel = ['XY', 'XZ', 'YZ'].includes(support) ? support : 'Плоскость грани';
    publishSketchView({
      id: sketch.id, name: sketch.name, support,
      supportLabel, planeLabel: supportLabel,
      projection: projection?.kind ?? 'stable-reference', modelContextReady: projection?.modelContextReady ?? false,
      entityCount, dimensionCount, constraintCount,
    }, viewport, snapshot);
  }, [sketch.id, sketch.name, sketch.support, entityCount, dimensionCount, constraintCount,
    viewport, projection?.kind, projection?.modelContextReady, snapshot]);
}

/** Resets the live line pointer context on command/sketch/snap setting changes. */
export function useLiveLineContextReset(options: {
  activeCommand: string | null;
  sketchId: string;
  snapEnabled: boolean;
  constructionVisible: boolean;
  reset(): void;
}) {
  const { activeCommand, sketchId, snapEnabled, constructionVisible, reset } = options;
  useEffect(() => {
    reset();
    const line = liveLineInteraction.getSnapshot();
    liveLineInteraction.setPointerContext({ point: line.to ?? [0, 0], snap: null });
  }, [activeCommand, sketchId, snapEnabled, constructionVisible, reset]);
}
