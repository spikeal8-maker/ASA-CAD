import React from 'react';
import type { CadDocument } from '../contracts/document';
import type { CadRenderModel } from '../contracts/render';
import type { CadViewportViewCommand } from './CadViewport';
import { CadShellMain, type CadShellPanel } from './CadShellMain';
import { CoincidentPartStage } from './CoincidentPartModelStage';
import { DocumentTree } from './DocumentTree';
import { DrawingParameterPanel } from './DrawingParameterPanel';
import { DrawingStage } from './DrawingStage';
import { DrawingTree } from './DrawingTree';
import { MobileToolsPanel } from './MobileToolsPanel';
import { ParameterPanel } from './ParameterPanel';
import { PlannedDocumentStage } from './PlannedDocumentStage';
import type { CadUiAction } from './CadUiAction';
import type { usePartSketchWorkspace } from './usePartSketchWorkspace';
import type { DrawingWorkspace } from './useDrawingWorkspace';

type PartWorkspace = ReturnType<typeof usePartSketchWorkspace>;

export interface CadWorkspaceContentProps {
  document: Readonly<CadDocument>;
  activePanel: CadShellPanel;
  setActivePanel(panel: CadShellPanel): void;
  requestView(label: string): void;
  viewName: string;
  getAction(id: string): CadUiAction;
  part: PartWorkspace;
  drawing: DrawingWorkspace;
  revisionToken: number;
  renderModel: CadRenderModel | null;
  runtimeStatus: string;
  fixtureError?: string;
  viewCommand: CadViewportViewCommand;
  onNotice(message: string): void;
}

