import React from 'react';
import type { CadPlaneName } from '../../contracts/commands';
import type { CadDimensionId, CadSketchId } from '../../contracts/ids';
import type { CadSketch, CadSketchEntity } from '../../contracts/sketch';
import type { DocumentTreeProps } from '../DocumentTree';
import { dimensionLabel, dimensionUnit } from '../SketchDimensionPresentation';
import { KIcon } from './KompasIcon';
import { kompasShell } from './kompasShellStore';

const PLANE_ICON_CLASS: Record<CadPlaneName, string> = { XY: 'k-ic-xy', XZ: 'k-ic-zx', YZ: 'k-ic-zy' };
const FEATURE_ICON: Record<string, string> = { extrude: 'extrude', 'cut-extrude': 'cut', fillet: 'fillet' };

interface RowProps {
  depth: number;
  icon: string;
  iconClass?: string;
  label: string;
  expanded?: boolean;
  onToggle?(): void;
  selected?: boolean;
  eye?: boolean;
  dot?: boolean;
  aux?: string;
  onClick?(): void;
  onDoubleClick?(): void;
  data?: Record<string, string | undefined>;
  children?: React.ReactNode;
}

/** One KOMPAS tree row: visibility gutter, auxiliary gutter and the object itself. */
function Row(props: RowProps) {
  const hasToggle = props.expanded !== undefined;
  return (
    <div
      className={`k-tree-row${props.selected ? ' k-sel' : ''}`}
      role="treeitem"
      aria-level={props.depth + 1}
      aria-selected={Boolean(props.selected)}
      aria-expanded={hasToggle ? props.expanded : undefined}
      onClick={props.onClick}
      onDoubleClick={props.onDoubleClick}
      {...props.data}
    >
      <span className="k-c-eye">
        {props.eye && (
          <button type="button" className="k-eye-btn" aria-label="Видимость" data-tip="Видимость" data-dis="Управления видимостью в ASA-CAD пока нет"
            onClick={(event) => { event.stopPropagation(); kompasShell.toast('Управления видимостью в ASA-CAD пока нет'); }}>
            <KIcon name="eye" size={14} />
          </button>
        )}
      </span>
      <span className="k-c-aux">{props.aux ?? ''}</span>
      <span className="k-c-main" style={{ paddingLeft: 6 + props.depth * 14 }}>
        {hasToggle ? (
          <button type="button" className="k-tri" aria-expanded={props.expanded} aria-label={`${props.expanded ? 'Свернуть' : 'Развернуть'} ${props.label}`}
            onClick={(event) => { event.stopPropagation(); props.onToggle?.(); }}>
            <KIcon name="caret" size={9} />
          </button>
        ) : <span className="k-tri-sp" />}
        <KIcon name={props.icon} size={16} className={props.iconClass} />
        {props.dot && <span className="k-odot">●</span>}
        <span className="k-lbl">{props.label}</span>
        {props.children}
      </span>
    </div>
  );
}

function entityName(entities: readonly CadSketchEntity[], index: number): string {
  const entity = entities[index]!;
  const ordinal = entities.slice(0, index + 1).filter((item) => item.type === entity.type).length;
  return `${entity.type === 'line' ? 'Отрезок' : entity.type === 'circle' ? 'Окружность' : 'Дуга'} ${ordinal}`;
}

