import React, { createContext, useContext } from 'react';
import type { CadSketchCommandReference } from '../contracts/commands';
import type { CadSketchEntityId } from '../contracts/ids';
import { PartModelStage } from './PartModelStage';

type PartModelStageProps = React.ComponentProps<typeof PartModelStage>;
export type SketchCoincidentCommit = (a: CadSketchCommandReference, b: CadSketchCommandReference) => Promise<boolean>;
export type SketchLinePairCommit = (aEntityId: CadSketchEntityId, bEntityId: CadSketchEntityId) => Promise<boolean>;
export type SketchParallelCommit = SketchLinePairCommit;
export type SketchPerpendicularCommit = SketchLinePairCommit;
export type SketchTangentCommit = SketchLinePairCommit;
export type SketchConcentricCommit = SketchLinePairCommit;

const CoincidentCommitContext = createContext<SketchCoincidentCommit | null>(null);
const ParallelCommitContext = createContext<SketchParallelCommit | null>(null);
const PerpendicularCommitContext = createContext<SketchPerpendicularCommit | null>(null);
const TangentCommitContext = createContext<SketchTangentCommit | null>(null);
const ConcentricCommitContext = createContext<SketchConcentricCommit | null>(null);

/** Binary Sketch-constraint bridge kept outside frozen Part/Sketch stage owners. */
export function CoincidentPartStage(
  props: PartModelStageProps & {
    commit: SketchCoincidentCommit;
    parallelCommit: SketchParallelCommit;
    perpendicularCommit: SketchPerpendicularCommit;
    tangentCommit: SketchTangentCommit;
    concentricCommit: SketchConcentricCommit;
  },
) {
  const { commit, parallelCommit, perpendicularCommit, tangentCommit, concentricCommit, ...stageProps } = props;
  return (
    <CoincidentCommitContext.Provider value={commit}>
      <ParallelCommitContext.Provider value={parallelCommit}>
        <PerpendicularCommitContext.Provider value={perpendicularCommit}>
          <TangentCommitContext.Provider value={tangentCommit}>
            <ConcentricCommitContext.Provider value={concentricCommit}>
              <PartModelStage {...stageProps} />
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
