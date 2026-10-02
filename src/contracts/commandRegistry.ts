import type { CadCommandId } from './commands';

/**
 * Runtime command IDs currently implemented by CadApplicationImpl. The
 * `satisfies` clause keeps this list type-checked against the public union.
 */
export const CAD_IMPLEMENTED_COMMAND_IDS = [
  'document.rebuild',
  'sketch.create',
  'sketch.line',
  'sketch.rectangle',
  'sketch.circle',
  'sketch.construction',
  'sketch.finish',
  'constraint.coincident',
  'constraint.horizontal',
  'constraint.vertical',
  'constraint.fixed',
  'dimension.linear',
  'dimension.diameter',
  'feature.extrude',
  'feature.cutExtrude',
  'feature.fillet',
  'part.dimension.setValue',
  'drawing.line.create',
  'drawing.line.update',
  'drawing.entity.delete',
] as const satisfies readonly CadCommandId[];

const implemented = new Set<string>(CAD_IMPLEMENTED_COMMAND_IDS);

/**
 * Product/UI IDs do not need to equal lower-level CadApplication command IDs.
 * The mapping is centralized here so React components never invent aliases.
 */
export const CAD_BACKEND_COMMAND_ALIASES = {
  'system.rebuild': 'document.rebuild',
  'part.sketch.create': 'sketch.create',
  'part.extrude': 'feature.extrude',
  'part.cutExtrude': 'feature.cutExtrude',
  'part.fillet': 'feature.fillet',
  'draft.line': 'drawing.line.create',
  'draft.entity.delete': 'drawing.entity.delete',
} as const satisfies Record<string, CadCommandId>;

export function resolveCadBackendCommandId(value: string): CadCommandId | null {
  if (implemented.has(value)) return value as CadCommandId;
  return CAD_BACKEND_COMMAND_ALIASES[value as keyof typeof CAD_BACKEND_COMMAND_ALIASES] ?? null;
}
