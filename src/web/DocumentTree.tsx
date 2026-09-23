import React, { useEffect, useState } from 'react';
import type { CadDocument } from '../contracts/document';
import type { CadBodyId, CadDimensionId, CadSketchId } from '../contracts/ids';
import { CadIcon, type CadIconName } from './CadIcon';
import { dimensionLabel, dimensionUnit } from './SketchDimensionPresentation';

export interface DocumentTreeProps {
  document: CadDocument;
  selectedBodyId: CadBodyId | null;
  activeSketchId: CadSketchId | null;
  onSelectBody(id: CadBodyId | null): void;
  onEditSketch(id: CadSketchId): void;
  onEditDimension(id: CadDimensionId): void;
}

/**
 * Document-tree presentation only. It receives ASA document DTOs and UI
 * callbacks; it owns no CAD runtime, persistence or command execution.
 */
export function DocumentTree({
  document,
  selectedBodyId,
  activeSketchId,
  onSelectBody,
  onEditSketch,
  onEditDimension,
}: DocumentTreeProps) {
  const [selectedSketchId, setSelectedSketchId] = useState<CadSketchId | null>(null);
  useEffect(() => setSelectedSketchId(null), [document]);
  const selectedSketch = document.kind === 'part'
    && selectedSketchId
    && document.sketches.some((item) => item.id === selectedSketchId)
      ? selectedSketchId
      : null;

  return (
    <div className="tree-panel" data-selected-sketch-id={selectedSketch ?? ''}>
      <div className="panel-title-row">
        <strong>Дерево</strong>
        <button type="button" title="Параметры дерева">⋯</button>
      </div>
      <div className="tree-search"><CadIcon name="search" size={14} /><input placeholder="Найти в дереве" /></div>
      <div className="tree-root">
        <TreeRow depth={0} icon={kindIcon(document.kind)} label={document.title} bold />
        {document.kind === 'part' && (
          <>
            <TreeRow depth={1} icon="origin" label="Начало координат" />
            <TreeRow depth={2} icon="plane" label="Плоскость XY" muted />
            <TreeRow depth={2} icon="plane" label="Плоскость XZ" muted />
            <TreeRow depth={2} icon="plane" label="Плоскость YZ" muted />
            {document.sketches.map((item) => (
              <SketchTreeEntry
                key={item.id}
                id={item.id}
                label={item.name}
                selected={item.id === activeSketchId || item.id === selectedSketch}
                showEdit={item.id === selectedSketch}
                onSelect={() => setSelectedSketchId(item.id)}
                onEdit={() => onEditSketch(item.id)}
              />
            ))}
            {document.dimensions.map((dimension) => (
              <TreeRow
                key={dimension.id}
                depth={2}
                icon={dimension.type === 'diameter' ? 'diameter' : dimension.type === 'angular' ? 'angle' : 'dimension'}
                label={`${dimensionLabel(dimension.name, dimension.type)}: ${dimension.value} ${dimensionUnit(dimension.type)}`}
                onClick={() => onEditDimension(dimension.id)}
              />
            ))}
            {document.features.map((feature) => (
              <TreeRow key={feature.id} depth={1} icon="feature" label={feature.name} />
            ))}
            {document.bodies.map((body) => (
              <TreeRow
                key={body.id}
                depth={1}
                icon="body"
                label={body.name}
                selected={body.id === selectedBodyId}
                bodyId={body.id}
                onClick={() => onSelectBody(body.id)}
              />
            ))}
          </>
        )}
        {document.kind === 'assembly' && <TreeRow depth={1} icon="assembly" label="Компоненты появятся в M4A" muted />}
        {document.kind === 'drawing' && <TreeRow depth={1} icon="drawing" label="Листы появятся в M6" muted />}
        {document.kind === 'fragment' && <TreeRow depth={1} icon="drawing" label="Геометрия появится в M6" muted />}
        {document.kind === 'specification' && <TreeRow depth={1} icon="tree" label="Разделы появятся в M6A" muted />}
        {document.kind === 'text' && <TreeRow depth={1} icon="text" label="Структура появится в M6A" muted />}
      </div>
    </div>
  );
}

function SketchTreeEntry(props: {
  id: CadSketchId;
  label: string;
  selected: boolean;
  showEdit: boolean;
  onSelect(): void;
  onEdit(): void;
}) {
  return (
    <div className="tree-sketch-entry">
      <TreeRow
        depth={1}
        icon="sketch"
        label={props.label}
        selected={props.selected}
        sketchId={props.id}
        onClick={props.onSelect}
      />
      {props.showEdit && (
        <button
          className="tree-sketch-edit"
          type="button"
          data-sketch-edit-id={props.id}
          aria-label={`Редактировать ${props.label}`}
          onClick={props.onEdit}
        >
          Редактировать
        </button>
      )}
    </div>
  );
}

function TreeRow(props: {
  depth: number;
  icon: CadIconName;
  label: string;
  muted?: boolean;
  bold?: boolean;
  selected?: boolean;
  bodyId?: CadBodyId;
  sketchId?: CadSketchId;
  onClick?: () => void;
}) {
  return (
    <button
      className={`tree-row ${props.muted ? 'muted' : ''} ${props.bold ? 'bold' : ''} ${props.onClick ? 'interactive' : ''} ${props.selected ? 'selected' : ''}`}
      type="button"
      style={{ paddingInlineStart: 10 + props.depth * 18 }}
      onClick={props.onClick}
      data-body-id={props.bodyId}
      data-sketch-id={props.sketchId}
      aria-pressed={props.bodyId || props.sketchId ? Boolean(props.selected) : undefined}
    >
      <span className="tree-chevron">{props.depth < 2 ? <CadIcon name="chevron" size={11} /> : null}</span>
      <span className="tree-icon"><CadIcon name={props.icon} size={15} /></span>
      <span className="tree-label">{props.label}</span>
    </button>
  );
}

function kindIcon(kind: CadDocument['kind']): CadIconName {
  switch (kind) {
    case 'part': return 'part';
    case 'assembly': return 'assembly';
    case 'drawing':
    case 'fragment': return 'drawing';
    case 'specification': return 'tree';
    case 'text': return 'text';
  }
}
