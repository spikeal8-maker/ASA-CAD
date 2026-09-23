import {useState} from 'react';
import type {CadApplication} from '../contracts/application';
import type {CadDocument} from '../contracts/document';
import {useSketchSession} from './useSketchSession';
import {usePartSelectionController} from './usePartSelectionController';
import {useSketchEditingController} from './useSketchEditingController';
import {useSketchDimensionController} from './useSketchDimensionController';
import {useSketchDimensionCreation} from './useSketchDimensionCreationControllers';
import {useSketchConstraintControllers} from './useSketchConstraintControllers';
import {useSketchEntityMutationController} from './useSketchEntityMutationController';
import {usePartFeatureController} from './usePartFeatureController';
import {partDocument} from './PartSketchWorkspaceModel';
import type {CadWorkspacePanel} from './PartSketchWorkspaceTypes';
import {usePartWorkspaceNavigation} from './usePartWorkspaceNavigation';
export type { CadWorkspacePanel,PartSketchSelectionMode } from './PartSketchWorkspaceTypes';
export interface PartSketchWorkspaceOptions {
  app: CadApplication; document: Readonly<CadDocument>; renderModelAvailable: boolean;
  setPanel(panel: CadWorkspacePanel): void; setNotice(message: string): void;
}
export function usePartSketchWorkspace(options: PartSketchWorkspaceOptions) {
  const { app,document,renderModelAvailable,setPanel,setNotice }=options;
  const [activeWorkspace,setActiveWorkspace]=useState('solid');
  const [activeCommand,setActiveCommand]=useState<string | null>(null);
  const part=partDocument(document);
  const {
    activeSketchId,activeSketch:sketch,selectedEntityId,
    enterSketch:activateSketch,clearActiveSketch,selectEntity,clearEntitySelection,
  }=useSketchSession(part);
  const selection=usePartSelectionController({
    part,activeSketchId,clearSketchEntitySelection: clearEntitySelection,
    selectSketchEntity: selectEntity,setNotice,
  });
  const editing=useSketchEditingController({
    app,activeSketchId,sketch,activeCommand,setActiveCommand,setActiveWorkspace,
    setPanel,setNotice,clearTransientSelection: selection.clearTransientSelection,
    finishSession: clearActiveSketch,
  });
  const entityMutations=useSketchEntityMutationController({
    app,activeSketchId,selectedEntityId,setNotice,clearEntitySelection,
  });
  const constraints=useSketchConstraintControllers({
    app,activeSketchId,sketch,selectedEntityId,setActiveCommand,setPanel,setNotice,
  });
  const dimensions=useSketchDimensionController({
    app,setActiveCommand,setActiveWorkspace,setPanel,setNotice,activeSketchId,
    clearTransientSelection: selection.clearTransientSelection,
    setRectangleWidth: editing.setRectangleWidth,
    setRectangleHeight: editing.setRectangleHeight,
    setCircleDiameter: editing.setCircleDiameter,
  });
  const creation=useSketchDimensionCreation({
    app,activeCommand,activeSketchId,sketch,selectedEntityId,
    setActiveCommand,setPanel,setNotice,
  });
  const featureSketch=sketch??part?.sketches.at(-1)??null;
  const features=usePartFeatureController({
    app,document,renderModelAvailable,activeSketchId: activeSketchId??featureSketch?.id ?? null,sketch: featureSketch,
    selectedPick: selection.selectedPick,setActiveCommand,setActiveWorkspace,
    setPanel,setNotice,activateSketch,beginPartSelection: selection.beginPartSelection,
    clearTransientSelection: selection.clearTransientSelection,
  });
  const navigation=usePartWorkspaceNavigation({
    app,documentKind: document.kind,setActiveCommand,setActiveWorkspace,setPanel,setNotice,
    activateSketch,clearActiveSketch,clearTransientSelection: selection.clearTransientSelection,
    clearDimensionEdit: dimensions.clearDimensionEdit,
  });
  function cancelCommand() {
    if (creation.dimensionCreation.mode) {
      creation.dimensionCreation.cancel();
      return;
    }
    editing.resetActiveTool(activeCommand);
    const stayInSketch=activeCommand === 'constraint.coincident' || /^(sketch|constraint)\./.test(activeCommand ?? '');
    setActiveCommand(null);
    dimensions.clearDimensionEdit();
    setPanel('tree');
    selection.clearTransientSelection();
    setActiveWorkspace(document.kind === 'part' ? (stayInSketch ? 'sketch' : 'solid') : document.kind);
    setNotice('Команда отменена');
  }
  async function commitActiveCommand() {
    if (activeCommand === 'sketch.line') return editing.commitLinePreview();
    if (activeCommand === 'sketch.arc') return editing.commitArcPreview();
    if (activeCommand === 'part.sketch.create') return features.commitCreateSketch();
    if (activeCommand === 'sketch.rectangle') return editing.hasRectangleDraft ? editing.commitRectanglePreview() : editing.commitRectangle();
    if (activeCommand === 'sketch.circle') return editing.hasCircleDraft ? editing.commitCirclePreview() : editing.commitCircle();
    if (activeCommand === 'part.extrude') return features.commitExtrude();
    if (activeCommand === 'part.cutExtrude') return features.commitCut();
    if (activeCommand === 'part.fillet') return features.commitFillet();
    if (creation.dimensionCreation.mode) return creation.dimensionCreation.commit();
    if (activeCommand === 'dimension.edit') return dimensions.commitDimensionEdit();
  }
  return {
    activeWorkspace,setActiveWorkspace,activeCommand,activeSketchId,
    selectedSketchEntityId: selectedEntityId,
    ...constraints,
    ...creation,
    selectionMode: selection.selectionMode,selectedPick: selection.selectedPick,
    selectedBodyId: selection.selectedBodyId,
    sketchPlane: features.sketchPlane,setSketchPlane: features.setSketchPlane,
    rectangleWidth: editing.rectangleWidth,setRectangleWidth: editing.setRectangleWidth,
    rectangleHeight: editing.rectangleHeight,setRectangleHeight: editing.setRectangleHeight,
    circleDiameter: editing.circleDiameter,setCircleDiameter: editing.setCircleDiameter,
    extrudeDistance: features.extrudeDistance,setExtrudeDistance: features.setExtrudeDistance,
    filletRadius: features.filletRadius,setFilletRadius: features.setFilletRadius,
    dimensionEditValue: dimensions.dimensionEditValue,setDimensionEditValue: dimensions.setDimensionEditValue,
    part: features.part,sketch,rectangleReady: features.rectangleReady,circleReady: features.circleReady,
    hasSolid: features.hasSolid,canExtrude: features.canExtrude,canCut: features.canCut,canFillet: features.canFillet,
    selectedPointText: selection.selectedPointText,selectedBody: selection.selectedBody,
    clearTransientSelection: selection.clearTransientSelection,clearSelectedPick: selection.clearSelectedPick,
    clearSketchEntitySelection: clearEntitySelection,...navigation,
    handleViewportPick: selection.handleViewportPick,handleBodySelect: selection.handleBodySelect,
    handleSketchEntitySelect: selection.handleSketchEntitySelect,
    deleteSelectedSketchEntity: entityMutations.deleteSelectedSketchEntity,
    toggleSelectedConstruction: entityMutations.toggleSelectedConstruction,
    translateSketchEntity: entityMutations.translateSketchEntity,
    beginLine: editing.beginLine,
    lineDraft: editing.lineDraft,lineCommitting: editing.lineCommitting,
    handleSketchLinePointMove: editing.handleSketchLinePointMove,handleSketchLinePoint: editing.handleSketchLinePoint,
    rectangleDraft: editing.rectangleDraft,rectangleCommitting: editing.rectangleCommitting,
    handleSketchRectanglePointMove: editing.handleSketchRectanglePointMove,handleSketchRectanglePoint: editing.handleSketchRectanglePoint,
    circleDraft: editing.circleDraft,circleCommitting: editing.circleCommitting,
    handleSketchCirclePointMove: editing.handleSketchCirclePointMove,handleSketchCirclePoint: editing.handleSketchCirclePoint,
    beginArc: editing.beginArc,arcDraft: editing.arcDraft,arcCommitting: editing.arcCommitting,
    handleSketchArcPointMove: editing.handleSketchArcPointMove,handleSketchArcPoint: editing.handleSketchArcPoint,
    beginCreateSketch: features.beginCreateSketch,commitCreateSketch: features.commitCreateSketch,
    beginRectangle: editing.beginRectangle,commitRectangle: editing.commitRectangle,
    beginCircle: editing.beginCircle,commitCircle: editing.commitCircle,finishSketch: editing.finishSketch,
    beginExtrude: features.beginExtrude,commitExtrude: features.commitExtrude,
    beginCut: features.beginCut,commitCut: features.commitCut,
    beginFillet: features.beginFillet,commitFillet: features.commitFillet,
    beginDimensionEdit: dimensions.beginDimensionEdit,commitDimensionEdit: dimensions.commitDimensionEdit,
    cancelCommand,commitActiveCommand,
  };
}
