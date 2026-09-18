import type { CadApplication } from '../contracts/application';
import type { CadSketch } from '../contracts/document';
import type { CadSketchEntityId, CadSketchId } from '../contracts/ids';
import type { CadWorkspacePanel } from './PartSketchWorkspaceTypes';
import { useSketchCircleDimensionController } from './useSketchCircleDimensionController';
import { useSketchLineDimensionController } from './useSketchLineDimensionController';

export type SketchDimensionCreationMode = 'linear' | 'horizontal' | 'vertical' | 'diameter';

export interface SketchDimensionCreationState {
  mode: SketchDimensionCreationMode | null;
  entityId: CadSketchEntityId | null;
  value: number;
  setValue(value: number): void;
  canCommit: boolean;
  commit(): void | Promise<boolean>;
  cancel(): void;
}

export interface SketchDimensionCreationOptions {
  app: CadApplication;
  activeCommand: string | null;
  activeSketchId: CadSketchId | null;
  sketch: Readonly<CadSketch> | null;
  selectedEntityId: CadSketchEntityId | null;
  setActiveCommand(command: string | null): void;
  setPanel(panel: CadWorkspacePanel): void;
  setNotice(message: string): void;
}

export function useSketchDimensionCreation(options: SketchDimensionCreationOptions) {
  const line = useSketchLineDimensionController(options);
  const circle = useSketchCircleDimensionController(options);
  const mode: SketchDimensionCreationMode | null =
    line.lineDimensionMode ?? (circle.diameterDimensionActive ? 'diameter' : null);
  const isDiameter = mode === 'diameter';
  const dimensionCreation: SketchDimensionCreationState = {
    mode,
    entityId: isDiameter ? circle.diameterDimensionEntityId : line.lineDimensionEntityId,
    value: isDiameter ? circle.diameterDimensionValue : line.lineDimensionValue,
    setValue: isDiameter ? circle.setDiameterDimensionValue : line.setLineDimensionValue,
    canCommit: isDiameter ? circle.canCommitDiameterDimension : line.canCommitLineDimension,
    commit: isDiameter ? circle.commitDiameterDimension : line.commitLineDimension,
    cancel: isDiameter ? circle.cancelDiameterDimension : line.cancelLineDimension,
  };

  return {
    ...line,
    ...circle,
    dimensionCreation,
  };
}
