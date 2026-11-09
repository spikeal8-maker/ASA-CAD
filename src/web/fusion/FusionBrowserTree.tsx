import React, {useEffect, useState} from 'react';
import type {DocumentTreeProps} from '../DocumentTree';
import {CadIcon, type CadIconName} from '../CadIcon';
import {SketchTreeBranch} from '../SketchTreeBranch';
import {dimensionLabel, dimensionUnit} from '../SketchDimensionPresentation';
import type {CadDimensionId, CadSketchId} from '../../contracts/ids';

type Group = 'component' | 'settings' | 'views' | 'origin' | 'sketches' | 'features' | 'bodies';
const initialGroups: Record<Group, boolean> = {
  component: true, settings: true, views: false, origin: true,
  sketches: true, features: true, bodies: true,
};
const unitLabels = {mm: 'мм', cm: 'см', m: 'м', inch: 'дюймы'} as const;

/**
 * Native Fusion Browser presentation, isolated from the generic DocumentTree.
 * Data, selection and edit actions always come from the existing CAD document.
 * Origin and Sketches are siblings: collapsing Origin must not hide sketches.
 */
export function FusionBrowserTree(p: DocumentTreeProps) {
  const [expanded, setExpanded] = useState<Record<Group, boolean>>(initialGroups);
  const [selectedSketchId, setSelectedSketchId] = useState<CadSketchId | null>(null);

  useEffect(() => {
    setExpanded(initialGroups);
    setSelectedSketchId(null);
  }, [p.document.documentId]);
  useEffect(() => {
    // The native active-Sketch browser keeps the Sketches group expanded.
    // Restore Origin for another plane selection after Finish Sketch.
    setExpanded(current => ({
      ...current, component: true, sketches: true, origin: !p.activeSketchId,
    }));
  }, [p.activeSketchId]);

  if (p.document.kind !== 'part') return null;
  const document = p.document;
  const toggle = (group: Group) =>
    setExpanded(current => ({...current, [group]: !current[group]}));
  const ownerCounts = new Map<CadDimensionId, number>();
  for (const sketch of document.sketches) {
    for (const dimensionId of new Set(sketch.dimensionIds)) {
      ownerCounts.set(dimensionId, (ownerCounts.get(dimensionId) ?? 0) + 1);
    }
  }
  const selectedSketch = selectedSketchId && document.sketches.some(s => s.id === selectedSketchId)
    ? selectedSketchId : null;

  return <div className="tree-panel fusion-browser-tree"
    data-active-sketch-id={p.activeSketchId ?? ''}
    data-selected-sketch-id={selectedSketch ?? ''}>
    <div className="tree-root" role="tree" aria-label="Дерево документа Fusion">
      <Branch id="component" depth={0} icon="part" label={document.title} bold
        expanded={expanded.component} onToggle={() => toggle('component')}/>
      {expanded.component && <>
        <Branch id="settings" depth={1} icon="tree" label="Настройки документа"
          expanded={expanded.settings} onToggle={() => toggle('settings')}/>
        {expanded.settings && <>
          <Leaf depth={2} icon="info" label={'Единицы: '+unitLabels[document.units]} nodeId="document-units"/>
          <Leaf depth={2} icon="part" label="Проектирование деталей" nodeId="document-part-design"/>
        </>}
        <Branch id="views" depth={1} icon="tree" label="Именованные виды"
          expanded={expanded.views} onToggle={() => toggle('views')}/>
        {expanded.views && <Leaf depth={2} icon="info" label="Сохранённых видов нет" muted nodeId="named-views-empty"/>}
        <Branch id="origin" depth={1} icon="origin" label="Начало координат"
          expanded={expanded.origin} onToggle={() => toggle('origin')}/>
        {expanded.origin && document.origin.planes.map(plane =>
          <Leaf key={plane} depth={2} icon="plane" label={'Плоскость '+plane}
            nodeId={'plane-'+plane.toLowerCase()} planeId={plane}
            selected={p.selectedPlane===plane} onClick={() => p.onSelectPlane?.(plane)}/>)}
        <Branch id="sketches" depth={1} icon="sketch" label="Эскизы"
          expanded={expanded.sketches} onToggle={() => toggle('sketches')}/>
        {expanded.sketches && document.sketches.map(sketch =>
          <div key={sketch.id} className="fusion-browser-sketch" onDoubleClick={event => {
            if ((event.target as Element).closest('[data-sketch-id]')) p.onEditSketch(sketch.id);
          }}>
            <SketchTreeBranch sketch={sketch}
              dimensions={document.dimensions.filter(d => sketch.dimensionIds.includes(d.id)
                && ownerCounts.get(d.id)===1)}
              selected={sketch.id===p.activeSketchId || sketch.id===selectedSketch}
              showEdit={sketch.id===selectedSketch}
              onSelect={() => setSelectedSketchId(sketch.id)}
              onEdit={() => p.onEditSketch(sketch.id)}
              onEditDimension={p.onEditDimension}/>
          </div>)}
        {document.features.length>0 && <>
          <Branch id="features" depth={1} icon="feature" label="Операции"
            expanded={expanded.features} onToggle={() => toggle('features')}/>
          {expanded.features && document.features.map(f =>
            <Leaf key={f.id} depth={2} icon="feature" label={f.name} nodeId={'feature-'+f.id}/>)}
        </>}
        {document.bodies.length>0 && <>
          <Branch id="bodies" depth={1} icon="body" label="Тела"
            expanded={expanded.bodies} onToggle={() => toggle('bodies')}/>
          {expanded.bodies && document.bodies.map(body =>
            <Leaf key={body.id} depth={2} icon="body" label={body.name}
              selected={body.id===p.selectedBodyId} onClick={() => p.onSelectBody(body.id)}
              nodeId={'body-'+body.id}/>)}
        </>}
        {document.dimensions.filter(d => ownerCounts.get(d.id)!==1).map(d =>
          <Leaf key={d.id} depth={1} icon="info" muted
            label={'Размер без единственного эскиза: '+dimensionLabel(d.name, d.type)+
              ': '+d.value+' '+dimensionUnit(d.type)}
            nodeId={'dimension-ownership-'+d.id}/>)}
      </>}
    </div>
  </div>;
}

