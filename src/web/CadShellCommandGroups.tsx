import React from 'react';
import type { CadUiAction } from './CadUiAction';
import { CadUiActionButton } from './CadUiActionControls';
import { CadIcon, type CadIconName } from './CadIcon';

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
  return <PartCommandGroups getAction={props.getAction} viewName={props.viewName} />;
}

function ActionButton(props: {
  action: CadUiAction;
  icon: CadIconName;
  large?: boolean;
  accent?: boolean;
  text?: boolean;
  selected?: boolean;
  className?: string;
  titleSuffix?: string;
}) {
  return (
    <CadUiActionButton
      action={props.action}
      symbol={<CadIcon name={props.icon} size={16} />}
      large={props.large}
      accent={props.accent}
      text={props.text}
      selected={props.selected}
      className={props.className}
      titleSuffix={props.titleSuffix}
    />
  );
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
        <ActionButton action={props.getAction('sketch.line')} icon="line" large accent />
        <ActionButton action={props.getAction('sketch.rectangle')} icon="rectangle" />
        <ActionButton action={props.getAction('sketch.circle')} icon="circle" />
        <ActionButton action={props.getAction('sketch.arc')} icon="arc" />
      </CommandGroup>
      <CommandGroup label="Ограничения">
        <ActionButton action={props.getAction('sketch.construction')} icon="construction" text />
        <ActionButton action={props.getAction('constraint.horizontal')} icon="horizontal" text />
        <ActionButton action={props.getAction('constraint.vertical')} icon="vertical" text />
        <ActionButton action={props.getAction('constraint.fixed')} icon="fixed" text />
        <ActionButton action={props.getAction('constraint.coincident')} icon="coincident" text />
        <ActionButton action={props.getAction('constraint.parallel')} icon="parallel" text />
        <ActionButton action={props.getAction('constraint.perpendicular')} icon="perpendicular" text />
        <ActionButton action={props.getAction('constraint.tangent')} icon="tangent" text />
        <ActionButton action={props.getAction('constraint.concentric')} icon="concentric" text />
        <ActionButton action={props.getAction('constraint.equal')} icon="equal" text />
        <ActionButton action={props.getAction('constraint.symmetric')} icon="symmetric" text />
        <ActionButton action={props.getAction('constraint.pointOnCurve')} icon="point" text />
      </CommandGroup>
      <CommandGroup label="Размеры">
        <ActionButton action={props.getAction('dimension.linear')} icon="dimension" text />
        <ActionButton action={props.getAction('dimension.horizontal')} icon="horizontal" text />
        <ActionButton action={props.getAction('dimension.vertical')} icon="vertical" text />
        <ActionButton action={props.getAction('dimension.diameter')} icon="diameter" text />
        <ActionButton action={props.getAction('dimension.radius')} icon="radius" text />
        <ActionButton action={props.getAction('dimension.angular')} icon="angle" text />
      </CommandGroup>
      <CommandGroup label="Эскиз" compact>
        <ActionButton action={props.getAction('sketch.finish')} icon="accept" text />
      </CommandGroup>
    </>
  );
}

function PartCommandGroups(props: { getAction(id: string): CadUiAction; viewName: string }) {
  return (
    <div className="part-command-groups">
      <CommandGroup label="Система" className="part-system-group">
        <ActionButton action={props.getAction('system.rebuild')} icon="rebuild" className="part-system-command" titleSuffix="(F5)" />
      </CommandGroup>
      <CommandGroup label="Эскиз" className="part-sketch-group">
        <ActionButton action={props.getAction('part.sketch.create')} icon="sketch" large accent />
      </CommandGroup>
      <CommandGroup label="Элементы тела" className="part-solid-group">
        <ActionButton action={props.getAction('part.extrude')} icon="extrude" />
        <ActionButton action={props.getAction('part.cutExtrude')} icon="cut" />
        <ActionButton action={props.getAction('part.fillet')} icon="fillet" />
      </CommandGroup>
      <CommandGroup label="Вид" className="part-view-group">
        <ViewButtons viewName={props.viewName} getAction={props.getAction} />
      </CommandGroup>
    </div>
  );
}

function ViewCommandGroups(props: { viewName: string; getAction(id: string): CadUiAction }) {
  return (
    <CommandGroup label="Ориентация">
      <ViewButtons viewName={props.viewName} getAction={props.getAction} />
    </CommandGroup>
  );
}

function ViewButtons(props: { viewName: string; getAction(id: string): CadUiAction }) {
  const views = [
    { label: 'Показать всё', id: 'view.fit', shortcut: 'F', icon: 'fit' as const },
    { label: 'Спереди', id: 'view.front', shortcut: '1', icon: 'view' as const },
    { label: 'Сзади', id: 'view.back', icon: 'view' as const },
    { label: 'Сверху', id: 'view.top', shortcut: '2', icon: 'view' as const },
    { label: 'Снизу', id: 'view.bottom', icon: 'view' as const },
    { label: 'Слева', id: 'view.left', shortcut: '3', icon: 'view' as const },
    { label: 'Справа', id: 'view.right', icon: 'view' as const },
    { label: 'Изометрия', id: 'view.iso', shortcut: '0', icon: 'view' as const },
  ];
  return (
    <>
      {views.map((view) => (
        <ActionButton
          key={view.id}
          action={props.getAction(view.id)}
          icon={view.icon}
          className="view-command"
          selected={view.id !== 'view.fit' && props.viewName === view.label}
          titleSuffix={view.shortcut ? `(${view.shortcut})` : undefined}
        />
      ))}
    </>
  );
}

function CommandGroup(props: React.PropsWithChildren<{ label: string; compact?: boolean; className?: string }>) {
  return (
    <section className={`command-group ${props.compact ? 'compact' : ''} ${props.className ?? ''}`.trim()}>
      <div className="command-group-content">{props.children}</div>
      <div className="command-group-label">{props.label}</div>
    </section>
  );
}
