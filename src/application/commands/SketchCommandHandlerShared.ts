import type {
  CadCommand,
  CadCommandAvailability,
  CadCommandId,
  CadCommandResult,
} from '../../contracts/commands';
import type {
  CadPartDocument,
  CadSketch,
  CadSketchEntity,
} from '../../contracts/document';
import type {
  CadSketchEntityId,
  CadSketchId,
} from '../../contracts/ids';

export type SketchCommandFor<K extends CadCommandId> = Extract<CadCommand, { id: K }>;

export interface SketchCommandHandler<K extends CadCommandId> {
  availability(part: CadPartDocument): CadCommandAvailability;
  execute(part: CadPartDocument, command: SketchCommandFor<K>): CadCommandResult;
}

export type SketchCommandHandlerMap<K extends CadCommandId> = {
  [P in K]: SketchCommandHandler<P>;
};

export function defineSketchCommandHandler<K extends CadCommandId>(
  definition: SketchCommandHandler<K>,
): SketchCommandHandler<K> {
  return definition;
}

export const ENABLED: CadCommandAvailability = { enabled: true };
export const CREATE_SKETCH_FIRST: CadCommandAvailability = {
  enabled: false,
  reason: 'Create a sketch first',
};
export const NO_DRIVING_DIMENSIONS: CadCommandAvailability = {
  enabled: false,
  reason: 'No driving dimensions exist',
};

export function requireSketchAvailability(part: CadPartDocument): CadCommandAvailability {
  return part.sketches.length > 0 ? ENABLED : CREATE_SKETCH_FIRST;
}

export function requireSketch(part: CadPartDocument, id: CadSketchId): CadSketch {
  const sketch = part.sketches.find((item) => item.id === id);
  if (!sketch) throw new Error(`Unknown sketch: ${id}`);
  return sketch;
}

export function requireSketchEntity(sketch: CadSketch, id: CadSketchEntityId): CadSketchEntity {
  const entity = sketch.entities.find((item) => item.id === id);
  if (!entity) throw new Error(`Unknown sketch entity: ${id}`);
  return entity;
}
