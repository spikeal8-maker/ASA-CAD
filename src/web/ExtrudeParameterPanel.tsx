import React from 'react';
import { ParameterNumericField } from './ParameterNumericField';
import type { ExtrudeOperationController } from './useExtrudeOperationController';

export function ExtrudeParameterPanel(props: {
  extrude: ExtrudeOperationController;
  onCancel(): void;
}) {
  const { extrude } = props;
  const direction = extrude.symmetric ? 'Симметрично' : extrude.reverse ? 'Обратное' : 'Прямое';

  return (
    <div
      className="parameter-panel extrude-parameter-panel"
      data-extrude-profile-id={extrude.profileId ?? ''}
      data-extrude-profile-support={extrude.profileSupport ?? ''}
    >
      <div className="panel-title-row">
        <div>
          <small>Элемент тела</small>
          <strong>Элемент выдавливания</strong>
        </div>
        <button type="button" onClick={props.onCancel} title="Закрыть">×</button>
      </div>

      <section className="parameter-section extrude-main-section">
        <h3>Основные параметры</h3>
        <div className="extrude-summary">
          <div className="property-row"><span>Сечение</span><strong>{extrude.profileName ?? 'Не выбрано'}</strong></div>
          <div className="property-row"><span>Направляющий объект</span><strong>Нормаль к плоскости эскиза</strong></div>
          <div className="property-row"><span>Способ</span><strong className="extrude-method">На расстояние</strong></div>
        </div>

        <ParameterNumericField
          label="Расстояние"
          value={extrude.distance}
          onChange={extrude.setDistance}
          suffix="мм"
          min={0}
        />
        {extrude.validationError && (
          <p className="parameter-inline-error" role="alert">{extrude.validationError}</p>
        )}

        <div className="extrude-direction-control">
          <div className="property-row"><span>Направление</span><strong>{direction}</strong></div>
          <button type="button" disabled={extrude.symmetric} onClick={extrude.toggleReverse}>
            ↔ Сменить направление
          </button>
        </div>

        <div className="extrude-symmetric-control">
          <span>
            <strong>Симметрично</strong>
            <small>Расстояние задаёт суммарную глубину</small>
          </span>
          <button
            type="button"
            role="switch"
            aria-label="Симметрично"
            aria-checked={extrude.symmetric}
            onClick={() => extrude.setSymmetric(!extrude.symmetric)}
          >
            {extrude.symmetric ? 'Вкл' : 'Выкл'}
          </button>
        </div>

        <p className="extrude-engineering-note">
          Выдавливание строится перпендикулярно плоскости эскиза.
        </p>
      </section>

      <div className="parameter-actions">
        <button className="primary" type="button" disabled={Boolean(extrude.validationError)} onClick={() => { void extrude.commit(); }}>
          Создать объект
        </button>
        <button type="button" onClick={props.onCancel}>Отмена</button>
      </div>
    </div>
  );
}
