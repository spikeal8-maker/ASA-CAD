import type {
  CadBodyId,
  CadConstraintId,
  CadDimensionId,
  CadDocumentId,
  CadFeatureId,
  CadMateId,
  CadOccurrenceId,
  CadSheetId,
  CadSketchEntityId,
  CadSketchId,
  CadStableReferenceId,
} from './ids';
import { createCadId } from './ids';

export const CAD_DOCUMENT_SCHEMA_VERSION = 1 as const;
export const ASA_CAD_ENGINE_VERSION = '0.1.0-m1' as const;

export type CadDocumentKind =
  | 'part'
  | 'assembly'
  | 'drawing'
  | 'fragment'
  | 'specification'
  | 'text';

export type CadLengthUnit = 'mm' | 'cm' | 'm' | 'inch';
export type CadPoint2 = readonly [number, number];

export interface CadDocumentReference {
  documentId: CadDocumentId;
  projectId?: string;
  revision?: number;
  versionId?: string;
  kind?: CadDocumentKind;
}

export interface CadBaseDocument {
  kind: CadDocumentKind;
  schemaVersion: typeof CAD_DOCUMENT_SCHEMA_VERSION;
  engineVersion: string;
  documentId: CadDocumentId;
  title: string;
  units: CadLengthUnit;
  metadata: Record<string, string | number | boolean | null>;
  linkedDocuments: CadDocumentReference[];
}

export interface CadOrigin {
  planes: readonly ['XY', 'XZ', 'YZ'];
}

interface CadSketchEntityBase {
  id: CadSketchEntityId;
}

export interface CadLineSketchEntity extends CadSketchEntityBase {
  type: 'line';
  data: {
    from: CadPoint2;
    to: CadPoint2;
    role?: string;
  };
}

export interface CadCircleSketchEntity extends CadSketchEntityBase {
  type: 'circle';
  data: {
    center: CadPoint2;
    diameter: number;
  };
}

/** Current schema-v1 Sketch entity set. M3 extends this union deliberately. */
export type CadSketchEntity = CadLineSketchEntity | CadCircleSketchEntity;

export interface CadSketch {
  id: CadSketchId;
  name: string;
  support: string;
  entities: CadSketchEntity[];
  constraintIds: CadConstraintId[];
  dimensionIds: CadDimensionId[];
}

export interface CadSketchPointReference {
  entityId: CadSketchEntityId;
  point?: 'a' | 'b' | 'c';
}

interface CadConstraintBase {
  id: CadConstraintId;
  entityIds: CadSketchEntityId[];
}

export interface CadHorizontalConstraint extends CadConstraintBase {
  type: 'horizontal';
  data?: undefined;
}

export interface CadVerticalConstraint extends CadConstraintBase {
  type: 'vertical';
  data?: undefined;
}

export interface CadFixedConstraint extends CadConstraintBase {
  type: 'fixed';
  data?: undefined;
}

export interface CadCoincidentConstraint extends CadConstraintBase {
  type: 'coincident';
  data: { refs: [CadSketchPointReference, CadSketchPointReference] };
}

/** Current schema-v1 constraint set. M3 extends this union deliberately. */
export type CadConstraint =
  | CadHorizontalConstraint
  | CadVerticalConstraint
  | CadFixedConstraint
  | CadCoincidentConstraint;

interface CadDimensionBase {
  id: CadDimensionId;
  entityIds: CadSketchEntityId[];
  value: number;
  driving: boolean;
  name?: string;
}

export interface CadLinearDimension extends CadDimensionBase {
  type: 'linear';
}

export interface CadDiameterDimension extends CadDimensionBase {
  type: 'diameter';
}

/** Current schema-v1 dimension set. M3 extends this union deliberately. */
export type CadDimension = CadLinearDimension | CadDiameterDimension;

export interface CadFeature {
  id: CadFeatureId;
  type: string;
  name: string;
  suppressed: boolean;
  parameters: Record<string, unknown>;
  inputReferences: CadStableReferenceId[];
}

export interface CadStableReference {
  id: CadStableReferenceId;
  ownerFeatureId?: CadFeatureId;
  semanticRole: string;
  locator: Record<string, unknown>;
}

export interface CadBody {
  id: CadBodyId;
  name: string;
  visible: boolean;
}

export interface CadPartDocument extends CadBaseDocument {
  kind: 'part';
  origin: CadOrigin;
  variables: Record<string, number>;
  sketches: CadSketch[];
  constraints: CadConstraint[];
  dimensions: CadDimension[];
  features: CadFeature[];
  bodies: CadBody[];
  stableReferences: CadStableReference[];
}

