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
] as const satisfies readonly CadCommandId[];

const implemented = new Set<string>(CAD_IMPLEMENTED_COMMAND_IDS);

/**
 * Temporary compatibility aliases for planning-registry names that predate the
 * final ASA backend command name. These aliases live in one place instead of
 * leaking into UI components.
 */
export const CAD_BACKEND_COMMAND_ALIASES = {
  'part.sketch.create': 'sketch.create',
} as const satisfies Record<string, CadCommandId>;

export function resolveCadBackendCommandId(value: string): CadCommandId | null {
  if (implemented.has(value)) return value as CadCommandId;
  return CAD_BACKEND_COMMAND_ALIASES[value as keyof typeof CAD_BACKEND_COMMAND_ALIASES] ?? null;
}
