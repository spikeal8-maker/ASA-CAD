import React from 'react';
import type { CadDocument } from '../../contracts/document';
import type { CadBodyId, CadDimensionId } from '../../contracts/ids';
import type { CadViewportPick } from '../../contracts/render';
import { commandLabel, dimensionLabel, kindIcon } from '../presentation/CadEditorPresentation';

export function DocumentTree({
  document,
  selectedBodyId,
  onSelectBody,
  onEditDimension,
}: {
  document: CadDocument;
  selectedBodyId: CadBodyId | null;
  onSelectBody: (id: CadBodyId | null) => void;
  onEditDimension: (id: CadDimensionId) => void;
}) {
  return (
    <div className="tree-panel">
      <div className="panel-title-row">
        <strong>Дерево</strong>
        <button type="button" title="Параметры дерева">⋯</button>
      </div>
      <div className="tree-search"><span>⌕</span><input placeholder="Найти в дереве" /></div>
      <div className="tree-root">
        <TreeRow depth={0} icon={kindIcon(document.kind)} label={document.title} bold />
        {document.kind === 'part' && (
          <>
            <TreeRow depth={1} icon="⌖" label="Начало координат" />
            <TreeRow depth={2} icon="▱" label="Плоскость XY" muted />
            <TreeRow depth={2} icon="▱" label="Плоскость XZ" muted />
            <TreeRow depth={2} icon="▱" label="Плоскость YZ" muted />
            {document.sketches.map((item) => (
              <TreeRow key={item.id} depth={1} icon="⌗" label={item.name} />
            ))}
            {document.dimensions.map((dimension) => (
              <TreeRow
                key={dimension.id}
                depth={2}
                icon={dimension.type === 'diameter' ? 'Ø' : '↔'}
                label={`${dimensionLabel(dimension.name, dimension.type)}: ${dimension.value} мм`}
                onClick={() => onEditDimension(dimension.id)}
              />
            ))}
            {document.features.map((feature) => (
              <TreeRow key={feature.id} depth={1} icon="◇" label={feature.name} />
            ))}
            {document.bodies.map((body) => (
              <TreeRow
                key={body.id}
                depth={1}
                icon="⬡"
                label={body.name}
                selected={body.id === selectedBodyId}
                bodyId={body.id}
                onClick={() => onSelectBody(body.id)}
              />
            ))}
          </>
        )}
        {document.kind === 'assembly' && <TreeRow depth={1} icon="＋" label="Компоненты появятся в M4A" muted />}
        {document.kind === 'drawing' && <TreeRow depth={1} icon="▱" label="Листы появятся в M6" muted />}
        {document.kind === 'fragment' && <TreeRow depth={1} icon="⌗" label="Геометрия появится в M6" muted />}
        {document.kind === 'specification' && <TreeRow depth={1} icon="≣" label="Разделы появятся в M6A" muted />}
        {document.kind === 'text' && <TreeRow depth={1} icon="¶" label="Структура появится в M6A" muted />}
      </div>
    </div>
  );
}

function TreeRow(props: {
  depth: number;
  icon: string;
  label: string;
  muted?: boolean;
  bold?: boolean;
  selected?: boolean;
  bodyId?: CadBodyId;
  onClick?: () => void;
}) {
  return (
    <button
      className={`tree-row ${props.muted ? 'muted' : ''} ${props.bold ? 'bold' : ''} ${props.onClick ? 'interactive' : ''} ${props.selected ? 'selected' : ''}`}
      type="button"
      style={{ paddingInlineStart: 10 + props.depth * 18 }}
      onClick={props.onClick}
      data-body-id={props.bodyId}
      aria-pressed={props.bodyId ? Boolean(props.selected) : undefined}
    >
      <span className="tree-chevron">{props.depth < 2 ? '›' : ''}</span>
      <span className="tree-icon">{props.icon}</span>
      <span className="tree-label">{props.label}</span>
    </button>
  );
}