export interface CadTransform {
  translation: readonly [number, number, number];
  rotationQuaternion: readonly [number, number, number, number];
}

export interface CadAssemblyOccurrence {
  id: CadOccurrenceId;
  name: string;
  source: CadDocumentReference;
  transform: CadTransform;
  visible: boolean;
  suppressed: boolean;
  fixed: boolean;
}

export interface CadAssemblyMate {
  id: CadMateId;
  type: string;
  occurrenceIds: CadOccurrenceId[];
  references: CadStableReferenceId[];
  parameters: Record<string, unknown>;
  suppressed: boolean;
}

export interface CadAssemblyDocument extends CadBaseDocument {
  kind: 'assembly';
  variables: Record<string, number>;
  occurrences: CadAssemblyOccurrence[];
  mates: CadAssemblyMate[];
  stableReferences: CadStableReference[];
}

export interface CadDrawingSheet {
  id: CadSheetId;
  name: string;
  format: string;
  orientation: 'portrait' | 'landscape';
  scale: number;
  entities: Array<Record<string, unknown>>;
}

export interface CadDrawingDocument extends CadBaseDocument {
  kind: 'drawing';
  sheets: CadDrawingSheet[];
  modelReferences: CadDocumentReference[];
}

export interface CadFragmentDocument extends CadBaseDocument {
  kind: 'fragment';
  entities: Array<Record<string, unknown>>;
  layers: Array<Record<string, unknown>>;
}

export interface CadSpecificationDocument extends CadBaseDocument {
  kind: 'specification';
  sourceReferences: CadDocumentReference[];
  sections: Array<Record<string, unknown>>;
}

export interface CadTextDocument extends CadBaseDocument {
  kind: 'text';
  pages: Array<Record<string, unknown>>;
}

export type CadDocument =
  | CadPartDocument
  | CadAssemblyDocument
  | CadDrawingDocument
  | CadFragmentDocument
  | CadSpecificationDocument
  | CadTextDocument;

export interface CreateCadDocumentOptions {
  title?: string;
  documentId?: CadDocumentId;
  units?: CadLengthUnit;
}

function createBaseDocument(kind: CadDocumentKind, options: CreateCadDocumentOptions = {}): CadBaseDocument {
  return {
    kind,
    schemaVersion: CAD_DOCUMENT_SCHEMA_VERSION,
    engineVersion: ASA_CAD_ENGINE_VERSION,
    documentId: options.documentId ?? createCadId<CadDocumentId>('doc'),
    title: options.title ?? defaultTitle(kind),
    units: options.units ?? 'mm',
    metadata: {},
    linkedDocuments: [],
  };
}

function defaultTitle(kind: CadDocumentKind): string {
  switch (kind) {
    case 'part': return 'Деталь';
    case 'assembly': return 'Сборка';
    case 'drawing': return 'Чертеж';
    case 'fragment': return 'Фрагмент';
    case 'specification': return 'Спецификация';
    case 'text': return 'Текстовый документ';
  }
}

export function createEmptyCadDocument(kind: 'part', options?: CreateCadDocumentOptions): CadPartDocument;
export function createEmptyCadDocument(kind: 'assembly', options?: CreateCadDocumentOptions): CadAssemblyDocument;
export function createEmptyCadDocument(kind: 'drawing', options?: CreateCadDocumentOptions): CadDrawingDocument;
export function createEmptyCadDocument(kind: 'fragment', options?: CreateCadDocumentOptions): CadFragmentDocument;
export function createEmptyCadDocument(kind: 'specification', options?: CreateCadDocumentOptions): CadSpecificationDocument;
export function createEmptyCadDocument(kind: 'text', options?: CreateCadDocumentOptions): CadTextDocument;
export function createEmptyCadDocument(kind: CadDocumentKind, options?: CreateCadDocumentOptions): CadDocument;
export function createEmptyCadDocument(
  kind: CadDocumentKind,
  options: CreateCadDocumentOptions = {},
): CadDocument {
  const base = createBaseDocument(kind, options);
  switch (kind) {
    case 'part':
      return {
        ...base,
        kind,
        origin: { planes: ['XY', 'XZ', 'YZ'] },
        variables: {},
        sketches: [],
        constraints: [],
        dimensions: [],
        features: [],
        bodies: [],
        stableReferences: [],
      };
    case 'assembly':
      return { ...base, kind, variables: {}, occurrences: [], mates: [], stableReferences: [] };
    case 'drawing':
      return { ...base, kind, sheets: [], modelReferences: [] };
    case 'fragment':
      return { ...base, kind, entities: [], layers: [] };
    case 'specification':
      return { ...base, kind, sourceReferences: [], sections: [] };
    case 'text':
      return { ...base, kind, pages: [] };
  }
}

