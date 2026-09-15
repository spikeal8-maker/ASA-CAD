import React, { createContext, useContext } from 'react';
import type { CadSketchCommandReference } from '../contracts/commands';
import { PartModelStage } from './PartModelStage';

type PartModelStageProps = React.ComponentProps<typeof PartModelStage>;
export type SketchCoincidentCommit = (
  a: CadSketchCommandReference,
  b: CadSketchCommandReference,
) => Promise<boolean>;

const CommitContext = createContext<SketchCoincidentCommit | null>(null);

export function CoincidentPartStage(
  props: PartModelStageProps & { commit: SketchCoincidentCommit },
) {
  const { commit, ...stageProps } = props;
  return (
    <CommitContext.Provider value={commit}>
      <PartModelStage {...stageProps} />
    </CommitContext.Provider>
  );
}

export function useSketchCoincidentCommit(): SketchCoincidentCommit {
  const commit = useContext(CommitContext);
  if (!commit) throw new Error('Sketch Coincident interaction provider is missing');
  return commit;
}
