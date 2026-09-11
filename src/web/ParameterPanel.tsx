import React from 'react';
import commandRegistryJson from '../../spec/ui/command-registry.v1.json';
import type { CadViewportPick } from '../contracts/render';

interface RegistryCommand {
  id: string;
  labelRu: string;
}

const commandById = new Map(
  (commandRegistryJson as { commands: RegistryCommand[] }).commands.map((command) => [command.id, command]),
);

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

/**
 * Presentation-only parameters surface. Command execution and application
 * lifecycle remain owned by the editor/controller and are injected as callbacks.
 */
export function ParameterPanel(props: ParameterPanelProps) {
  if (props.activeCommand === 'part.sketch.create') {
    return (
      <div className="parameter-panel">
        <div className="panel-title-row">
          <div>
            <small>Эскиз</small>
            <strong>{commandLabel('part.sketch.create', 'Создать эскиз')}</strong>
          </div>
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
                  <button
                    type="button"
                    key={plane}
                    className={props.sketchPlane === plane ? 'selected' : ''}
                    onClick={() => props.setSketchPlane(plane)}
                  >
                    <span>▱</span>
                    <strong>{plane}</strong>
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
        <div className="parameter-actions">
          <button className="primary" type="button" onClick={props.onCreateSketch}>Создать</button>
          <button type="button" onClick={props.onCancel}>Отмена</button>
        </div>
      </div>
    );
  }

  if (props.activeCommand === 'sketch.rectangle') {
    return (
      <div className="parameter-panel">
        <div className="panel-title-row">
          <div>
            <small>Эскиз</small>
            <strong>{commandLabel('sketch.rectangle', 'Прямоугольник')}</strong>
          </div>
          <button type="button" onClick={props.onCancel} title="Закрыть">×</button>
        </div>
        <section className="parameter-section">
          <h3>Размеры</h3>
          <NumericField label="Ширина" value={props.rectangleWidth} onChange={props.setRectangleWidth} suffix="мм" />
          <NumericField label="Высота" value={props.rectangleHeight} onChange={props.setRectangleHeight} suffix="мм" />
          <p>Прямоугольник создаётся относительно начала координат и получает два управляющих размера.</p>
        </section>
        <div className="parameter-actions">
          <button className="primary" type="button" onClick={props.onCreateRectangle}>Создать</button>
          <button type="button" onClick={props.onCancel}>Отмена</button>
        </div>
      </div>
    );
  }

  if (props.activeCommand === 'sketch.circle') {
    return (
      <div className="parameter-panel">
        <div className="panel-title-row">
          <div>
            <small>Эскиз</small>
            <strong>{commandLabel('sketch.circle', 'Окружность')}</strong>
          </div>
          <button type="button" onClick={props.onCancel} title="Закрыть">×</button>
        </div>
        <section className="parameter-section">
          <h3>Окружность</h3>
          <NumericField label="Диаметр" value={props.circleDiameter} onChange={props.setCircleDiameter} suffix="мм" />
          <div className="property-row"><span>Центр</span><strong>0, 0</strong></div>
        </section>
        <div className="parameter-actions">
          <button className="primary" type="button" onClick={props.onCreateCircle}>Создать</button>
          <button type="button" onClick={props.onCancel}>Отмена</button>
        </div>
      </div>
    );
  }

  if (props.activeCommand === 'part.extrude') {
    return (
      <div className="parameter-panel">
        <div className="panel-title-row">
          <div>
            <small>Элемент тела</small>
            <strong>{commandLabel('part.extrude', 'Элемент выдавливания')}</strong>
          </div>
          <button type="button" onClick={props.onCancel} title="Закрыть">×</button>
        </div>
        <section className="parameter-section">
          <h3>Параметры</h3>
          <NumericField label="Расстояние" value={props.extrudeDistance} onChange={props.setExtrudeDistance} suffix="мм" />
          <p>При применении впервые загружается OpenCascade WASM и строится точный B-Rep на этом устройстве.</p>
        </section>
        <div className="parameter-actions">
          <button className="primary" type="button" onClick={props.onExtrude}>Создать</button>
          <button type="button" onClick={props.onCancel}>Отмена</button>
        </div>
      </div>
    );
  }

  if (props.activeCommand === 'part.cutExtrude') {
    return (
      <div className="parameter-panel">
        <div className="panel-title-row">
          <div>
            <small>Вырез</small>
            <strong>{commandLabel('part.cutExtrude', 'Вырезать выдавливанием')}</strong>
          </div>
          <button type="button" onClick={props.onCancel} title="Закрыть">×</button>
        </div>
        <section className="parameter-section">
          <h3>Условие окончания</h3>
          <div className="selection-value selected">
            <span>↕</span>
            <strong>Сквозь всё</strong>
            <small>Вдоль нормали эскиза</small>
          </div>
        </section>
        <div className="parameter-actions">
          <button className="primary" type="button" onClick={props.onCut}>Создать</button>
          <button type="button" onClick={props.onCancel}>Отмена</button>
        </div>
      </div>
    );
  }

  if (props.activeCommand === 'part.fillet') {
    return (
      <div className="parameter-panel">
        <div className="panel-title-row">
          <div>
            <small>Элемент тела</small>
            <strong>{commandLabel('part.fillet', 'Скругление')}</strong>
          </div>
          <button type="button" onClick={props.onCancel} title="Закрыть">×</button>
        </div>
        <section className="parameter-section">
          <h3>Ребро</h3>
          <div className={`selection-value ${props.selectedPick?.kind === 'edge' ? 'selected' : ''}`}>
            <span>{props.selectedPick?.kind === 'edge' ? '✓' : '⌁'}</span>
            <strong>{props.selectedPick?.kind === 'edge' ? 'Ребро выбрано' : 'Выберите ребро в модели'}</strong>
            {props.selectedPick?.kind === 'edge' && <small>{props.selectedPick.point.map((value) => value.toFixed(2)).join(', ')}</small>}
          </div>
          <NumericField label="Радиус" value={props.filletRadius} onChange={props.setFilletRadius} suffix="мм" />
        </section>
        <div className="parameter-actions">
          <button className="primary" type="button" onClick={props.onFillet}>Создать</button>
          <button type="button" onClick={props.onCancel}>Отмена</button>
        </div>
      </div>
    );
  }

  if (props.activeCommand === 'dimension.edit') {
    return (
      <div className="parameter-panel">
        <div className="panel-title-row">
          <div>
            <small>Управляющий размер</small>
            <strong>Изменить размер</strong>
          </div>
          <button type="button" onClick={props.onCancel} title="Закрыть">×</button>
        </div>
        <section className="parameter-section">
          <h3>Значение</h3>
          <NumericField label="Размер" value={props.dimensionEditValue} onChange={props.setDimensionEditValue} suffix="мм" />
          <p>После применения вся история детали перестраивается от изменённого эскиза вниз.</p>
        </section>
        <div className="parameter-actions">
          <button className="primary" type="button" onClick={props.onDimensionEdit}>Применить</button>
          <button type="button" onClick={props.onCancel}>Отмена</button>
        </div>
      </div>
    );
  }

  return (
    <div className="parameter-panel empty-parameters">
      <div className="panel-title-row"><strong>Параметры</strong></div>
      <div className="empty-panel-message">
        <span>≡</span>
        <strong>Нет активной команды</strong>
        <p>При запуске операции эта панель автоматически показывает её параметры.</p>
      </div>
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

function commandLabel(id: string, fallback: string): string {
  return commandById.get(id)?.labelRu ?? fallback;
}
