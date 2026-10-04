import { useState } from 'react';
import type { CadDimension, CadSketch, CadSketchEntity } from '../contracts/sketch';
import type { CadDimensionId } from '../contracts/ids';
import { CadIcon, type CadIconName } from './CadIcon';
import { dimensionLabel, dimensionUnit } from './SketchDimensionPresentation';

interface SketchTreeBranchProps {
  sketch: CadSketch;
  dimensions: readonly CadDimension[];
  selected: boolean;
  showEdit: boolean;
  onSelect(): void;
  onEdit(): void;
  onEditDimension(id: CadDimensionId): void;
}

export function SketchTreeBranch(props: SketchTreeBranchProps) {
  const { sketch } = props;
  const [expanded, setExpanded] = useState(true);
  return (
    <div className="tree-sketch-branch" data-sketch-branch-id={sketch.id}>
      <div
        className={`tree-row tree-branch-row tree-sketch-header ${props.selected ? 'selected' : ''}`}
        style={{ paddingInlineStart: 28 }}
        data-tree-branch={`sketch:${sketch.id}`}
      >
        <button
          className="tree-disclosure"
          type="button"
          data-sketch-disclosure={sketch.id}
          aria-label={`${expanded ? 'Свернуть' : 'Развернуть'} ${sketch.name}`}
          aria-expanded={expanded}
          onClick={() => setExpanded((value) => !value)}
        >
          <CadIcon name="chevron" size={11} />
        </button>
        <button
          className="tree-sketch-select"
          type="button"
          data-sketch-id={sketch.id}
          aria-pressed={props.selected}
          onClick={props.onSelect}
        >
          <span className="tree-icon"><CadIcon name="sketch" size={15} /></span>
          <span className="tree-label">{sketch.name}</span>
        </button>
        {props.showEdit && (
          <button
            className="tree-sketch-edit"
            type="button"
            data-sketch-edit-id={sketch.id}
            aria-label={`Редактировать ${sketch.name}`}
            onClick={props.onEdit}
          >
            Редактировать
          </button>
        )}
      </div>
      {expanded && (
        <div className="tree-sketch-children" data-sketch-children={sketch.id}>
          {sketch.entities.map((entity, index) => (
            <SketchLeafRow
              key={entity.id}
              icon={entityIcon(entity)}
              label={entityLabel(sketch.entities, index)}
              entityId={entity.id}
              entityType={entity.type}
            />
          ))}
          {props.dimensions.map((dimension) => (
            <SketchLeafRow
              key={dimension.id}
              icon={dimensionIcon(dimension)}
              label={`${dimensionLabel(dimension.name, dimension.type)}: ${dimension.value} ${dimensionUnit(dimension.type)}`}
              dimensionId={dimension.id}
              onClick={() => props.onEditDimension(dimension.id)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function SketchLeafRow(props: {
  icon: CadIconName;
  label: string;
  entityId?: string;
  entityType?: CadSketchEntity['type'];
  dimensionId?: CadDimensionId;
  onClick?: () => void;
}) {
  const content = (
    <>
      <span className="tree-chevron" aria-hidden="true" />
      <span className="tree-icon"><CadIcon name={props.icon} size={15} /></span>
      <span className="tree-label">{props.label}</span>
    </>
  );
  const common = {
    className: `tree-row ${props.onClick ? 'interactive' : ''}`,
    style: { paddingInlineStart: 46 },
    'data-tree-sketch-entity-id': props.entityId,
    'data-sketch-entity-type': props.entityType,
    'data-dimension-id': props.dimensionId,
  } as const;
  if (props.onClick) {
    return <button type="button" {...common} onClick={props.onClick}>{content}</button>;
  }
  return <div {...common}>{content}</div>;
}

function entityLabel(entities: readonly CadSketchEntity[], index: number): string {
  const entity = entities[index];
  const ordinal = entities.slice(0, index + 1).filter((item) => item.type === entity.type).length;
  switch (entity.type) {
    case 'line': return `Отрезок ${ordinal}`;
    case 'circle': return `Окружность ${ordinal}`;
    case 'arc': return `Дуга ${ordinal}`;
  }
}

function entityIcon(entity: CadSketchEntity): CadIconName {
  switch (entity.type) {
    case 'line': return 'line';
    case 'circle': return 'circle';
    case 'arc': return 'arc';
  }
}

function dimensionIcon(dimension: CadDimension): CadIconName {
  if (dimension.type === 'diameter') return 'diameter';
  if (dimension.type === 'radius') return 'radius';
  if (dimension.type === 'angular') return 'angle';
  return 'dimension';
}
