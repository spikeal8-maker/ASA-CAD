import React from 'react';
import type { CadUiAction } from './CadUiAction';
import { CadUiActionButton } from './CadUiActionControls';

export function CadShellCommandGroups(props: {
  workspace: string;
  getAction(id: string): CadUiAction;
  rectangleReady: boolean;
  rectangleWidth: number;
  rectangleHeight: number;
  circleReady: boolean;
  circleDiameter: number;
  viewName: string;
}) {
  if (props.workspace === 'sketch') return <SketchCommandGroups {...props} />;
  if (props.workspace === 'view') return <ViewCommandGroups viewName={props.viewName} getAction={props.getAction} />;
  return <PartCommandGroups getAction={props.getAction} />;
}

function SketchCommandGroups(props: {
  getAction(id: string): CadUiAction;
  rectangleReady: boolean;
  rectangleWidth: number;
  rectangleHeight: number;
  circleReady: boolean;
  circleDiameter: number;
}) {
  return (
    <>
      <CommandGroup label="Геометрия">
        <CadUiActionButton action={props.getAction('sketch.line')} symbol="╱" large accent />
        <CadUiActionButton action={props.getAction('sketch.rectangle')} symbol={commandSymbol('sketch.rectangle')} />
        <CadUiActionButton action={props.getAction('sketch.circle')} symbol={commandSymbol('sketch.circle')} />
        <CadUiActionButton action={props.getAction('sketch.arc')} symbol="⌒" />
      </CommandGroup>
      <CommandGroup label="Ограничения">
        <CadUiActionButton action={props.getAction('constraint.horizontal')} symbol="—" text />
        <CadUiActionButton action={props.getAction('constraint.vertical')} symbol="|" text />
        <CadUiActionButton action={props.getAction('constraint.fixed')} symbol="⌾" text />
        <CadUiActionButton action={props.getAction('constraint.coincident')} symbol="●" text />
        <CadUiActionButton action={props.getAction('constraint.parallel')} symbol="∥" text />
        <CadUiActionButton action={props.getAction('constraint.perpendicular')} symbol="⊥" text />
        <CadUiActionButton action={props.getAction('constraint.tangent')} symbol="∿" text />
      </CommandGroup>
      <CommandGroup label="Размеры">
        <RibbonTextButton
          label={props.rectangleReady ? `${props.rectangleWidth} × ${props.rectangleHeight} мм` : props.circleReady ? `Ø${props.circleDiameter} мм` : 'Размеры'}
          symbol="↔"
          disabled
        />
      </CommandGroup>
      <CommandGroup label="Эскиз" compact>
        <CadUiActionButton action={props.getAction('sketch.finish')} symbol="✓" text />
      </CommandGroup>
    </>
  );
}

function PartCommandGroups(props: { getAction(id: string): CadUiAction }) {
  return (
    <>
      <CommandGroup label="Эскиз">
        <CadUiActionButton action={props.getAction('part.sketch.create')} symbol={commandSymbol('part.sketch.create')} large accent />
      </CommandGroup>
      <CommandGroup label="Элементы тела">
        <CadUiActionButton action={props.getAction('part.extrude')} symbol={commandSymbol('part.extrude')} />
        <CadUiActionButton action={props.getAction('part.cutExtrude')} symbol={commandSymbol('part.cutExtrude')} />
        <CadUiActionButton action={props.getAction('part.fillet')} symbol={commandSymbol('part.fillet')} />
      </CommandGroup>
      <CommandGroup label="Сервис модели" compact>
        <CadUiActionButton action={props.getAction('system.rebuild')} symbol="↻" text titleSuffix="(F5)" />
        <RibbonTextButton label="Свойства" symbol="ⓘ" disabled />
      </CommandGroup>
    </>
  );
}

function ViewCommandGroups(props: { viewName: string; getAction(id: string): CadUiAction }) {
  const views = [
    { label: 'Спереди', id: 'view.front', shortcut: '1' },
    { label: 'Сзади', id: 'view.back' },
    { label: 'Сверху', id: 'view.top', shortcut: '2' },
    { label: 'Снизу', id: 'view.bottom' },
    { label: 'Слева', id: 'view.left', shortcut: '3' },
    { label: 'Справа', id: 'view.right' },
    { label: 'Изометрия', id: 'view.iso', shortcut: '0' },
  ];
  return (
    <CommandGroup label="Ориентация">
      {views.map((view) => (
        <CadUiActionButton
          key={view.id}
          action={props.getAction(view.id)}
          symbol="◇"
          className="view-command"
          selected={props.viewName === view.label}
          titleSuffix={view.shortcut ? `(${view.shortcut})` : undefined}
        />
      ))}
    </CommandGroup>
  );
}

function CommandGroup(props: React.PropsWithChildren<{ label: string; compact?: boolean }>) {
  return (
    <section className={`command-group ${props.compact ? 'compact' : ''}`}>
      <div className="command-group-content">{props.children}</div>
      <div className="command-group-label">{props.label}</div>
    </section>
  );
}

function RibbonTextButton(props: { label: string; symbol: string; disabled?: boolean }) {
  return (
    <button className="ribbon-command text-command" type="button" disabled={props.disabled}>
      <span className="ribbon-command-icon">{props.symbol}</span>
      <span>{props.label}</span>
    </button>
  );
}

function commandSymbol(id: string): string {
  if (id.includes('sketch')) return '▱';
  if (id.includes('circle')) return '○';
  if (id.includes('cut')) return '▣';
  if (id.includes('extrude')) return '▤';
  if (id.includes('fillet')) return '◜';
  return '◇';
}