/** Build tree of the KOMPAS shell over the real Part document and the shared selection. */
export function KompasTree(props: DocumentTreeProps) {
  const { document } = props;
  const [open, setOpen] = React.useState<Record<string, boolean>>({ root: true, origin: true });
  const [selectedSketch, setSelectedSketch] = React.useState<CadSketchId | null>(null);
  const [query, setQuery] = React.useState('');
  const toggle = (key: string) => setOpen((value) => ({ ...value, [key]: !(value[key] ?? true) }));
  const isOpen = (key: string) => open[key] ?? true;
  const q = query.trim().toLowerCase();
  const visible = (label: string) => !q || label.toLowerCase().includes(q);

  const part = document.kind === 'part' ? document : null;
  const rows: React.ReactNode[] = [];
  const title = part ? `${document.title} (Тел-${part.bodies.length})` : document.title;
  rows.push(
    <Row key="root" depth={0} icon="part" label={title} expanded={isOpen('root')} onToggle={() => toggle('root')} data={{ 'data-tree-branch': 'part-root' }} />,
  );
  if (part && isOpen('root')) {
    rows.push(<Row key="origin" depth={1} icon="origin" label="Начало координат" expanded={isOpen('origin')} onToggle={() => toggle('origin')} eye dot data={{ 'data-tree-branch': 'origin' }} />);
    if (isOpen('origin')) {
      for (const plane of part.origin.planes) {
        const label = `Плоскость ${plane}`;
        if (!visible(label)) continue;
        rows.push(
          <Row key={plane} depth={2} icon="planeTree" iconClass={PLANE_ICON_CLASS[plane]} label={label} eye selected={plane === props.selectedPlane}
            onClick={() => props.onSelectPlane?.(plane)}
            data={{ 'data-plane-id': plane, 'data-tree-node': `plane-${plane.toLowerCase()}` }} />,
        );
      }
    }
    for (const sketch of part.sketches) rows.push(...sketchRows(sketch));
    for (const feature of part.features) {
      if (visible(feature.name)) rows.push(<Row key={feature.id} depth={1} icon={FEATURE_ICON[feature.type] ?? 'extrude'} label={feature.name} eye data={{ 'data-feature-id': feature.id }} />);
    }
    for (const body of part.bodies) {
      if (!visible(body.name)) continue;
      rows.push(
        <Row key={body.id} depth={1} icon="ts_solid" label={body.name} eye selected={body.id === props.selectedBodyId}
          onClick={() => props.onSelectBody(body.id)} data={{ 'data-body-id': body.id }} />,
      );
    }
  }

  function sketchRows(sketch: CadSketch): React.ReactNode[] {
    if (!part) return [];
    const key = `sketch:${sketch.id}`;
    const selected = sketch.id === props.activeSketchId || sketch.id === selectedSketch;
    const out: React.ReactNode[] = [];
    if (visible(sketch.name)) {
      out.push(
        <Row key={key} depth={1} icon="ts_sketch" label={sketch.name} aux="∈" eye selected={selected}
          expanded={isOpen(key)} onToggle={() => toggle(key)}
          onClick={() => setSelectedSketch(sketch.id)}
          onDoubleClick={() => props.onEditSketch(sketch.id)}
          data={{ 'data-tree-branch': key, 'data-sketch-id': sketch.id }}>
          {sketch.id === selectedSketch && sketch.id !== props.activeSketchId && (
            <button type="button" className="k-row-edit" data-sketch-edit-id={sketch.id} aria-label={`Редактировать ${sketch.name}`} data-tip="Редактировать эскиз (двойной щелчок)"
              onClick={(event) => { event.stopPropagation(); props.onEditSketch(sketch.id); }}>
              <KIcon name="pipette" size={14} />
            </button>
          )}
        </Row>,
      );
    }
    if (!isOpen(key)) return out;
    sketch.entities.forEach((entity, index) => {
      const label = entityName(sketch.entities, index);
      if (visible(label)) {
        out.push(<Row key={entity.id} depth={2} icon={entity.type} label={label} data={{ 'data-tree-sketch-entity-id': entity.id, 'data-sketch-entity-type': entity.type }} />);
      }
    });
    for (const dimension of part.dimensions.filter((item) => sketch.dimensionIds.includes(item.id))) {
      const label = `${dimensionLabel(dimension.name, dimension.type)}: ${dimension.value} ${dimensionUnit(dimension.type)}`;
      if (visible(label)) {
        out.push(<Row key={dimension.id} depth={2} icon="dimlin" label={label} onClick={() => props.onEditDimension(dimension.id as CadDimensionId)} data={{ 'data-dimension-id': dimension.id }} />);
      }
    }
    return out;
  }

  return (
    <div className="k-tree-panel" data-selected-sketch-id={selectedSketch ?? ''}>
      <div className="k-panel-head">
        <span>Дерево</span>
        <button type="button" aria-label="Настройки дерева" onClick={() => kompasShell.toast('Настроек дерева в ASA-CAD пока нет')}><KIcon name="gear" size={14} /></button>
      </div>
      <div className="k-tree-toolbar">
        {['tree', 'params', 'layers', 'grid', 'collection'].map((icon, index) => (
          <button key={icon} type="button" aria-label={`Режим дерева ${index + 1}`} onClick={() => kompasShell.toast('Других режимов дерева в ASA-CAD пока нет')}><KIcon name={icon} size={16} /></button>
        ))}
      </div>
      <div className="k-tree-search">
        <button type="button" aria-label="Фильтр" onClick={() => kompasShell.toast('Фильтра дерева в ASA-CAD пока нет')}><KIcon name="filter" size={16} /></button>
        <label><KIcon name="search" size={13} /><input type="text" placeholder="Поиск (Ctrl+/)" aria-label="Поиск в дереве" value={query} onChange={(event) => setQuery(event.target.value)} /></label>
      </div>
      <div className="k-tree-rows" role="tree" aria-label="Дерево построения">
        {rows}
        <div className="k-tree-end" aria-hidden="true" />
      </div>
      <KompasTreeLower />
    </div>
  );
}

function KompasTreeLower() {
  const [tab, setTab] = React.useState(0);
  return (
    <div className="k-tree-lower">
      <div className="k-lower-tabs" role="tablist">
        {['tree', 'params', 'fx'].map((icon, index) => (
          <button key={icon} type="button" role="tab" aria-selected={tab === index} aria-label={`Вкладка ${index + 1}`} onClick={() => setTab(index)}><KIcon name={icon} size={15} /></button>
        ))}
      </div>
    </div>
  );
}
