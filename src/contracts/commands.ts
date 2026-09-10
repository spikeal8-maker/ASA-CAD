import type {
  CadBodyId,
  CadConstraintId,
  CadDimensionId,
  CadFeatureId,
  CadSketchEntityId,
  CadSketchId,
  CadStableReferenceId,
} from './ids';

export type CadSketchPointName = 'a' | 'b' | 'c';

export interface CadSketchCommandReference {
  entityId: CadSketchEntityId;
  point?: CadSketchPointName;
}

export type CadCommandId =
  | 'document.rebuild'
  | 'sketch.create'
  | 'sketch.line'
  | 'sketch.rectangle'
  | 'sketch.circle'
  | 'sketch.finish'
  | 'constraint.coincident'
  | 'constraint.horizontal'
  | 'constraint.vertical'
  | 'constraint.fixed'
  | 'dimension.linear'
  | 'dimension.diameter'
  | 'feature.extrude'
  | 'feature.cutExtrude'
  | 'feature.fillet'
  | 'part.dimension.setValue';

export type CadPlaneName = 'XY' | 'XZ' | 'YZ';

export interface CadCommandMap {
  'document.rebuild': Record<string, never>;
  'sketch.create': {
    support: CadPlaneName | CadStableReferenceId;
    name?: string;
  };
  'sketch.line': {
    sketchId: CadSketchId;
    from: readonly [number, number];
    to: readonly [number, number];
  };
  'sketch.rectangle': {
    sketchId: CadSketchId;
    origin: readonly [number, number];
    width: number;
    height: number;
  };
  'sketch.circle': {
    sketchId: CadSketchId;
    center: readonly [number, number];
    diameter: number;
  };
  'sketch.finish': {
    sketchId: CadSketchId;
  };
  'constraint.coincident': {
    sketchId: CadSketchId;
    a: CadSketchCommandReference;
    b: CadSketchCommandReference;
  };
  'constraint.horizontal': {
    sketchId: CadSketchId;
    entityId: CadSketchEntityId;
  };
  'constraint.vertical': {
    sketchId: CadSketchId;
    entityId: CadSketchEntityId;
  };
  'constraint.fixed': {
    sketchId: CadSketchId;
    entityId: CadSketchEntityId;
  };
  'dimension.linear': {
    sketchId: CadSketchId;
    entityIds: CadSketchEntityId[];
    value: number;
    name?: string;
  };
  'dimension.diameter': {
    sketchId: CadSketchId;
    entityId: CadSketchEntityId;
    value: number;
    name?: string;
  };
  'feature.extrude': {
    sketchId: CadSketchId;
    distance: number;
    symmetric?: boolean;
    reverse?: boolean;
  };
  'feature.cutExtrude': {
    sketchId: CadSketchId;
    end: 'blind' | 'through-all';
    distance?: number;
  };
  'feature.fillet': {
    references: CadStableReferenceId[];
    radius: number;
  };
  'part.dimension.setValue': {
    dimensionId: CadDimensionId;
    value: number;
  };
}

export type CadCommand<K extends CadCommandId = CadCommandId> = K extends CadCommandId
  ? { id: K; payload: CadCommandMap[K] }
  : never;

export interface CadCommandResult {
  ok: boolean;
  changed: boolean;
  createdIds?: Array<
    | CadSketchId
    | CadSketchEntityId
    | CadConstraintId
    | CadDimensionId
    | CadFeatureId
    | CadBodyId
    | CadStableReferenceId
  >;
  warnings?: string[];
  error?: {
    code: string;
    message: string;
    details?: Record<string, unknown>;
  };
}

export interface CadCommandAvailability {
  enabled: boolean;
  reason?: string;
}
