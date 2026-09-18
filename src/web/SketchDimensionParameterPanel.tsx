import React from 'react';
import { ParameterNumericField } from './ParameterNumericField';
import type { SketchDirectionalDimensionMode } from './useSketchDirectionalDimensionController';

export interface SketchDimensionParameterPanelProps {
  activeCommand: string;
  directionalMode: SketchDirectionalDimensionMode | null;
  directionalEntityId: string | null;
  directionalValue: number;
  setDirectionalValue(value: number): void;
  canCommitDirectional: boolean;
  dimensionEditValue: number;
  setDimensionEditValue(value: number): void;
  onDirectionalCommit(): void | Promise<void>;
  onDirectionalCancel(): void;
  onDimensionEdit(): void | Promise<void>;
  onCancel(): void;
}

export function SketchDimensionParameterPanel(props: SketchDimensionParameterPanelProps) {
  if (props.activeCommand === 'dimension.edit') {
    return (
      <DimensionPanelFrame
        eyebrow="Управляющий размер"
        title="Изменить размер"
        value={props.dimensionEditValue}
        setValue={props.setDimensionEditValue}
        onApply={props.onDimensionEdit}
        onCancel={props.onCancel}
        applyLabel="Применить"
      >
        <p>После применения вся история детали перестраивается от изменённого эскиза вниз.</p>
      </DimensionPanelFrame>
    );
  }

  const mode = props.directionalMode;
  if (!mode || props.activeCommand !== `dimension.${mode}`) return null;
  const title = mode === 'horizontal' ? 'Горизонтальный размер' : 'Вертикальный размер';
  return (
    <DimensionPanelFrame
      eyebrow="Управляющий размер"
      title={title}
      value={props.directionalValue}
      setValue={props.setDirectionalValue}
      onApply={props.onDirectionalCommit}
      onCancel={props.onDirectionalCancel}
      applyLabel="Создать"
      applyDisabled={!props.canCommitDirectional}
    >
      <div className="selection-value selected" data-directional-dimension-target={props.directionalEntityId ?? ''}>
        <span>✓</span>
        <strong>Выбранный отрезок</strong>
        <small>{props.directionalEntityId ?? '—'}</small>
      </div>
    </DimensionPanelFrame>
  );
}

function DimensionPanelFrame(props: React.PropsWithChildren<{
  eyebrow: string;
  title: string;
  value: number;
  setValue(value: number): void;
  onApply(): void | Promise<void>;
  onCancel(): void;
  applyLabel: string;
  applyDisabled?: boolean;
}>) {
  return (
    <div className="parameter-panel">
      <div className="panel-title-row">
        <div><small>{props.eyebrow}</small><strong>{props.title}</strong></div>
        <button type="button" onClick={props.onCancel} title="Закрыть">×</button>
      </div>
      <section className="parameter-section">
        <h3>Значение</h3>
        {props.children}
        <ParameterNumericField
          label="Размер"
          value={props.value}
          onChange={props.setValue}
          suffix="мм"
          min={0}
        />
      </section>
      <div className="parameter-actions">
        <button
          className="primary"
          type="button"
          disabled={props.applyDisabled}
          onClick={() => { void props.onApply(); }}
        >
          {props.applyLabel}
        </button>
        <button type="button" onClick={props.onCancel}>Отмена</button>
      </div>
    </div>
  );
}
