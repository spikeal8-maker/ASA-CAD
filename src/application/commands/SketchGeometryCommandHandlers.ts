import type { CadCommandId } from '../../contracts/commands';
import type { CadSketch, CadSketchEntity } from '../../contracts/document';
import type { CadSketchEntityId, CadSketchId } from '../../contracts/ids';
import { createCadId } from '../../contracts/ids';
import {
  ENABLED,
  defineSketchCommandHandler,
  requireSketch,
  requireSketchAvailability,
  type SketchCommandHandlerMap,
} from './SketchCommandHandlerShared';

export const SKETCH_GEOMETRY_COMMAND_IDS = [
  'sketch.create',
  'sketch.line',
  'sketch.rectangle',
  'sketch.circle',
  'sketch.arc',
] as const satisfies readonly CadCommandId[];

export type SketchGeometryCommandId = typeof SKETCH_GEOMETRY_COMMAND_IDS[number];

export const sketchGeometryCommandHandlers = {
  'sketch.create': defineSketchCommandHandler<'sketch.create'>({
    availability: () => ENABLED,
    execute: (part, command) => {
      const id = createCadId<CadSketchId>('sketch');
      const sketch: CadSketch = {
        id,
        name: command.payload.name ?? `Эскиз ${part.sketches.length + 1}`,
        support: command.payload.support,
        entities: [],
        constraintIds: [],
        dimensionIds: [],
      };
      part.sketches.push(sketch);
      return { ok: true, changed: true, createdIds: [id] };
    },
  }),

  'sketch.line': defineSketchCommandHandler<'sketch.line'>({
    availability: requireSketchAvailability,
    execute: (part, command) => {
      const sketch = requireSketch(part, command.payload.sketchId);
      const id = createCadId<CadSketchEntityId>('entity');
      sketch.entities.push({
        id,
        type: 'line',
        data: { from: command.payload.from, to: command.payload.to },
      });
      return { ok: true, changed: true, createdIds: [id] };
    },
  }),

  'sketch.rectangle': defineSketchCommandHandler<'sketch.rectangle'>({
    availability: requireSketchAvailability,
    execute: (part, command) => {
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
    },
  }),

  'sketch.circle': defineSketchCommandHandler<'sketch.circle'>({
    availability: requireSketchAvailability,
    execute: (part, command) => {
      const sketch = requireSketch(part, command.payload.sketchId);
      if (command.payload.diameter <= 0) throw new Error('Circle diameter must be positive');
      const id = createCadId<CadSketchEntityId>('entity');
      sketch.entities.push({
        id,
        type: 'circle',
        data: { center: command.payload.center, diameter: command.payload.diameter },
      });
      return { ok: true, changed: true, createdIds: [id] };
    },
  }),

  'sketch.arc': defineSketchCommandHandler<'sketch.arc'>({
    availability: requireSketchAvailability,
    execute: (part, command) => {
      const sketch = requireSketch(part, command.payload.sketchId);
      const { center, start, end } = command.payload;
      const radius = pointDistance(center, start);
      if (!(radius > 1e-6)) throw new Error('Arc radius must be positive');
      const startAngle = normalizeAngle(Math.atan2(start[1] - center[1], start[0] - center[0]));
      const rawEndAngle = normalizeAngle(Math.atan2(end[1] - center[1], end[0] - center[0]));
      const sweep = positiveSweep(startAngle, rawEndAngle);
      if (!(sweep > 1e-9) || !(sweep < TWO_PI - 1e-9)) {
        throw new Error('Arc sweep must be greater than 0 and less than 2π');
      }
      const id = createCadId<CadSketchEntityId>('entity');
      sketch.entities.push({
        id,
        type: 'arc',
        data: { center, radius, startAngle, endAngle: startAngle + sweep },
      });
      return { ok: true, changed: true, createdIds: [id] };
    },
  }),
} satisfies SketchCommandHandlerMap<SketchGeometryCommandId>;

const TWO_PI = Math.PI * 2;

function normalizeAngle(value: number): number {
  const normalized = ((value % TWO_PI) + TWO_PI) % TWO_PI;
  return Object.is(normalized, -0) ? 0 : normalized;
}

function positiveSweep(startAngle: number, endAngle: number): number {
  let sweep = endAngle - startAngle;
  if (sweep <= 0) sweep += TWO_PI;
  return sweep;
}

function pointDistance(a: readonly [number, number], b: readonly [number, number]): number {
  return Math.hypot(b[0] - a[0], b[1] - a[1]);
}
