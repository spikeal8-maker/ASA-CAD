import type {
  CadCommand,
  CadCommandAvailability,
  CadCommandId,
  CadCommandResult,
  CadSketchCommandReference,
} from '../contracts/commands';
import type {
  CadBody,
  CadConstraint,
  CadDimension,
  CadFeature,
  CadPartDocument,
  CadSketch,
  CadSketchEntity,
} from '../contracts/document';
import type {
  CadBodyId,
  CadConstraintId,
  CadDimensionId,
  CadFeatureId,
  CadSketchEntityId,
  CadSketchId,
} from '../contracts/ids';
import { createCadId } from '../contracts/ids';

export type PartDocumentCommand = Exclude<CadCommand, { id: 'document.rebuild' }>;

export function getPartCommandAvailability(
  part: Readonly<CadPartDocument>,
  id: CadCommandId,
): CadCommandAvailability {
  switch (id) {
    case 'document.rebuild':
    case 'sketch.create':
      return { enabled: true };
    case 'sketch.line':
    case 'sketch.rectangle':
    case 'sketch.circle':
    case 'sketch.finish':
    case 'constraint.coincident':
    case 'constraint.horizontal':
    case 'constraint.vertical':
    case 'constraint.fixed':
    case 'dimension.linear':
    case 'dimension.diameter':
      return part.sketches.length > 0
        ? { enabled: true }
        : { enabled: false, reason: 'Create a sketch first' };
    case 'feature.extrude':
    case 'feature.cutExtrude':
      return part.sketches.length > 0
        ? { enabled: true }
        : { enabled: false, reason: 'A sketch/profile is required' };
    case 'feature.fillet':
      return part.stableReferences.length > 0
        ? { enabled: true }
        : { enabled: false, reason: 'A stable edge/face reference is required' };
    case 'part.dimension.setValue':
      return part.dimensions.length > 0
        ? { enabled: true }
        : { enabled: false, reason: 'No driving dimensions exist' };
  }
}

