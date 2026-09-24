import React from 'react';
import type { CadSketchId } from '../contracts/ids';

export interface CutExtrudeParameterPanelProps {
  profileId: CadSketchId | null;
  profileName: string | null;
  onApply(): void | Promise<void>;
  onCancel(): void;
}

/**
 * Presentation-only Cut-Extrude parameters for the currently supported
 * through-all Part workflow. Command execution remains owned by the existing
 * Part feature controller.
 */
export function CutExtrudeParameterPanel(props: CutExtrudeParameterPanelProps) {
  return (
    <div
      className="parameter-panel cut-extrude-parameter-panel"
      data-cut-profile-id={props.profileId ?? ''}
    >
      <div className="panel-title-row">
        <div>
          <small>Элемент тела</small>
          <strong>Вырезать выдавливанием</strong>
        </div>
        <button type="button" onClick={props.onCancel} title="Закрыть">×</button>
      </div>

      <section className="parameter-section extrude-main-section">
        <h3>Основные параметры</h3>
        <div className="extrude-summary">
          <div className="property-row">
            <span>Сечение</span>
            <strong>{props.profileName ?? 'Не выбрано'}</strong>
          </div>
          <div className="property-row">
            <span>Направляющий объект</span>
            <strong>Нормаль к плоскости эскиза</strong>
          </div>
          <div className="property-row">
            <span>Способ</span>
            <strong className="extrude-method">Сквозь всё</strong>
          </div>
        </div>
      </section>

      <div className="parameter-actions">
        <button
          className="primary"
          type="button"
          onClick={() => { void props.onApply(); }}
        >
          Создать объект
        </button>
        <button type="button" onClick={props.onCancel}>Отмена</button>
      </div>
    </div>
  );
}
