import type { CadApplication } from '../contracts/application';
import type { CadDocument } from '../contracts/document';
import type { CadSketchEntityId, CadSketchId } from '../contracts/ids';
import type { AngularDimensionPreflightResult } from '../browser/AngularDimensionPreflight';

export interface AngularDimensionAttemptSnapshot {
  requestId: number;
  appRevision: number;
  document: Readonly<CadDocument>;
  sketchId: CadSketchId;
  aEntityId: CadSketchEntityId;
  bEntityId: CadSketchEntityId;
  value: number;
}

export interface AngularDimensionAttemptLiveState {
  mounted: boolean;
  requestCurrent: boolean;
  appRevision: number;
  document: Readonly<CadDocument>;
  activeCommand: string | null;
  activeSketchId: CadSketchId | null;
  targetSketchId: CadSketchId | null;
  aEntityId: CadSketchEntityId | null;
  bEntityId: CadSketchEntityId | null;
  value: number;
}

export class AngularDimensionAttemptEpoch {
  private epoch = 0;
  private pending: number | null = null;

  begin(): number | null {
    if (this.pending !== null) return null;
    const requestId = ++this.epoch;
    this.pending = requestId;
    return requestId;
  }
  invalidate(): void {
    this.epoch += 1;
    this.pending = null;
  }

  owns(requestId: number): boolean {
    return this.pending === requestId && this.epoch === requestId;
  }

  finish(requestId: number): boolean {
    if (!this.owns(requestId)) return false;
    this.pending = null;
    return true;
  }
}

export function isAngularDimensionAttemptCurrent(
  attempt: AngularDimensionAttemptSnapshot,
  live: AngularDimensionAttemptLiveState,
): boolean {
  if (!live.mounted || !live.requestCurrent) return false;
  if (live.appRevision !== attempt.appRevision || live.document !== attempt.document) return false;
  if (live.activeCommand !== 'dimension.angular' || live.activeSketchId !== attempt.sketchId) return false;
  if (live.targetSketchId !== attempt.sketchId) return false;
  if (live.aEntityId !== attempt.aEntityId || live.bEntityId !== attempt.bEntityId) return false;
  if (!Object.is(live.value, attempt.value)) return false;
  if (live.document.kind !== 'part') return false;
  const sketch = live.document.sketches.find((item) => item.id === attempt.sketchId);
  if (!sketch) return false;
  return [attempt.aEntityId, attempt.bEntityId].every((entityId) => (
    sketch.entities.some((entity) => entity.id === entityId && entity.type === 'line')
  ));
}
export function formatAngularDimensionPreflightMessage(
  result: Exclude<AngularDimensionPreflightResult, { ok: true }>,
): string {
  if (result.kind === 'solver-error') return `Не удалось проверить угловой размер: ${result.message}`;
  if (result.kind === 'invalid-context') return `Проверка углового размера отменена: ${result.message}`;
  return `Угловой размер конфликтует с существующими ограничениями: ${result.message}`;
}

export type AngularDimensionAttemptOutcome =
  | { status: 'stale' }
  | { status: 'preflight-rejected'; preflight: Exclude<AngularDimensionPreflightResult, { ok: true }> }
  | { status: 'applied'; result: Awaited<ReturnType<CadApplication['execute']>> }
  | { status: 'command-failed'; result: Awaited<ReturnType<CadApplication['execute']>> };

export async function runAngularDimensionAttempt(options: {
  preflight(): Promise<AngularDimensionPreflightResult>;
  isCurrent(): boolean;
  execute(): ReturnType<CadApplication['execute']>;
}): Promise<AngularDimensionAttemptOutcome> {
  let preflight: AngularDimensionPreflightResult;
  try {
    preflight = await options.preflight();
  } catch (error) {
    preflight = {
      ok: false,
      kind: 'solver-error',
      message: error instanceof Error ? error.message : String(error),
    };
  }

  if (!options.isCurrent()) return { status: 'stale' };
  if (!preflight.ok) return { status: 'preflight-rejected', preflight };

  // Final freshness check and application dispatch stay one synchronous section.
  const execution = options.execute();
  const result = await execution;
  return result.ok
    ? { status: 'applied', result }
    : { status: 'command-failed', result };
}
