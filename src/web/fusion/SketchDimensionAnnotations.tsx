import React from 'react';
import type { CadDimension, CadSketchEntity } from '../../contracts/document';
import type { CadDimensionId } from '../../contracts/ids';
import { dimensionLabel, dimensionUnit } from '../SketchDimensionPresentation';
import { sketchEntityAnchor } from './sketchPresentation';
import { sketchLineDimensionLayout } from './sketchDimensionLayout';

interface Props {
  dimensions: readonly CadDimension[];
  entities: readonly CadSketchEntity[];
  displayedIds: ReadonlySet<string>;
  unitPerPixel: number;
  editable: boolean;
  onEdit: (id: CadDimensionId) => void;
}

/** Render only: dimensions and solved geometry belong to the shared CAD owners. */
export function SketchDimensionAnnotations({ dimensions, entities, displayedIds, unitPerPixel, editable, onEdit }: Props) {
  const byId = new Map(entities.map(entity => [entity.id, entity]));
  return <>{dimensions.map((dimension, index) => {
    if (!dimension.entityIds.every(id => displayedIds.has(id))) return null;
    const entity = byId.get(dimension.entityIds[0]);
    if (!entity) return null;
    const name = dimension.name && !['width', 'height', 'diameter'].includes(dimension.name)
      ? dimension.name : dimensionLabel(dimension.name, dimension.type);
    const prefix = dimension.type === 'diameter' ? 'Ø' : dimension.type === 'radius' ? 'R' : '';
    const unit = dimensionUnit(dimension.type);
    const description = `${name} = ${prefix}${Number(dimension.value.toFixed(3))}${unit === '°' ? '' : ' '}${unit}`;
    const textProps: React.SVGProps<SVGTextElement> = {
      textAnchor: 'middle', fill: '#000', fontFamily: 'Arial, sans-serif',
      fontSize: 16 * unitPerPixel, 'aria-label': description,
      style: { pointerEvents: editable ? 'all' : 'none', cursor: 'pointer' },
      onPointerDown: event => event.stopPropagation(),
      onDoubleClick: event => { event.preventDefault(); event.stopPropagation(); onEdit(dimension.id); },
    };
    const title = <title>{`${description} — двойной щелчок для изменения`}</title>;
    const line = sketchLineDimensionLayout(dimension, entity, unitPerPixel);
    if (line) {
      return <g key={dimension.id} data-sketch-dimension-id={dimension.id} data-dimension-value={dimension.value}
        data-dimension-presentation={line.kind} data-dimension-placement="automatic" data-dimension-arrows-outside={line.arrowsOutside}>
        {line.extensionLines.map((extension, index) => <line key={index} data-dimension-extension={index}
          x1={extension.from[0]} y1={extension.from[1]} x2={extension.to[0]} y2={extension.to[1]}
          stroke="#000" strokeWidth="1" vectorEffect="non-scaling-stroke" />)}
        <line data-dimension-line="true" x1={line.dimensionLine.from[0]} y1={line.dimensionLine.from[1]}
          x2={line.dimensionLine.to[0]} y2={line.dimensionLine.to[1]}
          stroke="#000" strokeWidth="1" vectorEffect="non-scaling-stroke" />
        {line.arrowHeads.map((points, index) => <polygon key={index} data-dimension-arrow={index}
          points={points.map(point => point.join(',')).join(' ')} fill="#000" />)}
        <text {...textProps} transform={`translate(${line.label.point.join(' ')}) rotate(${line.label.angle})`}>
          {title}{dimension.value.toFixed(2)}
        </text>
      </g>;
    }
    if (dimension.type === 'diameter' && entity.type === 'circle') {
      const [x, centerY] = entity.data.center, y = -centerY, radius = entity.data.diameter / 2;
      const left = x - radius, right = x + radius, arrow = Math.min(9 * unitPerPixel, radius / 2), half = 2.5 * unitPerPixel;
      return <g key={dimension.id} data-sketch-dimension-id={dimension.id} data-dimension-value={dimension.value} data-dimension-presentation="diameter">
        <line x1={left} y1={y} x2={right} y2={y} stroke="#000" strokeWidth="1" vectorEffect="non-scaling-stroke" />
        <path d={`M ${left} ${y} L ${left + arrow} ${y - half} L ${left + arrow} ${y + half} Z M ${right} ${y} L ${right - arrow} ${y - half} L ${right - arrow} ${y + half} Z`} fill="#000" />
        <text {...textProps} x={x} y={y - 7 * unitPerPixel}>{title}{`Ø${dimension.value.toFixed(2)}`}</text>
      </g>;
    }
    // Radial/angular placement and unsupported endpoint semantics retain the
    // existing descriptive label; no unverified arc or witness geometry is invented.
    const anchor = sketchEntityAnchor(entity), y = -anchor[1] - unitPerPixel * (18 + (index % 3) * 17);
    return <g key={dimension.id} data-sketch-dimension-id={dimension.id} data-dimension-value={dimension.value}
      data-dimension-presentation="text-fallback">
      <line x1={anchor[0]} y1={-anchor[1]} x2={anchor[0]} y2={y + 3 * unitPerPixel}
        stroke="#71858e" strokeWidth="1" vectorEffect="non-scaling-stroke" />
      <text {...textProps} x={anchor[0]} y={y} fontSize={12 * unitPerPixel} fill="#29495c"
        stroke="#fff" strokeWidth={3 * unitPerPixel} paintOrder="stroke">
        {title}{description}
      </text>
    </g>;
  })}</>;
}
