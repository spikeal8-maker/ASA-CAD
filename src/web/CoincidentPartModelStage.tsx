import React, { createContext, useContext } from 'react';
import type { CadSketchCommandReference } from '../contracts/commands';
import type { CadSketchEntityId } from '../contracts/ids';
import { PartModelStage } from './PartModelStage';

type PartModelStageProps = React.ComponentProps<typeof PartModelStage>;
export type SketchCoincidentCommit = (a: CadSketchCommandReference, b: CadSketchCommandReference) => Promise<boolean>;
export type SketchParallelCommit = (aEntityId: CadSketchEntityId, bEntityId: CadSketchEntityId) => Promise<boolean>;

const CoincidentCommitContext = createContext<SketchCoincidentCommit | null>(null);
const ParallelCommitContext = createContext<SketchParallelCommit | null>(null);

/** Binary Sketch-constraint bridge kept outside frozen Part/Sketch stage owners. */
export function CoincidentPartStage(
  props: PartModelStageProps & { commit: SketchCoincidentCommit; parallelCommit: SketchParallelCommit },
) {
  const { commit, parallelCommit, ...stageProps } = props;
  return (
    <CoincidentCommitContext.Provider value={commit}>
      <ParallelCommitContext.Provider value={parallelCommit}>
        <PartModelStage {...stageProps} />
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
