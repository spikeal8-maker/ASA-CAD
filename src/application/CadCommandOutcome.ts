import type { CadApplicationState } from '../contracts/application';
import type { CadCommandResult } from '../contracts/commands';
import type { CadRuntimeRecomputeResult } from '../contracts/runtime';

/** Pure result translation; document, history and state publication remain application-owned. */
export function errorResult(error: unknown): CadCommandResult {
  return {
    ok: false, changed: false,
    error: { code: 'CAD_COMMAND_FAILED', message: error instanceof Error ? error.message : String(error) },
  };
}

export function supersededResult(): CadCommandResult {
  return {
    ok: false, changed: false,
    error: { code: 'CAD_OPERATION_SUPERSEDED', message: 'CAD operation superseded by a newer document or request' },
  };
}

interface RecomputeOutcome {
  state: Pick<CadApplicationState, 'mode' | 'recompute'>;
  command: CadCommandResult;
}

export function recomputeFailure(error: unknown): RecomputeOutcome {
  const command = errorResult(error);
  return { state: { mode: 'error', recompute: { status: 'error', message: command.error!.message } }, command };
}

export function recomputeOutcome(result: CadRuntimeRecomputeResult): RecomputeOutcome {
  const error = result.diagnostics.find(item => item.severity === 'error');
  const warning = result.diagnostics.find(item => item.severity === 'warning');
  return {
    state: {
      mode: result.ok ? 'idle' : 'error',
      recompute: result.ok
        ? warning ? { status: 'warning', message: warning.message } : { status: 'clean' }
        : { status: 'error', message: error?.message ?? 'Recompute failed' },
    },
    command: result.ok
      ? {
          ok: true, changed: false,
          warnings: result.diagnostics.filter(item => item.severity === 'warning').map(item => item.message),
        }
      : {
          ok: false, changed: false,
          error: { code: error?.code ?? 'CAD_RECOMPUTE_FAILED', message: error?.message ?? 'Recompute failed' },
        },
  };
}
