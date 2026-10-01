import type { CadDrawingDocument, CadDrawingSheet } from './document';
import type { CadDraftEntityId, CadDraftLayerId } from './ids';
import type { CadPoint2 } from './sketch';

export interface CadDraftLayer {
  id: CadDraftLayerId;
  name: string;
  visible: boolean;
  locked: boolean;
}

export interface CadDraftLineEntity {
  id: CadDraftEntityId;
  type: 'line';
  layerId: CadDraftLayerId;
  from: CadPoint2;
  to: CadPoint2;
}

export type CadDraftEntity = CadDraftLineEntity;
export const CAD_DRAFT_ENTITY_TYPES = ['line'] as const;

const MIN_LINE_LENGTH = 1e-6;

export function validateCadDrawingDocument(document: CadDrawingDocument): void {
  if (!Array.isArray(document.sheets) || document.sheets.length === 0) {
    throw new Error('Drawing must contain at least one sheet');
  }
  const sheetIds = new Set<string>();
  const entityIds = new Set<string>();

  for (const [index, sheet] of document.sheets.entries()) {
    validateDrawingSheet(sheet, index);
    if (sheetIds.has(sheet.id)) throw new Error(`Duplicate Drawing sheet id: ${sheet.id}`);
    sheetIds.add(sheet.id);

    for (const entity of sheet.entities) {
      if (entityIds.has(entity.id)) throw new Error(`Duplicate Drawing entity id: ${entity.id}`);
      entityIds.add(entity.id);
    }
  }
}

export function validateDrawingSheet(sheet: CadDrawingSheet, index = 0): void {
  if (!sheet || typeof sheet !== 'object') throw new Error(`Drawing sheets[${index}] must be an object`);
  if (typeof sheet.id !== 'string' || !sheet.id) throw new Error(`Drawing sheets[${index}].id is required`);
  if (typeof sheet.name !== 'string' || !sheet.name) throw new Error(`Drawing sheets[${index}].name is required`);
  if (sheet.format !== 'A4') throw new Error(`Drawing sheets[${index}].format is unsupported: ${sheet.format}`);
  if (!['portrait', 'landscape'].includes(sheet.orientation)) {
    throw new Error(`Drawing sheets[${index}].orientation is unsupported: ${sheet.orientation}`);
  }
  finitePositive(sheet.scale, `Drawing sheets[${index}].scale`);
  finitePositive(sheet.width, `Drawing sheets[${index}].width`);
  finitePositive(sheet.height, `Drawing sheets[${index}].height`);

  if (!Array.isArray(sheet.layers) || sheet.layers.length === 0) {
    throw new Error(`Drawing sheets[${index}].layers must contain at least one layer`);
  }
  const layerIds = new Set<string>();
  for (const [layerIndex, layer] of sheet.layers.entries()) {
    if (!layer || typeof layer !== 'object') throw new Error(`Drawing sheets[${index}].layers[${layerIndex}] must be an object`);
    if (typeof layer.id !== 'string' || !layer.id) throw new Error(`Drawing layer id is required`);
    if (layerIds.has(layer.id)) throw new Error(`Duplicate Drawing layer id: ${layer.id}`);
    layerIds.add(layer.id);
    if (typeof layer.name !== 'string' || !layer.name) throw new Error(`Drawing layer name is required`);
    if (typeof layer.visible !== 'boolean' || typeof layer.locked !== 'boolean') {
      throw new Error(`Drawing layer ${layer.id} visibility/lock state must be boolean`);
    }
  }
  if (!layerIds.has(sheet.activeLayerId)) throw new Error(`Drawing activeLayerId is unknown: ${sheet.activeLayerId}`);

  if (!Array.isArray(sheet.entities)) throw new Error(`Drawing sheets[${index}].entities must be an array`);
  for (const [entityIndex, entity] of sheet.entities.entries()) {
    if (!entity || typeof entity !== 'object') throw new Error(`Drawing entity ${entityIndex} must be an object`);
    if (entity.type !== 'line') throw new Error(`Drawing entity type is unsupported: ${String((entity as { type?: unknown }).type)}`);
    if (typeof entity.id !== 'string' || !entity.id) throw new Error('Drawing Line id is required');
    if (!layerIds.has(entity.layerId)) throw new Error(`Drawing Line layerId is unknown: ${entity.layerId}`);
    validatePoint(entity.from, 'Drawing Line.from');
    validatePoint(entity.to, 'Drawing Line.to');
    if (Math.hypot(entity.to[0] - entity.from[0], entity.to[1] - entity.from[1]) <= MIN_LINE_LENGTH) {
      throw new Error('Drawing Line endpoints must be distinct');
    }
  }
}

export function drawingLineLength(entity: CadDraftLineEntity): number {
  return Math.hypot(entity.to[0] - entity.from[0], entity.to[1] - entity.from[1]);
}

function validatePoint(point: CadPoint2, label: string): void {
  if (!Array.isArray(point) || point.length !== 2 || !point.every(Number.isFinite)) {
    throw new Error(`${label} must contain two finite coordinates`);
  }
}

function finitePositive(value: number, label: string): void {
  if (!Number.isFinite(value) || value <= 0) throw new Error(`${label} must be positive`);
}
