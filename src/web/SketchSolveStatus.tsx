import React from 'react';
import type { CadSketchSolveSnapshot } from '../application/SketchSolveSession';

export interface SketchSolveStatusProps {
  snapshot: Readonly<CadSketchSolveSnapshot>;
}

/** Presentation-only projection of transient solver state. */
export function SketchSolveStatus({ snapshot }: SketchSolveStatusProps) {
  const firstDiagnostic = snapshot.diagnostics[0];
  return (
    <>
      <span data-testid="sketch-solve-status" data-solve-status={snapshot.status}>
        {statusLabel(snapshot.status)}
      </span>
      <span data-testid="sketch-dof">
        DoF: {snapshot.degreesOfFreedom ?? 'н/д'}
      </span>
      {firstDiagnostic && (
        <span
          data-testid="sketch-solve-diagnostic"
          title={firstDiagnostic.message}
        >
          {firstDiagnostic.severity === 'error' ? 'Ошибка эскиза' : firstDiagnostic.message}
        </span>
      )}
    </>
  );
}

function statusLabel(status: CadSketchSolveSnapshot['status']): string {
  switch (status) {
    case 'idle': return 'Эскиз: без решения';
    case 'solving': return 'Эскиз: решение…';
    case 'solved': return 'Эскиз: решён';
    case 'error': return 'Эскиз: ошибка решения';
  }
}
