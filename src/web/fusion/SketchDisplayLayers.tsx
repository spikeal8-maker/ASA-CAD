import React from 'react';
import type { CadConstraint, CadDimension, CadSketchEntity } from '../../contracts/document';
import type { SketchDisplayFrame } from '../viewport/SketchViewportGeometry';
import type { LiveLineSnap } from './LiveLineInteraction';
import { SketchDimensionAnnotations } from './SketchDimensionAnnotations';
import { sketchGridTicks, sketchEntityAnchor, type SketchPointMark, type SketchSnap } from './sketchPresentation';
import { editSketchDimension, type SketchViewSnapshot } from './sketchView';

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
  return <>
      {grid && <svg data-sketch-layer="grid" data-grid-minor-step={step} data-grid-major-step={step * 5}
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
      {profiles && <svg data-sketch-layer="profiles" data-closed-profile={profile ? 'true' : 'false'} viewBox={frame.viewBox} style={{ ...layerStyle, zIndex: 1 }} aria-hidden="true">
        {profile && <path d={profile} fill="#67b9d8" fillOpacity="0.17" fillRule="evenodd" />}
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
  return <>
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
      {view.settings.snap && snap && drawingCommands.has(activeCommand ?? '') && <svg data-sketch-layer="snap" data-snap-kind={snap.kind}
        data-snap-point={snap.point.join(',')} data-snap-entity-id={'entityId' in snap ? snap.entityId ?? '' : 'ref' in snap ? snap.ref?.entityId ?? '' : ''} viewBox={frame.viewBox} style={{ ...layerStyle, zIndex: 6 }} aria-hidden="true">
        <rect x={snap.point[0] - 5 * unitPerPixel} y={-snap.point[1] - 5 * unitPerPixel} width={10 * unitPerPixel} height={10 * unitPerPixel}
          fill="none" stroke="#df8430" strokeWidth="1.5" vectorEffect="non-scaling-stroke" />
      </svg>}
  </>;
}
