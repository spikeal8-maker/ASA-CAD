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
  if (props.workspace === 'surfaces') return <SurfaceCommandGroups getAction={props.getAction} />;
  if (props.workspace === 'diagnostics') return <DiagnosticsCommandGroups getAction={props.getAction} />;
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

type CommandSpec = readonly [id: string, icon: CadIconName];

function RegistryCommandGroup(props: {
  label: string;
  commands: readonly CommandSpec[];
  getAction(id: string): CadUiAction;
  className?: string;
}) {
  return (
    <CommandGroup label={props.label} className={props.className}>
      {props.commands.map(([id, icon]) => (
        <ActionButton key={id} action={props.getAction(id)} icon={icon} text />
      ))}
    </CommandGroup>
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
      <RegistryCommandGroup
        label="Геометрия"
        getAction={props.getAction}
        commands={[
          ['sketch.line', 'line'],
          ['sketch.polyline', 'line'],
          ['sketch.rectangle', 'rectangle'],
          ['sketch.circle', 'circle'],
          ['sketch.arc', 'arc'],
          ['sketch.polygon', 'rectangle'],
          ['sketch.ellipse', 'circle'],
          ['sketch.spline', 'line'],
          ['sketch.point', 'point'],
          ['sketch.construction', 'construction'],
        ]}
      />
      <RegistryCommandGroup
        label="Редактирование"
        getAction={props.getAction}
        commands={[
          ['sketch.entity.delete', 'close'],
          ['sketch.trim', 'feature'],
          ['sketch.extend', 'feature'],
          ['sketch.split', 'feature'],
          ['sketch.offset', 'feature'],
          ['sketch.fillet', 'fillet'],
          ['sketch.chamfer', 'feature'],
          ['sketch.mirror', 'symmetric'],
          ['sketch.move', 'feature'],
          ['sketch.rotate', 'feature'],
          ['sketch.scale', 'feature'],
        ]}
      />
      <RegistryCommandGroup
        label="Ограничения"
        getAction={props.getAction}
        commands={[
          ['constraint.horizontal', 'horizontal'],
          ['constraint.vertical', 'vertical'],
          ['constraint.fixed', 'fixed'],
          ['constraint.coincident', 'coincident'],
          ['constraint.parallel', 'parallel'],
          ['constraint.perpendicular', 'perpendicular'],
          ['constraint.tangent', 'tangent'],
          ['constraint.concentric', 'concentric'],
          ['constraint.equal', 'equal'],
          ['constraint.symmetric', 'symmetric'],
          ['constraint.pointOnCurve', 'point'],
        ]}
      />
      <RegistryCommandGroup
        label="Размеры"
        getAction={props.getAction}
        commands={[
          ['dimension.auto', 'dimension'],
          ['dimension.linear', 'dimension'],
          ['dimension.horizontal', 'horizontal'],
          ['dimension.vertical', 'vertical'],
          ['dimension.diameter', 'diameter'],
          ['dimension.radius', 'radius'],
          ['dimension.angular', 'angle'],
        ]}
      />
      <RegistryCommandGroup
        label="Проекция"
        getAction={props.getAction}
        commands={[
          ['sketch.project', 'view'],
        ]}
      />
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
        <ActionButton action={props.getAction('part.revolve')} icon="feature" text />
        <ActionButton action={props.getAction('part.cutRevolve')} icon="cut" text />
        <ActionButton action={props.getAction('part.hole.simple')} icon="feature" text />
        <ActionButton action={props.getAction('part.chamfer')} icon="feature" text />
        <ActionButton action={props.getAction('part.shell')} icon="feature" text />
        <ActionButton action={props.getAction('part.rib')} icon="feature" text />
        <ActionButton action={props.getAction('part.draft')} icon="feature" text />
        <ActionButton action={props.getAction('part.sweep')} icon="feature" text />
        <ActionButton action={props.getAction('part.loft')} icon="feature" text />
      </CommandGroup>
      <RegistryCommandGroup
        label="Массив, копирование"
        getAction={props.getAction}
        commands={[
          ['part.pattern.grid', 'feature'],
          ['part.pattern.circular', 'feature'],
          ['part.pattern.mirror', 'symmetric'],
          ['part.pattern.path', 'feature'],
          ['part.collection', 'feature'],
        ]}
      />
      <RegistryCommandGroup
        label="Вспомогательные объекты"
        getAction={props.getAction}
        commands={[
          ['part.datum.plane', 'plane'],
          ['part.datum.axis', 'origin'],
          ['part.datum.point', 'point'],
          ['part.controlPoint', 'point'],
          ['part.connectionPoint', 'point'],
        ]}
      />
      <RegistryCommandGroup
        label="Диагностика"
        getAction={props.getAction}
        commands={[
          ['part.measureDistanceAngle', 'info'],
          ['part.measureEdge', 'info'],
          ['part.measureArea', 'info'],
          ['part.checkGeometry', 'info'],
        ]}
      />
      <RegistryCommandGroup
        label="Чертеж"
        getAction={props.getAction}
        commands={[
          ['part.linkedDrawings', 'drawing'],
        ]}
      />
      <CommandGroup label="Вид" className="part-view-group">
        <ViewButtons viewName={props.viewName} getAction={props.getAction} />
      </CommandGroup>
    </div>
  );
}

function SurfaceCommandGroups(props: { getAction(id: string): CadUiAction }) {
  return (
    <>
      <CommandGroup label="Эскиз">
        <ActionButton action={props.getAction('part.sketch.create')} icon="sketch" large accent />
      </CommandGroup>
      <RegistryCommandGroup
        label="Массив, копирование"
        getAction={props.getAction}
        commands={[
          ['part.pattern.grid', 'feature'],
          ['part.pattern.circular', 'feature'],
          ['part.pattern.mirror', 'symmetric'],
          ['part.pattern.path', 'feature'],
          ['part.collection', 'feature'],
        ]}
      />
      <RegistryCommandGroup
        label="Вспомогательные объекты"
        getAction={props.getAction}
        commands={[
          ['part.datum.plane', 'plane'],
          ['part.datum.axis', 'origin'],
          ['part.datum.point', 'point'],
          ['part.controlPoint', 'point'],
          ['part.connectionPoint', 'point'],
        ]}
      />
      <DiagnosticsCommandGroups getAction={props.getAction} />
      <div className="planned-workspace-note surfaces-reference-gap" role="note">
        <strong>Каркас и поверхности</strong>
        <span>Команды каркаса и поверхностей ещё не зарегистрированы; shell показывает только существующие registry-backed действия.</span>
      </div>
    </>
  );
}

function DiagnosticsCommandGroups(props: { getAction(id: string): CadUiAction }) {
  return (
    <>
      <RegistryCommandGroup
        label="Измерения"
        getAction={props.getAction}
        commands={[
          ['part.measureDistanceAngle', 'info'],
          ['part.measureEdge', 'info'],
          ['part.measureArea', 'info'],
        ]}
      />
      <RegistryCommandGroup
        label="Диагностика"
        getAction={props.getAction}
        commands={[
          ['part.checkGeometry', 'info'],
        ]}
      />
    </>
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