export interface ParameterPanelProps {
  activeCommand: string | null;
  requiresFaceSelection: boolean;
  selectedPick: CadViewportPick | null;
  sketchPlane: 'XY' | 'XZ' | 'YZ';
  setSketchPlane: (plane: 'XY' | 'XZ' | 'YZ') => void;
  rectangleWidth: number;
  rectangleHeight: number;
  setRectangleWidth: (value: number) => void;
  setRectangleHeight: (value: number) => void;
  circleDiameter: number;
  setCircleDiameter: (value: number) => void;
  extrudeDistance: number;
  setExtrudeDistance: (value: number) => void;
  filletRadius: number;
  setFilletRadius: (value: number) => void;
  dimensionEditValue: number;
  setDimensionEditValue: (value: number) => void;
  onCreateSketch: () => void;
  onCreateRectangle: () => void;
  onCreateCircle: () => void;
  onExtrude: () => void;
  onCut: () => void;
  onFillet: () => void;
  onDimensionEdit: () => void;
  onCancel: () => void;
}

export function ParameterPanel(props: ParameterPanelProps) {
  if (props.activeCommand === 'part.sketch.create') {
    return (
      <div className="parameter-panel">
        <div className="panel-title-row">
          <div><small>Эскиз</small><strong>{commandLabel('part.sketch.create', 'Создать эскиз')}</strong></div>
          <button type="button" onClick={props.onCancel} title="Закрыть">×</button>
        </div>
        <section className="parameter-section">
          <h3>{props.requiresFaceSelection ? 'Грань построения' : 'Плоскость построения'}</h3>
          {props.requiresFaceSelection ? (
            <>
              <p>Щёлкните по плоской грани модели. После подтверждения будет сохранён StableRef, а не временный индекс грани.</p>
              <div className={`selection-value ${props.selectedPick?.kind === 'face' ? 'selected' : ''}`}>
                <span>{props.selectedPick?.kind === 'face' ? '✓' : '◇'}</span>
                <strong>{props.selectedPick?.kind === 'face' ? 'Грань выбрана' : 'Ожидание выбора грани'}</strong>
                {props.selectedPick?.kind === 'face' && <small>{props.selectedPick.point.map((value) => value.toFixed(2)).join(', ')}</small>}
              </div>
            </>
          ) : (
            <>
              <p>Выберите базовую плоскость.</p>
              <div className="plane-grid">
                {(['XY', 'XZ', 'YZ'] as const).map((plane) => (
                  <button type="button" key={plane} className={props.sketchPlane === plane ? 'selected' : ''} onClick={() => props.setSketchPlane(plane)}>
                    <span>▱</span><strong>{plane}</strong>
                  </button>
                ))}
              </div>
            </>
          )}
        </section>
        <section className="parameter-section collapsed-preview">
          <h3>Ориентация</h3>
          <div className="property-row"><span>Нормаль</span><strong>Автоматически</strong></div>
        </section>
        <PanelActions primary="Создать" onPrimary={props.onCreateSketch} onCancel={props.onCancel} />
      </div>
    );
  }

  if (props.activeCommand === 'sketch.rectangle') {
    return (
      <div className="parameter-panel">
        <PanelHeader category="Эскиз" title={commandLabel('sketch.rectangle', 'Прямоугольник')} onCancel={props.onCancel} />
        <section className="parameter-section">
          <h3>Размеры</h3>
          <NumericField label="Ширина" value={props.rectangleWidth} onChange={props.setRectangleWidth} suffix="мм" />
          <NumericField label="Высота" value={props.rectangleHeight} onChange={props.setRectangleHeight} suffix="мм" />
          <p>Прямоугольник создаётся относительно начала координат и получает два управляющих размера.</p>
        </section>
        <PanelActions primary="Создать" onPrimary={props.onCreateRectangle} onCancel={props.onCancel} />
      </div>
    );
  }

  if (props.activeCommand === 'sketch.circle') {
    return (
      <div className="parameter-panel">
        <PanelHeader category="Эскиз" title={commandLabel('sketch.circle', 'Окружность')} onCancel={props.onCancel} />
        <section className="parameter-section">
          <h3>Окружность</h3>
          <NumericField label="Диаметр" value={props.circleDiameter} onChange={props.setCircleDiameter} suffix="мм" />
          <div className="property-row"><span>Центр</span><strong>0, 0</strong></div>
        </section>
        <PanelActions primary="Создать" onPrimary={props.onCreateCircle} onCancel={props.onCancel} />
      </div>
    );
  }

  if (props.activeCommand === 'part.extrude') {
    return (
      <div className="parameter-panel">
        <PanelHeader category="Элемент тела" title={commandLabel('part.extrude', 'Элемент выдавливания')} onCancel={props.onCancel} />
        <section className="parameter-section">
          <h3>Параметры</h3>
          <NumericField label="Расстояние" value={props.extrudeDistance} onChange={props.setExtrudeDistance} suffix="мм" />
          <p>При применении впервые загружается OpenCascade WASM и строится точный B-Rep на этом устройстве.</p>
        </section>
        <PanelActions primary="Создать" onPrimary={props.onExtrude} onCancel={props.onCancel} />
      </div>
    );
  }

  if (props.activeCommand === 'part.cutExtrude') {
    return (
      <div className="parameter-panel">
        <PanelHeader category="Вырез" title={commandLabel('part.cutExtrude', 'Вырезать выдавливанием')} onCancel={props.onCancel} />
        <section className="parameter-section">
          <h3>Условие окончания</h3>
          <div className="selection-value selected"><span>↕</span><strong>Сквозь всё</strong><small>Вдоль нормали эскиза</small></div>
        </section>
        <PanelActions primary="Создать" onPrimary={props.onCut} onCancel={props.onCancel} />
      </div>
    );
  }

  if (props.activeCommand === 'part.fillet') {
    return (
      <div className="parameter-panel">
        <PanelHeader category="Элемент тела" title={commandLabel('part.fillet', 'Скругление')} onCancel={props.onCancel} />
        <section className="parameter-section">
          <h3>Ребро</h3>
          <div className={`selection-value ${props.selectedPick?.kind === 'edge' ? 'selected' : ''}`}>
            <span>{props.selectedPick?.kind === 'edge' ? '✓' : '⌁'}</span>
            <strong>{props.selectedPick?.kind === 'edge' ? 'Ребро выбрано' : 'Выберите ребро в модели'}</strong>
            {props.selectedPick?.kind === 'edge' && <small>{props.selectedPick.point.map((value) => value.toFixed(2)).join(', ')}</small>}
          </div>
          <NumericField label="Радиус" value={props.filletRadius} onChange={props.setFilletRadius} suffix="мм" />
        </section>
        <PanelActions primary="Создать" onPrimary={props.onFillet} onCancel={props.onCancel} />
      </div>
    );
  }

  if (props.activeCommand === 'dimension.edit') {
    return (
      <div className="parameter-panel">
        <PanelHeader category="Управляющий размер" title="Изменить размер" onCancel={props.onCancel} />
        <section className="parameter-section">
          <h3>Значение</h3>
          <NumericField label="Размер" value={props.dimensionEditValue} onChange={props.setDimensionEditValue} suffix="мм" />
          <p>После применения вся история детали перестраивается от изменённого эскиза вниз.</p>
        </section>
        <PanelActions primary="Применить" onPrimary={props.onDimensionEdit} onCancel={props.onCancel} />
      </div>
    );
  }

  return (
    <div className="parameter-panel empty-parameters">
      <div className="panel-title-row"><strong>Параметры</strong></div>
      <div className="empty-panel-message">
        <span>≡</span><strong>Нет активной команды</strong>
        <p>При запуске операции эта панель автоматически показывает её параметры.</p>
      </div>
    </div>
  );
}

function PanelHeader(props: { category: string; title: string; onCancel: () => void }) {
  return (
    <div className="panel-title-row">
      <div><small>{props.category}</small><strong>{props.title}</strong></div>
      <button type="button" onClick={props.onCancel} title="Закрыть">×</button>
    </div>
  );
}

function PanelActions(props: { primary: string; onPrimary: () => void; onCancel: () => void }) {
  return (
    <div className="parameter-actions">
      <button className="primary" type="button" onClick={props.onPrimary}>{props.primary}</button>
      <button type="button" onClick={props.onCancel}>Отмена</button>
    </div>
  );
}

function NumericField(props: {
  label: string;
  value: number;
  suffix: string;
  onChange: (value: number) => void;
}) {
  return (
    <label className="numeric-field">
      <span>{props.label}</span>
      <span className="numeric-control">
        <input
          type="number"
          min="0.01"
          step="1"
          value={Number.isFinite(props.value) ? props.value : 0}
          onChange={(event) => props.onChange(Number(event.target.value))}
        />
        <small>{props.suffix}</small>
      </span>
    </label>
  );
}