export function applyPartDocumentCommand(
  part: CadPartDocument,
  command: PartDocumentCommand,
): CadCommandResult {
  switch (command.id) {
    case 'sketch.create': {
      const id = createCadId<CadSketchId>('sketch');
      const sketch: CadSketch = {
        id,
        name: command.payload.name ?? `Эскиз ${part.sketches.length + 1}`,
        support: String(command.payload.support),
        entities: [],
        constraintIds: [],
        dimensionIds: [],
      };
      part.sketches.push(sketch);
      return { ok: true, changed: true, createdIds: [id] };
    }

    case 'sketch.line': {
      const sketch = requireSketch(part, command.payload.sketchId);
      const id = createCadId<CadSketchEntityId>('entity');
      sketch.entities.push({
        id,
        type: 'line',
        data: { from: command.payload.from, to: command.payload.to },
      });
      return { ok: true, changed: true, createdIds: [id] };
    }

    case 'sketch.rectangle': {
      const sketch = requireSketch(part, command.payload.sketchId);
      const { origin: [x, y], width, height } = command.payload;
      if (width <= 0 || height <= 0) throw new Error('Rectangle width/height must be positive');
      const points = [
        [x, y],
        [x + width, y],
        [x + width, y + height],
        [x, y + height],
      ] as const;
      const ids: CadSketchEntityId[] = [];
      for (let index = 0; index < 4; index++) {
        const id = createCadId<CadSketchEntityId>('entity');
        const entity: CadSketchEntity = {
          id,
          type: 'line',
          data: { from: points[index], to: points[(index + 1) % 4], role: `rectangle-edge-${index}` },
        };
        sketch.entities.push(entity);
        ids.push(id);
      }
      return { ok: true, changed: true, createdIds: ids };
    }

    case 'sketch.circle': {
      const sketch = requireSketch(part, command.payload.sketchId);
      if (command.payload.diameter <= 0) throw new Error('Circle diameter must be positive');
      const id = createCadId<CadSketchEntityId>('entity');
      sketch.entities.push({
        id,
        type: 'circle',
        data: { center: command.payload.center, diameter: command.payload.diameter },
      });
      return { ok: true, changed: true, createdIds: [id] };
    }

    case 'sketch.finish':
      requireSketch(part, command.payload.sketchId);
      return { ok: true, changed: false };

    case 'constraint.horizontal':
      return addConstraint(part, command.payload.sketchId, 'horizontal', [command.payload.entityId]);

    case 'constraint.vertical':
      return addConstraint(part, command.payload.sketchId, 'vertical', [command.payload.entityId]);

    case 'constraint.fixed':
      return addConstraint(part, command.payload.sketchId, 'fixed', [command.payload.entityId]);

    case 'constraint.coincident': {
      const refs: CadSketchCommandReference[] = [command.payload.a, command.payload.b];
      return addConstraint(
        part,
        command.payload.sketchId,
        'coincident',
        refs.map((ref) => ref.entityId),
        { refs: refs.map((ref) => ({ ...ref })) },
      );
    }

    case 'dimension.linear': {
      const sketch = requireSketch(part, command.payload.sketchId);
      if (command.payload.value <= 0) throw new Error('Dimension value must be positive');
      for (const entityId of command.payload.entityIds) requireSketchEntity(sketch, entityId);
      const id = createCadId<CadDimensionId>('dimension');
      const dimension: CadDimension = {
        id,
        type: 'linear',
        entityIds: [...command.payload.entityIds],
        value: command.payload.value,
        driving: true,
        name: command.payload.name,
      };
      part.dimensions.push(dimension);
      sketch.dimensionIds.push(id);
      return { ok: true, changed: true, createdIds: [id] };
    }

    case 'dimension.diameter': {
      const sketch = requireSketch(part, command.payload.sketchId);
      if (command.payload.value <= 0) throw new Error('Diameter must be positive');
      requireSketchEntity(sketch, command.payload.entityId);
      const id = createCadId<CadDimensionId>('dimension');
      const dimension: CadDimension = {
        id,
        type: 'diameter',
        entityIds: [command.payload.entityId],
        value: command.payload.value,
        driving: true,
        name: command.payload.name,
      };
      part.dimensions.push(dimension);
      sketch.dimensionIds.push(id);
      return { ok: true, changed: true, createdIds: [id] };
    }

    case 'feature.extrude': {
      requireSketch(part, command.payload.sketchId);
      if (command.payload.distance <= 0) throw new Error('Extrude distance must be positive');
      const featureId = createCadId<CadFeatureId>('feature');
      const feature: CadFeature = {
        id: featureId,
        type: 'extrude',
        name: `Элемент выдавливания ${part.features.filter((item) => item.type === 'extrude').length + 1}`,
        suppressed: false,
        parameters: { ...command.payload },
        inputReferences: [],
      };
      part.features.push(feature);
      const createdIds: Array<CadFeatureId | CadBodyId> = [featureId];
      if (part.bodies.length === 0) {
        const bodyId = createCadId<CadBodyId>('body');
        const body: CadBody = { id: bodyId, name: 'Тело 1', visible: true };
        part.bodies.push(body);
        createdIds.push(bodyId);
      }
      return { ok: true, changed: true, createdIds };
    }

    case 'feature.cutExtrude': {
      requireSketch(part, command.payload.sketchId);
      if (command.payload.end === 'blind' && (!command.payload.distance || command.payload.distance <= 0)) {
        throw new Error('Blind cut requires a positive distance');
      }
      const id = createCadId<CadFeatureId>('feature');
      part.features.push({
        id,
        type: 'cut-extrude',
        name: `Вырезать выдавливанием ${part.features.filter((item) => item.type === 'cut-extrude').length + 1}`,
        suppressed: false,
        parameters: { ...command.payload },
        inputReferences: [],
      });
      return { ok: true, changed: true, createdIds: [id] };
    }

    case 'feature.fillet': {
      if (command.payload.radius <= 0) throw new Error('Fillet radius must be positive');
      for (const referenceId of command.payload.references) {
        if (!part.stableReferences.some((reference) => reference.id === referenceId)) {
          throw new Error(`Unknown stable reference: ${referenceId}`);
        }
      }
      const id = createCadId<CadFeatureId>('feature');
      part.features.push({
        id,
        type: 'fillet',
        name: `Скругление ${part.features.filter((item) => item.type === 'fillet').length + 1}`,
        suppressed: false,
        parameters: { radius: command.payload.radius },
        inputReferences: [...command.payload.references],
      });
      return { ok: true, changed: true, createdIds: [id] };
    }

    case 'part.dimension.setValue': {
      if (command.payload.value <= 0) throw new Error('Driving dimension value must be positive');
      const dimension = part.dimensions.find((item) => item.id === command.payload.dimensionId);
      if (!dimension) throw new Error(`Unknown dimension: ${command.payload.dimensionId}`);
      if (!dimension.driving) throw new Error(`Dimension is not driving: ${command.payload.dimensionId}`);
      dimension.value = command.payload.value;
      return { ok: true, changed: true };
    }
  }
}

function addConstraint(
  part: CadPartDocument,
  sketchId: CadSketchId,
  type: string,
  entityIds: CadSketchEntityId[],
  data?: Record<string, unknown>,
): CadCommandResult {
  const sketch = requireSketch(part, sketchId);
  for (const entityId of entityIds) requireSketchEntity(sketch, entityId);
  const id = createCadId<CadConstraintId>('constraint');
  const constraint: CadConstraint = { id, type, entityIds: [...entityIds], data };
  part.constraints.push(constraint);
  sketch.constraintIds.push(id);
  return { ok: true, changed: true, createdIds: [id] };
}

function requireSketch(part: CadPartDocument, id: CadSketchId): CadSketch {
  const sketch = part.sketches.find((item) => item.id === id);
  if (!sketch) throw new Error(`Unknown sketch: ${id}`);
  return sketch;
}

function requireSketchEntity(sketch: CadSketch, id: CadSketchEntityId): CadSketchEntity {
  const entity = sketch.entities.find((item) => item.id === id);
  if (!entity) throw new Error(`Unknown sketch entity: ${id}`);
  return entity;
}
