import React from 'react';
import type { ParameterPanelProps } from '../ParameterPanel';
import { KompasParameterFrame as Frame } from './KompasParameterFrame';

/** Numeric KOMPAS field: comma or dot, Enter creates the object, invalid values stay visible. */
export function NumberField(props: { label: string; value: number; onChange(value: number): void; onEnter(): void; disabled?: boolean; unit?: string }) {
  const [text, setText] = React.useState(String(props.value));
  const parsed = Number(text.trim().replace(',', '.'));
  const valid = text.trim() !== '' && Number.isFinite(parsed) && parsed > 0;
  React.useEffect(() => {
    if (!Number.isNaN(props.value) && Number(text.trim().replace(',', '.')) !== props.value) setText(String(props.value));
  }, [props.value]);
  return (
    <input
      className={`k-pp-field${valid ? '' : ' k-invalid'}`}
      type="text"
      inputMode="decimal"
      autoComplete="off"
      value={text}
      disabled={props.disabled}
      aria-label={`${props.label}, ${props.unit ?? 'мм'}`}
      aria-invalid={!valid}
      onFocus={(event) => event.currentTarget.select()}
      onChange={(event) => {
        setText(event.target.value);
        /* Invalid values reach the product too: its validation owns the message and ✓. */
        const raw = event.target.value.trim();
        props.onChange(raw === '' ? Number.NaN : Number(raw.replace(',', '.')));
      }}
      onKeyDown={(event) => {
        if (event.key === 'Enter') { event.preventDefault(); event.stopPropagation(); if (valid) props.onEnter(); }
        else if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); event.currentTarget.blur(); }
      }}
    />
  );
}

export function SketchToolPanel(props: {
  p: ParameterPanelProps; title: string; icon: string; onCommit(): void; hint: string;
  rows: ReadonlyArray<readonly [string, number, (value: number) => void]>;
}) {
  return (
    <Frame title={props.title} icon={props.icon} canCommit onCommit={props.onCommit} onCancel={props.p.onCancel}
      message={`Задайте размеры и нажмите Enter или «Создать объект», либо укажите точки в окне`}>
      {props.rows.map(([label, value, set]) => (
        <div key={label} className="k-pp-row k-hl" data-param-row={label}>
          <label className="k-pp-label">{label}</label>
          <NumberField label={label} value={value} onChange={set} onEnter={props.onCommit} /><span />
        </div>
      ))}
      <p className="k-sk-hint">Значения вводятся в панели: «{props.hint}» — главный размер, Tab — следующее поле, Enter — создать объект.</p>
    </Frame>
  );
}