function Branch(p: {
  id: Group; depth: number; icon: CadIconName; label: string;
  bold?: boolean; expanded: boolean; onToggle(): void;
}) {
  return <div className={'tree-row tree-branch-row fusion-browser-branch'+(p.bold?' bold':'')}
    style={{paddingInlineStart: 7+p.depth*17}} data-tree-branch={p.id}>
    <button className="tree-disclosure" type="button" data-tree-disclosure={p.id}
      aria-label={(p.expanded?'Свернуть ':'Развернуть ')+p.label}
      aria-expanded={p.expanded} onClick={p.onToggle}>
      <CadIcon name="chevron" size={11}/>
    </button>
    <span className="tree-icon"><CadIcon name={p.icon} size={15}/></span>
    <span className="tree-label">{p.label}</span>
  </div>;
}

function Leaf(p: {
  depth: number; icon: CadIconName; label: string; muted?: boolean;
  selected?: boolean; nodeId?: string; planeId?: 'XY'|'XZ'|'YZ';
  onClick?: () => void;
}) {
  const attrs = {
    className: 'tree-row fusion-browser-leaf'+(p.muted?' muted':'')+
      (p.selected?' selected':'')+(p.onClick?' interactive':''),
    style: {paddingInlineStart: 7+p.depth*17},
    'data-tree-node': p.nodeId,
    'data-plane-id': p.planeId,
    'aria-pressed': p.planeId ? !!p.selected : undefined,
  } as const;
  const content = <>
    <span className="tree-chevron" aria-hidden="true"/>
    <span className="tree-icon"><CadIcon name={p.icon} size={15}/></span>
    <span className="tree-label">{p.label}</span>
  </>;
  return p.onClick
    ? <button type="button" {...attrs} onClick={p.onClick}>{content}</button>
    : <div {...attrs}>{content}</div>;
}
