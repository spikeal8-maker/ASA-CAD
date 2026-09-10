import type {
  CadMeasurementAdapter,
  CadMeasurementRequest,
  CadMeasurementResult,
} from '../contracts/measurement';
import type { CadDocument } from '../contracts/document';
import { OpenCascadePartRuntime } from './OpenCascadePartRuntime';

/**
 * First measurement adapter. It deliberately returns only serializable ASA
 * values and reuses the same Part runtime/recompute path as modeling.
 */
export class OpenCascadeMeasurementAdapter implements CadMeasurementAdapter {
  constructor(private readonly runtime: OpenCascadePartRuntime) {}

  async measure(
    document: Readonly<CadDocument>,
    request: CadMeasurementRequest,
  ): Promise<CadMeasurementResult> {
    if (request.kind !== 'model-summary') {
      throw new Error(`Unsupported measurement: ${(request as { kind: string }).kind}`);
    }

    const recompute = await this.runtime.recompute(document);
    if (!recompute.ok) {
      throw new Error(recompute.diagnostics.find((item) => item.severity === 'error')?.message ?? 'Measurement recompute failed');
    }

    const analysis = this.runtime.getLastAnalysis();
    if (!analysis) throw new Error('Model has no measurable B-Rep result');

    return {
      kind: 'model-summary',
      bounds: {
        min: [analysis.bounds.minX, analysis.bounds.minY, analysis.bounds.minZ],
        max: [analysis.bounds.maxX, analysis.bounds.maxY, analysis.bounds.maxZ],
      },
      volume: analysis.volume,
      featureCount: analysis.featureCount,
    };
  }
}
