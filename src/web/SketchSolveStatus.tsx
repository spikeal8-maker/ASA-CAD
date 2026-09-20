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
      <span
        data-testid="sketch-solve-status"
        data-solve-status={snapshot.status}
        data-constraint-state={snapshot.constraintState}
      >
        {statusLabel(snapshot)}
      </span>
      <span data-testid="sketch-dof">
        DoF: {snapshot.degreesOfFreedom ?? 'н/д'}
      </span>
      {firstDiagnostic && (
        <span
          data-testid="sketch-solve-diagnostic"
          data-diagnostic-code={firstDiagnostic.code}
          title={firstDiagnostic.message}
        >
          {firstDiagnostic.message}
        </span>
      )}
    </>
  );
}

function statusLabel(snapshot: Readonly<CadSketchSolveSnapshot>): string {
  switch (snapshot.constraintState) {
    case 'under-constrained': return 'Эскиз: недоопределён';
    case 'fully-constrained': return 'Эскиз: полностью определён';
    case 'over-constrained': return 'Эскиз: переопределён';
    case 'unknown': break;
  }
  switch (snapshot.status) {
    case 'idle': return 'Эскиз: без решения';
    case 'solving': return 'Эскиз: решение…';
    case 'solved': return 'Эскиз: решён';
    case 'error': return 'Эскиз: ошибка решения';
  }
}