export function CadWorkspaceContent(props: CadWorkspaceContentProps) {
  const p = props.part;
  const d = props.drawing;
  const drawingMode = props.document.kind === 'drawing';
  const activeCommand = drawingMode ? d.activeCommand : p.activeCommand;
  const commitActiveCommand = drawingMode ? d.commitActiveCommand : p.commitActiveCommand;
  const cancelCommand = drawingMode ? d.cancelCommand : p.cancelCommand;

  const treeContent = drawingMode && d.drawing ? (
    <DrawingTree
      document={d.drawing}
      selectedEntityId={d.selectedEntityId}
      onSelectEntity={d.selectEntity}
    />
  ) : (
    <DocumentTree
      document={props.document as CadDocument}
      selectedBodyId={p.selectedBodyId}
      activeSketchId={p.activeSketchId}
      onSelectBody={p.handleBodySelect}
      onEditSketch={p.enterSketch}
      onEditDimension={p.beginDimensionEdit}
      selectedPlane={p.sketchPlane}
      onSelectPlane={p.setSketchPlane}
    />
  );

  const parametersContent = drawingMode ? (
    <DrawingParameterPanel workspace={d} />
  ) : (
    <ParameterPanel
      activeCommand={p.activeCommand}
      requiresFaceSelection={p.hasSolid && p.activeCommand === 'part.sketch.create'}
      selectedPick={p.selectedPick}
      sketchPlane={p.sketchPlane}
      setSketchPlane={p.setSketchPlane}
      rectangleWidth={p.rectangleWidth}
      rectangleHeight={p.rectangleHeight}
      setRectangleWidth={p.setRectangleWidth}
      setRectangleHeight={p.setRectangleHeight}
      circleDiameter={p.circleDiameter}
      setCircleDiameter={p.setCircleDiameter}
      extrude={p.extrude}
      filletRadius={p.filletRadius}
      setFilletRadius={p.setFilletRadius}
      dimensionEditValue={p.dimensionEditValue}
      setDimensionEditValue={p.setDimensionEditValue}
      dimensionCreation={p.dimensionCreation}
      onCreateSketch={p.commitCreateSketch}
      onCreateRectangle={p.commitRectangle}
      onCreateCircle={p.commitCircle}
      onCut={p.commitCut}
      onFillet={p.commitFillet}
      onDimensionEdit={p.commitDimensionEdit}
      onCancel={p.cancelCommand}
    />
  );

  const modelContent = props.document.kind === 'part' ? (
    <CoincidentPartStage
      document={props.document}
      activeSketch={p.sketch}
      activeWorkspace={p.activeWorkspace}
      activeCommand={p.activeCommand}
      revisionToken={props.revisionToken}
      renderModel={props.renderModel}
      runtimeStatus={props.runtimeStatus}
      fixtureError={props.fixtureError}
      rectangleReady={p.rectangleReady}
      selectionMode={p.selectionMode}
      onPick={p.handleViewportPick}
      viewCommand={props.viewCommand}
      selectedBodyId={p.selectedBodyId}
      onBodySelect={p.handleBodySelect}
      selectedPlane={p.sketchPlane}
      onPlaneSelect={p.setSketchPlane}
      selectedSketchEntityId={p.selectedSketchEntityId}
      onSketchEntitySelect={p.handleSketchEntitySelect}
      onSketchEntityTranslate={p.translateSketchEntity}
      onSketchDragRejected={props.onNotice}
      lineDraft={p.lineDraft}
      lineCommitting={p.lineCommitting}
      onSketchLinePointMove={p.handleSketchLinePointMove}
      onSketchLinePoint={p.handleSketchLinePoint}
      rectangleDraft={p.rectangleDraft}
      rectangleCommitting={p.rectangleCommitting}
      onSketchRectanglePointMove={p.handleSketchRectanglePointMove}
      onSketchRectanglePoint={p.handleSketchRectanglePoint}
      circleDraft={p.circleDraft}
      circleCommitting={p.circleCommitting}
      onSketchCirclePointMove={p.handleSketchCirclePointMove}
      onSketchCirclePoint={p.handleSketchCirclePoint}
      arcDraft={p.arcDraft}
      arcCommitting={p.arcCommitting}
      onSketchArcPointMove={p.handleSketchArcPointMove}
      onSketchArcPoint={p.handleSketchArcPoint}
      commit={p.applyCoincidentConstraint}
      parallelCommit={p.applyParallelConstraint}
      perpendicularCommit={p.applyPerpendicularConstraint}
      tangentCommit={p.applyTangentConstraint}
      concentricCommit={p.applyConcentricConstraint}
      equalCommit={p.applyEqualConstraint}
      symmetryCommit={p.applySymmetryConstraint}
      pointOnCurveCommit={p.applyPointOnCurveConstraint}
      angularPair={p.selectAngularDimensionLines}
    />
  ) : drawingMode && d.sheet ? (
    <DrawingStage
      sheet={d.sheet}
      activeCommand={d.activeCommand}
      selectedEntityId={d.selectedEntityId}
      lineDraft={d.lineDraft}
      committing={d.committing}
      viewCommand={props.viewCommand}
      onLineMove={d.moveLinePoint}
      onLinePoint={d.linePoint}
      onSelectEntity={d.selectEntity}
    />
  ) : (
    <PlannedDocumentStage kind={props.document.kind} />
  );

  return (
    <CadShellMain
      documentKind={props.document.kind}
      activePanel={props.activePanel}
      setActivePanel={props.setActivePanel}
      requestView={props.requestView}
      viewName={drawingMode ? 'Лист A4' : props.viewName}
      selectionMode={drawingMode ? 'none' : p.selectionMode}
      selectedBodyName={drawingMode ? undefined : p.selectedBody?.name}
      selectedSketchEntityId={drawingMode ? null : p.selectedSketchEntityId}
      selectedDrawingEntityId={drawingMode ? d.selectedEntityId : null}
      activeCommand={activeCommand}
      commitActiveCommand={commitActiveCommand}
      cancelCommand={cancelCommand}
      treeContent={treeContent}
      parametersContent={parametersContent}
      toolsContent={
        <MobileToolsPanel
          documentKind={props.document.kind}
          workspace={drawingMode ? 'draft' : p.activeWorkspace}
          getAction={props.getAction}
        />
      }
      modelContent={modelContent}
    />
  );
}
