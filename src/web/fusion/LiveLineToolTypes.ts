import type { MutableRefObject } from 'react';
import type { CadApplication } from '../../contracts/application';
import type { CadDocument, CadPoint2 } from '../../contracts/document';
import type { CadSketchId } from '../../contracts/ids';
import type { LiveLinePhase, LiveLinePointerContext, LiveLineSnapshot } from './LiveLineInteraction';

export interface SketchLineDraft { from: CadPoint2 | null; to: CadPoint2 | null; }
export interface UseSketchLineToolOptions {
  app: CadApplication;
  sketchId: CadSketchId | null;
  active: boolean;
  setNotice(message: string): void;
  onCommitted(): void;
}
export interface LiveLineFlight {
  epoch: number;
  app: CadApplication;
  document: Readonly<CadDocument>;
}
/** Shared transient refs of the single Fusion Line hook; no document copy or history. */
export interface LiveLineCommitOwner {
  optionsRef: MutableRefObject<UseSketchLineToolOptions>;
  mounted: MutableRefObject<boolean>;
  epoch: MutableRefObject<number>;
  flight: MutableRefObject<LiveLineFlight | null>;
  pointerContext: MutableRefObject<LiveLinePointerContext | null>;
  rawPointer: MutableRefObject<CadPoint2 | null>;
  state: MutableRefObject<LiveLineSnapshot>;
  publish(next: LiveLineSnapshot): void;
  clear(phase: LiveLinePhase, active: boolean): void;
}
