import React from 'react';

export function ParameterNumericField(props: {
  label: string;
  value: number;
  suffix: string;
  onChange(value: number): void;
  min?: number;
  max?: number;
}) {
  return (
    <label className="numeric-field">
      <span>{props.label}</span>
      <span className="numeric-control">
        <input
          type="number"
          min={props.min ?? 0.01}
          max={props.max}
          step="1"
          value={Number.isFinite(props.value) ? props.value : 0}
          onChange={(event) => props.onChange(Number(event.target.value))}
        />
        <small>{props.suffix}</small>
      </span>
    </label>
  );
}
