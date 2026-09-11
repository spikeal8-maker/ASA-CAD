import React from 'react';
import type { CadSketchSolveSnapshot } from '../application/SketchSolveSession';
import './sketch-solve-status.css';

export interface SketchSolveStatusProps {
  active: boolean;
  snapshot: Readonly<CadSketchSolveSnapshot>;
}

export function SketchSolveStatus({ active, snapshot }: SketchSolveStatusProps) {
  if (!active || !snapshot.sketchId) return null;

  const statusLabel = snapshot.status === 'solving'
    ? 'решение…'
    : snapshot.status === 'solved'
      ? 'решён'
      : snapshot.status === 'error'
        ? 'ошибка'
        : 'ожидание';
  const dofLabel = snapshot.degreesOfFreedom == null ? '—' : String(snapshot.degreesOfFreedom);
  const diagnostic = snapshot.diagnostics[0]?.message;

  return (
    <span
      className={`sketch-solve-status ${snapshot.status}`}
      data-testid="sketch-solve-status"
      data-solve-status={snapshot.status}
      data-sketch-id={snapshot.sketchId}
      data-constraint-state={snapshot.constraintState}
      data-degrees-of-freedom={snapshot.degreesOfFreedom ?? ''}
      title={diagnostic}
    >
      <span>Эскиз: {statusLabel}</span>
      <span>DOF: {dofLabel}</span>
      {diagnostic && <span className="sketch-solve-diagnostic">{diagnostic}</span>}
    </span>
  );
}
