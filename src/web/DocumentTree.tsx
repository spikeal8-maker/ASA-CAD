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
  const [partExpanded, setPartExpanded] = useState(true);
  const [originExpanded, setOriginExpanded] = useState(true);

  useEffect(() => setSelectedSketchId(null), [document]);
  useEffect(() => {
    setPartExpanded(true);
    setOriginExpanded(true);
  }, [document.documentId]);

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
        {document.kind === 'part' ? (
          <>
            <TreeBranchRow
              branchId="part-root"
              depth={0}
              icon={kindIcon(document.kind)}
              label={document.title}
              bold
              expanded={partExpanded}
              onToggle={() => setPartExpanded((value) => !value)}
            />
            {partExpanded && (
              <>
                <TreeBranchRow
                  branchId="origin"
                  depth={1}
                  icon="origin"
                  label="Начало координат"
                  expanded={originExpanded}
                  onToggle={() => setOriginExpanded((value) => !value)}
                />
                {originExpanded && (
                  <>
                    <TreeRow depth={2} icon="plane" label="Плоскость XY" muted nodeId="plane-xy" />
                    <TreeRow depth={2} icon="plane" label="Плоскость XZ" muted nodeId="plane-xz" />
                    <TreeRow depth={2} icon="plane" label="Плоскость YZ" muted nodeId="plane-yz" />
                  </>
                )}
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
          </>
        ) : (
          <>
            <TreeRow depth={0} icon={kindIcon(document.kind)} label={document.title} bold />
            {document.kind === 'assembly' && <TreeRow depth={1} icon="assembly" label="Компоненты появятся в M4A" muted />}
            {document.kind === 'drawing' && <TreeRow depth={1} icon="drawing" label="Листы появятся в M6" muted />}
            {document.kind === 'fragment' && <TreeRow depth={1} icon="drawing" label="Геометрия появится в M6" muted />}
            {document.kind === 'specification' && <TreeRow depth={1} icon="tree" label="Разделы появятся в M6A" muted />}
            {document.kind === 'text' && <TreeRow depth={1} icon="text" label="Структура появится в M6A" muted />}
          </>
        )}
      </div>
    </div>
  );
}

function TreeBranchRow(props: {
  branchId: 'part-root' | 'origin';
  depth: number;
  icon: CadIconName;
  label: string;
  bold?: boolean;
  expanded: boolean;
  onToggle(): void;
}) {
  return (
    <div
      className={`tree-row tree-branch-row ${props.bold ? 'bold' : ''}`}
      style={{ paddingInlineStart: 10 + props.depth * 18 }}
      data-tree-branch={props.branchId}
    >
      <button
        className="tree-disclosure"
        type="button"
        data-tree-disclosure={props.branchId}
        aria-label={`${props.expanded ? 'Свернуть' : 'Развернуть'} ${props.label}`}
        aria-expanded={props.expanded}
        onClick={props.onToggle}
      >
        <CadIcon name="chevron" size={11} />
      </button>
      <span className="tree-icon"><CadIcon name={props.icon} size={15} /></span>
      <span className="tree-label">{props.label}</span>
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
  nodeId?: string;
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
      data-tree-node={props.nodeId}
      aria-pressed={props.bodyId || props.sketchId ? Boolean(props.selected) : undefined}
    >
      <span className="tree-chevron" aria-hidden="true" />
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