export function serializeCadDocument(document: Readonly<CadDocument>): string {
  validateCadDocument(document);
  return JSON.stringify(document);
}

export function parseCadDocument(value: string | unknown): CadDocument {
  const parsed: unknown = typeof value === 'string' ? JSON.parse(value) : value;
  validateCadDocument(parsed);
  return parsed;
}

export function validateCadDocument(value: unknown): asserts value is CadDocument {
  if (!value || typeof value !== 'object') throw new Error('CadDocument must be an object');
  const document = value as Partial<CadDocument>;
  if (!['part', 'assembly', 'drawing', 'fragment', 'specification', 'text'].includes(String(document.kind))) {
    throw new Error(`Unsupported CadDocument kind: ${String(document.kind)}`);
  }
  if (document.schemaVersion !== CAD_DOCUMENT_SCHEMA_VERSION) {
    throw new Error(`Unsupported CadDocument schemaVersion: ${String(document.schemaVersion)}`);
  }
  if (typeof document.engineVersion !== 'string' || !document.engineVersion) {
    throw new Error('CadDocument.engineVersion is required');
  }
  if (typeof document.documentId !== 'string' || !document.documentId) {
    throw new Error('CadDocument.documentId is required');
  }
  if (typeof document.title !== 'string') throw new Error('CadDocument.title must be a string');
  if (!['mm', 'cm', 'm', 'inch'].includes(String(document.units))) {
    throw new Error(`Unsupported CadDocument units: ${String(document.units)}`);
  }

  if (document.kind === 'part') validatePartDocument(document as CadPartDocument);
}

function validatePartDocument(part: CadPartDocument): void {
  for (const field of ['sketches', 'constraints', 'dimensions', 'features', 'bodies', 'stableReferences'] as const) {
    if (!Array.isArray(part[field])) throw new Error(`CadPartDocument.${field} must be an array`);
  }

  const entityIds = new Set<string>();
  for (const sketch of part.sketches) {
    if (!Array.isArray(sketch.entities)) throw new Error(`${sketch.id}.entities must be an array`);
    for (const entity of sketch.entities) {
      if (entityIds.has(entity.id)) throw new Error(`Duplicate sketch entity id: ${entity.id}`);
      entityIds.add(entity.id);
      if (entity.type === 'line') {
        validatePoint2(entity.data.from, `${entity.id}.from`);
        validatePoint2(entity.data.to, `${entity.id}.to`);
      } else if (entity.type === 'circle') {
        validatePoint2(entity.data.center, `${entity.id}.center`);
        if (!(typeof entity.data.diameter === 'number' && Number.isFinite(entity.data.diameter) && entity.data.diameter > 0)) {
          throw new Error(`${entity.id}.diameter must be a positive finite number`);
        }
      } else {
        const unreachable: never = entity;
        throw new Error(`Unsupported schema-v1 sketch entity: ${String((unreachable as { type?: unknown }).type)}`);
      }
    }
  }

  for (const constraint of part.constraints) {
    if (!['horizontal', 'vertical', 'fixed', 'coincident'].includes(constraint.type)) {
      throw new Error(`Unsupported schema-v1 constraint: ${String(constraint.type)}`);
    }
    if (!constraint.entityIds.every((id) => entityIds.has(id))) {
      throw new Error(`${constraint.id}: constraint references unknown sketch entity`);
    }
    if (constraint.type === 'coincident') {
      if (!constraint.data || !Array.isArray(constraint.data.refs) || constraint.data.refs.length !== 2) {
        throw new Error(`${constraint.id}: coincident constraint requires two point refs`);
      }
    }
  }

  for (const dimension of part.dimensions) {
    if (!['linear', 'diameter'].includes(dimension.type)) {
      throw new Error(`Unsupported schema-v1 dimension: ${String(dimension.type)}`);
    }
    if (!(Number.isFinite(dimension.value) && dimension.value > 0)) {
      throw new Error(`${dimension.id}: dimension value must be a positive finite number`);
    }
    if (!dimension.entityIds.every((id) => entityIds.has(id))) {
      throw new Error(`${dimension.id}: dimension references unknown sketch entity`);
    }
  }
}

function validatePoint2(value: unknown, label: string): asserts value is CadPoint2 {
  if (!Array.isArray(value) || value.length !== 2 || !value.every((item) => typeof item === 'number' && Number.isFinite(item))) {
    throw new Error(`${label} must be a finite [x,y] tuple`);
  }
}
