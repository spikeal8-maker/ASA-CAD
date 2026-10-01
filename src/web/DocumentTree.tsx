import React, { useEffect, useState } from 'react';
import type { CadDocument } from '../contracts/document';
import type { CadBodyId, CadDimensionId, CadSketchId } from '../contracts/ids';
import { CadIcon, type CadIconName } from './CadIcon';
import { dimensionLabel, dimensionUnit } from './SketchDimensionPresentation';
import { documentTreeFilter } from './DocumentTreeFilter';
import { SketchTreeBranch } from './SketchTreeBranch';

export interface DocumentTreeProps {
  document: CadDocument;
  selectedBodyId: CadBodyId | null;
  activeSketchId: CadSketchId | null;
  onSelectBody(id: CadBodyId | null): void;
  onEditSketch(id: CadSketchId): void;
  onEditDimension(id: CadDimensionId): void;
}

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
  const [treeQuery, setTreeQuery] = useState('');

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
  const {
    dimensionOwnerCounts,
    filtering,
    matches,
    visibleSketches,
    visibleFeatures,
    visibleBodies,
    visibleOwnershipIssues,
    originMatches,
    noMatches,
  } = documentTreeFilter(document, treeQuery);
  const partChildrenVisible = partExpanded || filtering;
  const originChildrenVisible = originExpanded || filtering;

  return (
    <div className="tree-panel" data-selected-sketch-id={selectedSketch ?? ''}>
      <div className="panel-title-row">
        <strong>Дерево</strong>
        <button type="button" title="Параметры дерева — пока недоступно" aria-disabled="true" disabled>⋯</button>
      </div>
      <label className="tree-search">
        <CadIcon name="search" size={14} />
        <input
          aria-label="Найти в дереве"
          placeholder="Найти в дереве"
          value={treeQuery}
          onChange={(event) => setTreeQuery(event.target.value)}
        />
      </label>
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
            {partChildrenVisible && (
              <>
                {originMatches && (
                  <TreeBranchRow
                    branchId="origin"
                    depth={1}
                    icon="origin"
                    label="Начало координат"
                    expanded={originExpanded || filtering}
                    onToggle={() => setOriginExpanded((value) => !value)}
                  />
                )}
                {originMatches && originChildrenVisible && (
                  <>
                    {(!filtering || matches('Плоскость XY')) && <TreeRow depth={2} icon="plane" label="Плоскость XY" muted nodeId="plane-xy" />}
                    {(!filtering || matches('Плоскость XZ')) && <TreeRow depth={2} icon="plane" label="Плоскость XZ" muted nodeId="plane-xz" />}
                    {(!filtering || matches('Плоскость YZ')) && <TreeRow depth={2} icon="plane" label="Плоскость YZ" muted nodeId="plane-yz" />}
                  </>
                )}
                {visibleSketches.map((sketch) => (
                  <SketchTreeBranch
                    key={sketch.id}
                    sketch={sketch}
                    dimensions={document.dimensions.filter(
                      (dimension) => sketch.dimensionIds.includes(dimension.id)
                        && dimensionOwnerCounts.get(dimension.id) === 1,
                    )}
                    selected={sketch.id === activeSketchId || sketch.id === selectedSketch}
                    showEdit={sketch.id === selectedSketch}
                    onSelect={() => setSelectedSketchId(sketch.id)}
                    onEdit={() => onEditSketch(sketch.id)}
                    onEditDimension={onEditDimension}
                  />
                ))}
                {visibleOwnershipIssues.map((dimension) => {
                  const ownerCount = dimensionOwnerCounts.get(dimension.id) ?? 0;
                  return (
                    <TreeRow
                      key={dimension.id}
                      depth={1}
                      icon="info"
                      label={`${ownerCount === 0 ? 'Несвязанный размер' : 'Конфликт владельца размера'}: ${dimensionLabel(dimension.name, dimension.type)}: ${dimension.value} ${dimensionUnit(dimension.type)}`}
                      nodeId={`dimension-ownership-${dimension.id}`}
                    />
                  );
                })}
                {visibleFeatures.map((feature) => (
                  <TreeRow key={feature.id} depth={1} icon="feature" label={feature.name} />
                ))}
                {visibleBodies.map((body) => (
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
                {noMatches && <div className="tree-search-empty">Совпадений нет</div>}
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

function TreeRow(props: {
  depth: number;
  icon: CadIconName;
  label: string;
  muted?: boolean;
  bold?: boolean;
  selected?: boolean;
  bodyId?: CadBodyId;
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
      data-tree-node={props.nodeId}
      aria-pressed={props.bodyId ? Boolean(props.selected) : undefined}
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
