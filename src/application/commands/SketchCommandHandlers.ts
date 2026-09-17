import type {
  CadCommand,
  CadCommandAvailability,
  CadCommandId,
  CadCommandResult,
} from '../../contracts/commands';
import type { CadPartDocument } from '../../contracts/document';
import {
  SKETCH_GEOMETRY_COMMAND_IDS,
  sketchGeometryCommandHandlers,
} from './SketchGeometryCommandHandlers';
import {
  SKETCH_EDIT_COMMAND_IDS,
  sketchEditCommandHandlers,
} from './SketchEditCommandHandlers';
import {
  SKETCH_CONSTRAINT_COMMAND_IDS,
  sketchConstraintCommandHandlers,
} from './SketchConstraintCommandHandlers';
import {
  SKETCH_DIMENSION_COMMAND_IDS,
  sketchDimensionCommandHandlers,
} from './SketchDimensionCommandHandlers';

export const SKETCH_GROWTH_COMMAND_IDS = [
  ...SKETCH_GEOMETRY_COMMAND_IDS,
  ...SKETCH_EDIT_COMMAND_IDS,
  ...SKETCH_CONSTRAINT_COMMAND_IDS,
  ...SKETCH_DIMENSION_COMMAND_IDS,
] as const satisfies readonly CadCommandId[];

export type SketchGrowthCommandId = typeof SKETCH_GROWTH_COMMAND_IDS[number];
export type SketchGrowthCommand = Extract<CadCommand, { id: SketchGrowthCommandId }>;

const COMMAND_IDS = new Set<CadCommandId>(SKETCH_GROWTH_COMMAND_IDS);

export function isSketchGrowthCommandId(id: CadCommandId): id is SketchGrowthCommandId {
  return COMMAND_IDS.has(id);
}

export function isSketchGrowthCommand(command: CadCommand): command is SketchGrowthCommand {
  return isSketchGrowthCommandId(command.id);
}

export function getSketchGrowthCommandAvailability(
  part: CadPartDocument,
  id: SketchGrowthCommandId,
): CadCommandAvailability {
  switch (id) {
    case 'sketch.create':
    case 'sketch.line':
    case 'sketch.rectangle':
    case 'sketch.circle':
    case 'sketch.arc':
      return sketchGeometryCommandHandlers[id].availability(part);

    case 'sketch.entity.delete':
    case 'sketch.entity.translate':
    case 'sketch.finish':
      return sketchEditCommandHandlers[id].availability(part);

    case 'constraint.coincident':
    case 'constraint.horizontal':
    case 'constraint.vertical':
    case 'constraint.parallel':
    case 'constraint.perpendicular':
    case 'constraint.tangent':
    case 'constraint.concentric':
    case 'constraint.equal':
    case 'constraint.symmetric':
    case 'constraint.pointOnCurve':
    case 'constraint.fixed':
      return sketchConstraintCommandHandlers[id].availability(part);

    case 'dimension.linear':
    case 'dimension.diameter':
    case 'part.dimension.setValue':
      return sketchDimensionCommandHandlers[id].availability(part);
  }
}

export function applySketchGrowthCommand(
  part: CadPartDocument,
  command: SketchGrowthCommand,
): CadCommandResult {
  switch (command.id) {
    case 'sketch.create':
      return sketchGeometryCommandHandlers['sketch.create'].execute(part, command);
    case 'sketch.line':
      return sketchGeometryCommandHandlers['sketch.line'].execute(part, command);
    case 'sketch.rectangle':
      return sketchGeometryCommandHandlers['sketch.rectangle'].execute(part, command);
    case 'sketch.circle':
      return sketchGeometryCommandHandlers['sketch.circle'].execute(part, command);
    case 'sketch.arc':
      return sketchGeometryCommandHandlers['sketch.arc'].execute(part, command);

    case 'sketch.entity.delete':
      return sketchEditCommandHandlers['sketch.entity.delete'].execute(part, command);
    case 'sketch.entity.translate':
      return sketchEditCommandHandlers['sketch.entity.translate'].execute(part, command);
    case 'sketch.finish':
      return sketchEditCommandHandlers['sketch.finish'].execute(part, command);

    case 'constraint.coincident':
      return sketchConstraintCommandHandlers['constraint.coincident'].execute(part, command);
    case 'constraint.horizontal':
      return sketchConstraintCommandHandlers['constraint.horizontal'].execute(part, command);
    case 'constraint.vertical':
      return sketchConstraintCommandHandlers['constraint.vertical'].execute(part, command);
    case 'constraint.parallel':
      return sketchConstraintCommandHandlers['constraint.parallel'].execute(part, command);
    case 'constraint.perpendicular':
      return sketchConstraintCommandHandlers['constraint.perpendicular'].execute(part, command);
    case 'constraint.tangent':
      return sketchConstraintCommandHandlers['constraint.tangent'].execute(part, command);
    case 'constraint.concentric':
      return sketchConstraintCommandHandlers['constraint.concentric'].execute(part, command);
    case 'constraint.equal':
      return sketchConstraintCommandHandlers['constraint.equal'].execute(part, command);
    case 'constraint.symmetric':
      return sketchConstraintCommandHandlers['constraint.symmetric'].execute(part, command);
    case 'constraint.pointOnCurve':
      return sketchConstraintCommandHandlers['constraint.pointOnCurve'].execute(part, command);
    case 'constraint.fixed':
      return sketchConstraintCommandHandlers['constraint.fixed'].execute(part, command);

    case 'dimension.linear':
      return sketchDimensionCommandHandlers['dimension.linear'].execute(part, command);
    case 'dimension.diameter':
      return sketchDimensionCommandHandlers['dimension.diameter'].execute(part, command);
    case 'part.dimension.setValue':
      return sketchDimensionCommandHandlers['part.dimension.setValue'].execute(part, command);
  }

  const exhaustive: never = command;
  return exhaustive;
}
