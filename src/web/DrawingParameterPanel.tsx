import React from 'react';
import { ParameterNumericField } from './ParameterNumericField';
import type { DrawingWorkspace } from './useDrawingWorkspace';

export function DrawingParameterPanel(props: { workspace: DrawingWorkspace }) {
  const workspace = props.workspace;
  const sheet = workspace.sheet;
  if (!sheet) {
    return (
      <div className="parameter-panel">
        <div className="panel-title-row"><strong>Параметры</strong></div>
        <div className="empty-panel-message"><strong>Нет рабочего листа</strong></div>
      </div>
    );
  }

  if (workspace.activeCommand === 'draft.line') {
    return (
      <div className="parameter-panel drawing-parameter-panel">
        <div className="panel-title-row">
          <div><small>Черчение</small><strong>Отрезок</strong></div>
          <button type="button" onClick={workspace.cancelCommand} title="Закрыть">×</button>
        </div>
        <div className="drawing-parameter-body">
          <section className="parameter-section">
            <h3>Построение</h3>
            <p>{workspace.lineDraft.from ? 'Укажите вторую точку отрезка.' : 'Укажите первую точку на листе.'}</p>
            <div className="property-row"><span>Лист</span><strong>{sheet.name} · {sheet.format}</strong></div>
            <div className="property-row"><span>Единицы</span><strong>мм</strong></div>
          </section>
        </div>
        <div className="parameter-actions">
          <button type="button" onClick={workspace.cancelCommand}>Отмена</button>
        </div>
      </div>
    );
  }

  if (workspace.selectedLine) {
    const length = Math.hypot(
      workspace.lineEdit.to[0] - workspace.lineEdit.from[0],
      workspace.lineEdit.to[1] - workspace.lineEdit.from[1],
    );
    return (
      <div className="parameter-panel drawing-parameter-panel">
        <div className="panel-title-row">
          <div><small>Черчение</small><strong>Отрезок</strong></div>
          <button type="button" onClick={workspace.cancelCommand} title="Закрыть">×</button>
        </div>
        <div className="drawing-parameter-body">
          <section className="parameter-section drawing-line-coordinates">
            <h3>Координаты, мм</h3>
            <ParameterNumericField label="X1" value={workspace.lineEdit.from[0]} onChange={(value) => workspace.updateEditPoint('from', 0, value)} suffix="мм" />
            <ParameterNumericField label="Y1" value={workspace.lineEdit.from[1]} onChange={(value) => workspace.updateEditPoint('from', 1, value)} suffix="мм" />
            <ParameterNumericField label="X2" value={workspace.lineEdit.to[0]} onChange={(value) => workspace.updateEditPoint('to', 0, value)} suffix="мм" />
            <ParameterNumericField label="Y2" value={workspace.lineEdit.to[1]} onChange={(value) => workspace.updateEditPoint('to', 1, value)} suffix="мм" />
            <ParameterNumericField label="Длина" value={Number(length.toFixed(3))} onChange={workspace.setLineLength} suffix="мм" min={0.001} />
            <div className="property-row"><span>Фактическая длина</span><strong data-testid="drawing-line-length">{Number(length.toFixed(3))} мм</strong></div>
            <div className="property-row"><span>ID</span><strong className="drawing-entity-id">{workspace.selectedLine.id}</strong></div>
          </section>
        </div>
        <div className="parameter-actions">
          <button className="primary" type="button" onClick={() => { void workspace.commitEdit(); }} disabled={workspace.committing}>Применить</button>
          <button type="button" onClick={workspace.cancelCommand}>Отмена</button>
        </div>
      </div>
    );
  }

  return (
    <div className="parameter-panel drawing-parameter-panel">
      <div className="panel-title-row"><strong>Параметры листа</strong></div>
      <div className="drawing-parameter-body">
        <section className="parameter-section">
          <div className="property-row"><span>Формат</span><strong>{sheet.format}</strong></div>
          <div className="property-row"><span>Ориентация</span><strong>{sheet.orientation === 'landscape' ? 'Альбомная' : 'Книжная'}</strong></div>
          <div className="property-row"><span>Размер</span><strong>{sheet.width} × {sheet.height} мм</strong></div>
          <div className="property-row"><span>Масштаб вида</span><strong>1:{sheet.scale}</strong></div>
          <div className="property-row"><span>Слой</span><strong>{sheet.layers.find((layer) => layer.id === sheet.activeLayerId)?.name ?? '—'}</strong></div>
        </section>
      </div>
    </div>
  );
}
