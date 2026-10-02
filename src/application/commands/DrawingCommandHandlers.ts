import type {
  CadCommand,
  CadCommandAvailability,
  CadCommandId,
  CadCommandResult,
} from '../../contracts/commands';
import type { CadDrawingDocument } from '../../contracts/document';
import type { CadDraftEntityId } from '../../contracts/ids';
import { createCadId } from '../../contracts/ids';
import type { CadDraftLineEntity } from '../../contracts/drafting';

export const DRAWING_COMMAND_IDS = [
  'drawing.line.create',
  'drawing.line.update',
  'drawing.entity.delete',
] as const satisfies readonly CadCommandId[];

export type DrawingCommandId = typeof DRAWING_COMMAND_IDS[number];
export type DrawingCommand = Extract<CadCommand, { id: DrawingCommandId }>;

const IDS = new Set<CadCommandId>(DRAWING_COMMAND_IDS);
const MIN_LINE_LENGTH = 1e-6;

export function isDrawingCommandId(id: CadCommandId): id is DrawingCommandId {
  return IDS.has(id);
}

export function isDrawingCommand(command: CadCommand): command is DrawingCommand {
  return isDrawingCommandId(command.id);
}

export function getDrawingCommandAvailability(
  drawing: CadDrawingDocument,
  _id: DrawingCommandId,
): CadCommandAvailability {
  const sheet = drawing.sheets[0];
  if (!sheet) return { enabled: false, reason: 'Drawing sheet is required' };
  const layer = sheet.layers.find((item) => item.id === sheet.activeLayerId);
  if (!layer) return { enabled: false, reason: 'Drawing active layer is missing' };
  if (!layer.visible || layer.locked) return { enabled: false, reason: 'Drawing active layer is not editable' };
  return { enabled: true };
}

export function applyDrawingCommand(
  drawing: CadDrawingDocument,
  command: DrawingCommand,
): CadCommandResult {
  const sheet = drawing.sheets.find((item) => item.id === command.payload.sheetId);
  if (!sheet) throw new Error(`Unknown Drawing sheet: ${command.payload.sheetId}`);
  const activeLayer = sheet.layers.find((item) => item.id === sheet.activeLayerId);
  if (!activeLayer) throw new Error(`Drawing active layer is missing: ${sheet.activeLayerId}`);
  if (!activeLayer.visible || activeLayer.locked) throw new Error('Drawing active layer is not editable');

  switch (command.id) {
    case 'drawing.line.create': {
      validateLine(command.payload.from, command.payload.to);
      const id = createCadId<CadDraftEntityId>('draft_line');
      const entity: CadDraftLineEntity = {
        id,
        type: 'line',
        layerId: activeLayer.id,
        from: tuple(command.payload.from),
        to: tuple(command.payload.to),
      };
      sheet.entities.push(entity);
      return { ok: true, changed: true, createdIds: [id] };
    }

    case 'drawing.line.update': {
      validateLine(command.payload.from, command.payload.to);
      const entity = sheet.entities.find((item) => item.id === command.payload.entityId);
      if (!entity) throw new Error(`Unknown Drawing entity: ${command.payload.entityId}`);
      const layer = sheet.layers.find((item) => item.id === entity.layerId);
      if (!layer || !layer.visible || layer.locked) throw new Error('Drawing entity layer is not editable');
      entity.from = tuple(command.payload.from);
      entity.to = tuple(command.payload.to);
      return { ok: true, changed: true };
    }

    case 'drawing.entity.delete': {
      const index = sheet.entities.findIndex((item) => item.id === command.payload.entityId);
      if (index < 0) throw new Error(`Unknown Drawing entity: ${command.payload.entityId}`);
      const entity = sheet.entities[index];
      const layer = sheet.layers.find((item) => item.id === entity.layerId);
      if (!layer || !layer.visible || layer.locked) throw new Error('Drawing entity layer is not editable');
      sheet.entities.splice(index, 1);
      return { ok: true, changed: true };
    }
  }

  const exhaustive: never = command;
  return exhaustive;
}

function validateLine(from: readonly [number, number], to: readonly [number, number]): void {
  if (![...from, ...to].every(Number.isFinite)) throw new Error('Drawing Line coordinates must be finite');
  if (Math.hypot(to[0] - from[0], to[1] - from[1]) <= MIN_LINE_LENGTH) {
    throw new Error('Drawing Line endpoints must be distinct');
  }
}

function tuple(point: readonly [number, number]): [number, number] {
  return [point[0], point[1]];
}
