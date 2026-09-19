import type { CadApplication } from '../contracts/application';
import type { CadSketch } from '../contracts/document';
import type { CadSketchEntityId, CadSketchId } from '../contracts/ids';
import type { CadWorkspacePanel } from './PartSketchWorkspaceTypes';
import { useSketchAngularDimensionController } from './useSketchAngularDimensionController';
import { useSketchCircleDimensionController } from './useSketchCircleDimensionController';
import { useSketchLineDimensionController } from './useSketchLineDimensionController';
import { useSketchRadiusDimensionController } from './useSketchRadiusDimensionController';

export type SketchDimensionCreationMode = 'linear' | 'horizontal' | 'vertical' | 'diameter' | 'radius' | 'angular';
export type SketchDimensionTargetKind = 'line' | 'circle' | 'arc' | 'line-pair';

export interface SketchDimensionCreationState {
  mode: SketchDimensionCreationMode | null;
  entityId: CadSketchEntityId | null;
  secondaryEntityId: CadSketchEntityId | null;
  targetKind: SketchDimensionTargetKind | null;
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
  const radius = useSketchRadiusDimensionController(options);
  const angular = useSketchAngularDimensionController(options);
  const mode: SketchDimensionCreationMode | null =
    line.lineDimensionMode
    ?? (circle.diameterDimensionActive ? 'diameter' : null)
    ?? (radius.radiusDimensionActive ? 'radius' : null)
    ?? (angular.angularDimensionActive ? 'angular' : null);
  const isDiameter = mode === 'diameter';
  const isRadius = mode === 'radius';
  const isAngular = mode === 'angular';
  const dimensionCreation: SketchDimensionCreationState = {
    mode,
    entityId: isAngular
      ? angular.angularDimensionAEntityId
      : isRadius
        ? radius.radiusDimensionEntityId
        : isDiameter ? circle.diameterDimensionEntityId : line.lineDimensionEntityId,
    secondaryEntityId: isAngular ? angular.angularDimensionBEntityId : null,
    targetKind: isAngular
      ? 'line-pair'
      : isRadius
        ? radius.radiusDimensionTargetKind
        : isDiameter ? 'circle' : mode ? 'line' : null,
    value: isAngular
      ? angular.angularDimensionValue
      : isRadius
        ? radius.radiusDimensionValue
        : isDiameter ? circle.diameterDimensionValue : line.lineDimensionValue,
    setValue: isAngular
      ? angular.setAngularDimensionValue
      : isRadius
        ? radius.setRadiusDimensionValue
        : isDiameter ? circle.setDiameterDimensionValue : line.setLineDimensionValue,
    canCommit: isAngular
      ? angular.canCommitAngularDimension
      : isRadius
        ? radius.canCommitRadiusDimension
        : isDiameter ? circle.canCommitDiameterDimension : line.canCommitLineDimension,
    commit: isAngular
      ? angular.commitAngularDimension
      : isRadius
        ? radius.commitRadiusDimension
        : isDiameter ? circle.commitDiameterDimension : line.commitLineDimension,
    cancel: isAngular
      ? angular.cancelAngularDimension
      : isRadius
        ? radius.cancelRadiusDimension
        : isDiameter ? circle.cancelDiameterDimension : line.cancelLineDimension,
  };

  return {
    ...line,
    ...circle,
    ...radius,
    ...angular,
    dimensionCreation,
  };
}
