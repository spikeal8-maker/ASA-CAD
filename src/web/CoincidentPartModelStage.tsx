import React, { createContext, useContext } from 'react';
import type { CadSketchCommandReference } from '../contracts/commands';
import type { CadSketchEntityId } from '../contracts/ids';
import { PartModelStage } from './PartModelStage';
import { SketchReadOnlyStage } from './SketchReadOnlyStage';

type PartModelStageProps = React.ComponentProps<typeof PartModelStage>;
export type SketchCoincidentCommit = (a: CadSketchCommandReference, b: CadSketchCommandReference) => Promise<boolean>;
export type SketchLinePairCommit = (aEntityId: CadSketchEntityId, bEntityId: CadSketchEntityId) => Promise<boolean>;
export type SketchParallelCommit = SketchLinePairCommit;
export type SketchPerpendicularCommit = SketchLinePairCommit;
export type SketchTangentCommit = SketchLinePairCommit;
export type SketchConcentricCommit = SketchLinePairCommit;
export type SketchEqualCommit = SketchLinePairCommit;
export type SketchSymmetryCommit = (a: CadSketchCommandReference, b: CadSketchCommandReference, axisEntityId: CadSketchEntityId) => Promise<boolean>;
export type SketchPointOnCurveCommit = (source: CadSketchCommandReference, targetEntityId: CadSketchEntityId) => Promise<boolean>;
export type SketchAngularPairSelect = SketchLinePairCommit;

const CoincidentCommitContext = createContext<SketchCoincidentCommit | null>(null);
const ParallelCommitContext = createContext<SketchParallelCommit | null>(null);
const PerpendicularCommitContext = createContext<SketchPerpendicularCommit | null>(null);
const TangentCommitContext = createContext<SketchTangentCommit | null>(null);
const ConcentricCommitContext = createContext<SketchConcentricCommit | null>(null);
const EqualCommitContext = createContext<SketchEqualCommit | null>(null);
const SymmetryCommitContext = createContext<SketchSymmetryCommit | null>(null);
const PointOnCurveCommitContext = createContext<SketchPointOnCurveCommit | null>(null);
const AngularPairSelectContext = createContext<SketchAngularPairSelect | null>(null);

/** Binary Sketch-constraint bridge kept outside frozen Part/Sketch stage owners. */
export function CoincidentPartStage(
  props: PartModelStageProps & {
    commit: SketchCoincidentCommit;
    parallelCommit: SketchParallelCommit;
    perpendicularCommit: SketchPerpendicularCommit;
    tangentCommit: SketchTangentCommit;
    concentricCommit: SketchConcentricCommit;
    equalCommit: SketchEqualCommit;
    symmetryCommit: SketchSymmetryCommit;
    pointOnCurveCommit: SketchPointOnCurveCommit;
    angularPair: SketchAngularPairSelect;
  },
) {
  const {
    commit, parallelCommit, perpendicularCommit, tangentCommit, concentricCommit,
    equalCommit, symmetryCommit, pointOnCurveCommit, angularPair, ...stageProps
  } = props;
  const readOnlySketch = stageProps.activeWorkspace !== 'sketch' && !stageProps.renderModel && !stageProps.fixtureError
    ? stageProps.document.sketches[stageProps.document.sketches.length - 1] ?? null
    : null;
  const stage = readOnlySketch
    ? <SketchReadOnlyStage document={stageProps.document} sketch={readOnlySketch} revisionToken={stageProps.revisionToken} />
    : <PartModelStage {...stageProps} />;
  return (
    <CoincidentCommitContext.Provider value={commit}>
      <ParallelCommitContext.Provider value={parallelCommit}>
        <PerpendicularCommitContext.Provider value={perpendicularCommit}>
          <TangentCommitContext.Provider value={tangentCommit}>
            <ConcentricCommitContext.Provider value={concentricCommit}>
              <EqualCommitContext.Provider value={equalCommit}>
                <SymmetryCommitContext.Provider value={symmetryCommit}>
                  <PointOnCurveCommitContext.Provider value={pointOnCurveCommit}>
                    <AngularPairSelectContext.Provider value={angularPair}>
                      {stage}
                    </AngularPairSelectContext.Provider>
                  </PointOnCurveCommitContext.Provider>
                </SymmetryCommitContext.Provider>
              </EqualCommitContext.Provider>
            </ConcentricCommitContext.Provider>
          </TangentCommitContext.Provider>
        </PerpendicularCommitContext.Provider>
      </ParallelCommitContext.Provider>
    </CoincidentCommitContext.Provider>
  );
}

export function useSketchCoincidentCommit(): SketchCoincidentCommit {
  const commit = useContext(CoincidentCommitContext);
  if (!commit) throw new Error('Sketch Coincident interaction provider is missing');
  return commit;
}

export function useSketchParallelCommit(): SketchParallelCommit {
  const commit = useContext(ParallelCommitContext);
  if (!commit) throw new Error('Sketch Parallel interaction provider is missing');
  return commit;
}

export function useSketchPerpendicularCommit(): SketchPerpendicularCommit {
  const commit = useContext(PerpendicularCommitContext);
  if (!commit) throw new Error('Sketch Perpendicular interaction provider is missing');
  return commit;
}

export function useSketchTangentCommit(): SketchTangentCommit {
  const commit = useContext(TangentCommitContext);
  if (!commit) throw new Error('Sketch Tangent interaction provider is missing');
  return commit;
}

export function useSketchConcentricCommit(): SketchConcentricCommit {
  const commit = useContext(ConcentricCommitContext);
  if (!commit) throw new Error('Sketch Concentric interaction provider is missing');
  return commit;
}

export function useSketchEqualCommit(): SketchEqualCommit {
  const commit = useContext(EqualCommitContext);
  if (!commit) throw new Error('Sketch Equal interaction provider is missing');
  return commit;
}

export function useSketchSymmetryCommit(): SketchSymmetryCommit {
  const commit = useContext(SymmetryCommitContext);
  if (!commit) throw new Error('Sketch Symmetry interaction provider is missing');
  return commit;
}

export function useSketchPointOnCurveCommit(): SketchPointOnCurveCommit {
  const commit = useContext(PointOnCurveCommitContext);
  if (!commit) throw new Error('Sketch Point-on-curve interaction provider is missing');
  return commit;
}

export function useSketchAngularPairSelect(): SketchAngularPairSelect {
  const select = useContext(AngularPairSelectContext);
  if (!select) throw new Error('Sketch Angular interaction provider is missing');
  return select;
}
