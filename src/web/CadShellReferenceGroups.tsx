import React from 'react';
import { isCadUiActionVisible, type CadUiAction } from './CadUiAction';
import { CadUiActionButton } from './CadUiActionControls';
import { CadIcon, type CadIconName } from './CadIcon';

type CommandSpec = readonly [id: string, icon: CadIconName];
type ReferenceProps = { getAction(id: string): CadUiAction; showRoadmapCommands: boolean };

function ReferenceAction(props: ReferenceProps & { id: string; icon: CadIconName }) {
  return (
    <CadUiActionButton
      action={props.getAction(props.id)}
      symbol={<CadIcon name={props.icon} size={16} />}
      showRoadmapCommands={props.showRoadmapCommands}
      text
    />
  );
}

function visibleCommands(props: ReferenceProps, commands: readonly CommandSpec[]): readonly CommandSpec[] {
  return commands.filter(([id]) => isCadUiActionVisible(props.getAction(id), props.showRoadmapCommands));
}

function ReferenceActionList(props: ReferenceProps & { commands: readonly CommandSpec[] }) {
  return (
    <>
      {visibleCommands(props, props.commands).map(([id, icon]) => (
        <ReferenceAction key={id} id={id} icon={icon} {...props} />
      ))}
    </>
  );
}

function ReferenceCommandGroup(props: React.PropsWithChildren<{ label: string }>) {
  return (
    <section className="command-group">
      <div className="command-group-content">{props.children}</div>
      <div className="command-group-label">{props.label}</div>
    </section>
  );
}

function ReferenceListGroup(props: ReferenceProps & { label: string; commands: readonly CommandSpec[] }) {
  const commands = visibleCommands(props, props.commands);
  if (commands.length === 0) return null;
  return <ReferenceCommandGroup label={props.label}><ReferenceActionList {...props} commands={commands} /></ReferenceCommandGroup>;
}

function ReferenceSingleGroup(props: ReferenceProps & { label: string; id: string; icon: CadIconName }) {
  if (!isCadUiActionVisible(props.getAction(props.id), props.showRoadmapCommands)) return null;
  return <ReferenceCommandGroup label={props.label}><ReferenceAction {...props} id={props.id} icon={props.icon} /></ReferenceCommandGroup>;
}

const SOLID_PLANNED: readonly CommandSpec[] = [
  ['part.revolve', 'feature'], ['part.cutRevolve', 'cut'], ['part.hole.simple', 'feature'],
  ['part.chamfer', 'feature'], ['part.shell', 'feature'], ['part.rib', 'feature'],
  ['part.draft', 'feature'], ['part.sweep', 'feature'], ['part.loft', 'feature'],
];
const PATTERNS: readonly CommandSpec[] = [
  ['part.pattern.grid', 'feature'], ['part.pattern.circular', 'feature'],
  ['part.pattern.mirror', 'symmetric'], ['part.pattern.path', 'feature'], ['part.collection', 'feature'],
];
const DATUM: readonly CommandSpec[] = [
  ['part.datum.plane', 'plane'], ['part.datum.axis', 'origin'], ['part.datum.point', 'point'],
  ['part.controlPoint', 'point'], ['part.connectionPoint', 'point'],
];
const MEASURE: readonly CommandSpec[] = [
  ['part.measureDistanceAngle', 'info'], ['part.measureEdge', 'info'], ['part.measureArea', 'info'],
];
const CHECK: readonly CommandSpec[] = [['part.checkGeometry', 'info']];
const SKETCH_GEOMETRY_PLANNED: readonly CommandSpec[] = [
  ['sketch.polyline', 'line'], ['sketch.polygon', 'rectangle'], ['sketch.ellipse', 'circle'],
  ['sketch.spline', 'line'], ['sketch.point', 'point'],
];
const SKETCH_EDIT_PLANNED: readonly CommandSpec[] = [
  ['sketch.trim', 'feature'], ['sketch.extend', 'feature'], ['sketch.split', 'feature'],
  ['sketch.offset', 'feature'], ['sketch.fillet', 'fillet'], ['sketch.chamfer', 'feature'],
  ['sketch.mirror', 'symmetric'], ['sketch.move', 'feature'], ['sketch.rotate', 'feature'], ['sketch.scale', 'feature'],
];

export function PartSolidPlannedActions(props: ReferenceProps) {
  return <ReferenceActionList {...props} commands={SOLID_PLANNED} />;
}
export function SketchGeometryPlannedActions(props: ReferenceProps) {
  return <ReferenceActionList {...props} commands={SKETCH_GEOMETRY_PLANNED} />;
}
export function SketchEditPlannedActions(props: ReferenceProps) {
  return <ReferenceActionList {...props} commands={SKETCH_EDIT_PLANNED} />;
}
export function SketchAutoDimensionAction(props: ReferenceProps) {
  return <ReferenceAction {...props} id="dimension.auto" icon="dimension" />;
}
export function SketchProjectionGroup(props: ReferenceProps) {
  return <ReferenceSingleGroup {...props} label="Проекция" id="sketch.project" icon="view" />;
}

export function DiagnosticsReferenceGroups(props: ReferenceProps) {
  return (
    <>
      <ReferenceListGroup {...props} label="Измерения" commands={MEASURE} />
      <ReferenceListGroup {...props} label="Диагностика" commands={CHECK} />
    </>
  );
}

export function PartReferenceSupplementGroups(props: ReferenceProps) {
  return (
    <>
      <ReferenceListGroup {...props} label="Массив, копирование" commands={PATTERNS} />
      <ReferenceListGroup {...props} label="Вспомогательные объекты" commands={DATUM} />
      <DiagnosticsReferenceGroups {...props} />
      <ReferenceSingleGroup {...props} label="Чертеж" id="part.linkedDrawings" icon="drawing" />
    </>
  );
}

export function SurfaceReferenceGroups(props: ReferenceProps) {
  return (
    <>
      <ReferenceSingleGroup {...props} label="Эскиз" id="part.sketch.create" icon="sketch" />
      <ReferenceListGroup {...props} label="Массив, копирование" commands={PATTERNS} />
      <ReferenceListGroup {...props} label="Вспомогательные объекты" commands={DATUM} />
      <DiagnosticsReferenceGroups {...props} />
      <div className="planned-workspace-note surfaces-reference-gap" role="note">
        <strong>Каркас и поверхности</strong>
        <span>Команды каркаса и поверхностей ещё не зарегистрированы; это остаётся честным parity gap.</span>
      </div>
    </>
  );
}
