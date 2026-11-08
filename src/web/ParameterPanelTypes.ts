import type { CadViewportPick } from '../contracts/render';
import type { ExtrudeOperationController } from './useExtrudeOperationController';
import type { SketchDimensionCreationState } from './useSketchDimensionCreationControllers';
import type { SketchLineNumericInput } from './SketchLineNumericInput';
import type { SketchArcNumericInput } from './SketchArcNumericInput';

export interface ParameterPanelProps {
  activeCommand: string | null;
  lineInput: SketchLineNumericInput;
  arcInput: SketchArcNumericInput;
  requiresFaceSelection: boolean;
  selectedPick: CadViewportPick | null;
  sketchPlane: 'XY' | 'XZ' | 'YZ';
  setSketchPlane: (plane: 'XY' | 'XZ' | 'YZ') => void;
  rectangleWidth: number;
  rectangleHeight: number;
  setRectangleWidth: (value: number) => void;
  setRectangleHeight: (value: number) => void;
  circleDiameter: number;
  setCircleDiameter: (value: number) => void;
  extrude: ExtrudeOperationController;
  filletRadius: number;
  setFilletRadius: (value: number) => void;
  dimensionEditValue: number;
  setDimensionEditValue: (value: number) => void;
  dimensionCreation: SketchDimensionCreationState;
  onCreateSketch: () => void;
  onCreateRectangle: () => void;
  onCreateCircle: () => void;
  onCut: () => void;
  onFillet: () => void;
  onDimensionEdit: () => void;

  onCancel: () => void;
}
