import type { CadDocument } from './document';

export interface CadBounds3d {
  min: readonly [number, number, number];
  max: readonly [number, number, number];
}

export type CadMeasurementRequest =
  | { kind: 'model-summary' };

export type CadMeasurementResult =
  | {
      kind: 'model-summary';
      bounds: CadBounds3d;
      volume: number;
      featureCount: number;
    };

/** Runtime measurement seam. Results are serializable ASA data only. */
export interface CadMeasurementAdapter {
  measure(
    document: Readonly<CadDocument>,
    request: CadMeasurementRequest,
  ): Promise<CadMeasurementResult>;
}
