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
import type {CadWorkspacePanel, Workspace} from './PartSketchWorkspaceTypes';
import {usePartWorkspaceNavigation} from './usePartWorkspaceNavigation';
import {useEditorMode} from './EditorMode';
import {cancelCmd,dispatchCmd,gateAll,sketchGate} from './SketchWorkspaceMutationBindings';
export interface PartSketchWorkspaceOptions {
  app: CadApplication; document: Readonly<CadDocument>; renderModelAvailable: boolean;
  setPanel(panel: CadWorkspacePanel): void; setNotice(message: string): void;
}
export function usePartSketchWorkspace(options: PartSketchWorkspaceOptions) {
  const { app,document,renderModelAvailable,setPanel,setNotice }=options;
  const [activeWorkspace,setActiveWorkspace]=useState<Workspace>('solid');
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
    app,document,renderModelAvailable,activeSketchId,sketch: featureSketch,
    selectedPick: selection.selectedPick,selectedPlane: selection.selectedPlane,
    selectBasePlane: selection.selectBasePlane,setActiveCommand,setActiveWorkspace,
    setPanel,setNotice,activateSketch,beginPartSelection: selection.beginPartSelection,
    clearTransientSelection: selection.clearTransientSelection,
  });
  const navigation=usePartWorkspaceNavigation({
    app,setActiveCommand,setActiveWorkspace,setPanel,setNotice,
    activateSketch,clearActiveSketch,clearTransientSelection: selection.clearTransientSelection,
    clearDimensionEdit: dimensions.clearDimensionEdit,
  });
  // A05 v2 gate: KOMPAS passes through; Fusion fails closed without live camera registration at call time.
  const gate=sketchGate({fusionActive:useEditorMode()==='fusion',documentId:document.documentId,sketchId:activeSketchId,reject:setNotice});
  function cancelCommand(){
    cancelCmd({activeCommand,dimensionCreationMode:creation.dimensionCreation.mode,
      cancelDimensionCreation:creation.dimensionCreation.cancel,resetActiveTool:editing.resetActiveTool,
      resetExtrude:features.extrude.reset,clearDimensionEdit:dimensions.clearDimensionEdit,
      clearTransientSelection:selection.clearTransientSelection,setActiveCommand,setPanel,setActiveWorkspace,
      notice:setNotice,documentKind:document.kind});
  }
  const commitActiveCommand=()=>dispatchCmd(gate,{activeCommand,commitLinePreview:editing.commitLinePreview,
    commitArcPreview:editing.commitArcPreview,commitCreateSketch:features.commitCreateSketch,
    commitRectanglePreview:editing.commitRectanglePreview,commitRectangle:editing.commitRectangle,
    commitCirclePreview:editing.commitCirclePreview,commitCircle:editing.commitCircle,
    hasRectangleDraft:editing.hasRectangleDraft,hasCircleDraft:editing.hasCircleDraft,
    commitExtrude:features.extrude.commit,commitCut:features.commitCut,commitFillet:features.commitFillet,
    dimensionCreationMode:creation.dimensionCreation.mode,commitDimensionCreation:creation.dimensionCreation.commit,
    commitDimensionEdit:dimensions.commitDimensionEdit});
  return {
    ...editing,...features,
    activeWorkspace,setActiveWorkspace,activeCommand,activeSketchId,
    selectedSketchEntityId: selectedEntityId,
    ...constraints,
    ...creation,
    selectionMode: selection.selectionMode,selectedPick: selection.selectedPick,
    selectedBodyId: selection.selectedBodyId,
    selectedPlane: selection.selectedPlane,selectBasePlane: selection.selectBasePlane,
    dimensionEditValue: dimensions.dimensionEditValue,setDimensionEditValue: dimensions.setDimensionEditValue,
    sketch,
    selectedPointText: selection.selectedPointText,selectedBody: selection.selectedBody,
    clearTransientSelection: selection.clearTransientSelection,clearSelectedPick: selection.clearSelectedPick,
    clearSketchEntitySelection: clearEntitySelection,...navigation,
    handleViewportPick: selection.handleViewportPick,handleBodySelect: selection.handleBodySelect,
    handleSketchEntitySelect: selection.handleSketchEntitySelect,
    deleteSelectedSketchEntity: entityMutations.deleteSelectedSketchEntity,
    toggleSelectedConstruction: entityMutations.toggleSelectedConstruction,
    translateSketchEntity: entityMutations.translateSketchEntity,
    beginDimensionEdit: dimensions.beginDimensionEdit,commitDimensionEdit: dimensions.commitDimensionEdit,
    ...gateAll(gate,editing,constraints,entityMutations,dimensions,creation),
    cancelCommand,commitActiveCommand,
  };
}
