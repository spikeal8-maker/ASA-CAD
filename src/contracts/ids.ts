export type Brand<T, TBrand extends string> = T & { readonly __brand: TBrand };

export type CadDocumentId = Brand<string, 'CadDocumentId'>;
export type CadSketchId = Brand<string, 'CadSketchId'>;
export type CadSketchEntityId = Brand<string, 'CadSketchEntityId'>;
export type CadConstraintId = Brand<string, 'CadConstraintId'>;
export type CadDimensionId = Brand<string, 'CadDimensionId'>;
export type CadFeatureId = Brand<string, 'CadFeatureId'>;
export type CadBodyId = Brand<string, 'CadBodyId'>;
export type CadStableReferenceId = Brand<string, 'CadStableReferenceId'>;
export type CadOccurrenceId = Brand<string, 'CadOccurrenceId'>;
export type CadMateId = Brand<string, 'CadMateId'>;
export type CadSheetId = Brand<string, 'CadSheetId'>;

export type CadObjectId =
  | CadDocumentId
  | CadSketchId
  | CadSketchEntityId
  | CadConstraintId
  | CadDimensionId
  | CadFeatureId
  | CadBodyId
  | CadStableReferenceId
  | CadOccurrenceId
  | CadMateId
  | CadSheetId;

/**
 * Generates an ASA-owned opaque ID. IDs are product/document identity and must
 * never be derived from a Three.js index, OCC pointer or vendor Zustand key.
 */
export function createCadId<T extends CadObjectId>(prefix: string): T {
  const random = typeof globalThis.crypto?.randomUUID === 'function'
    ? globalThis.crypto.randomUUID()
    : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
  return `${prefix}_${random}` as T;
}
