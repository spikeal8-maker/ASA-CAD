import React from 'react';
import type { CadPlaneName } from '../contracts/commands';
import type { CadSketch } from '../contracts/document';
import type { CadBodyId } from '../contracts/ids';
import type { CadRenderModel, CadViewportPick } from '../contracts/render';
import { CadViewport, type CadViewportViewCommand } from './CadViewport';
import { PartStageStatus } from './PartStageStatus';
import { SketchEditingStage, type SketchEditingStageProps } from './SketchEditingStage';

export interface PartModelStageProps extends Omit<SketchEditingStageProps, 'activeSketch'> {
  activeSketch: Readonly<CadSketch> | null;
  activeWorkspace: string;
  renderModel: CadRenderModel | null;
  runtimeStatus: string;
  fixtureError?: string;
  selectionMode: 'none' | 'face' | 'edge';
  onPick(pick: CadViewportPick): void;
  viewCommand: CadViewportViewCommand;
  selectedBodyId: CadBodyId | null;
  onBodySelect(bodyId: CadBodyId | null): void;
  selectedPlane: CadPlaneName | null;
  onPlaneSelect(plane: CadPlaneName): void;
}

/**
 * Part work-area mode coordinator.
 *
 * One persistent spatial scene: document origin planes always, B-Rep when
 * built. Active Sketch presentation is delegated wholesale to
 * SketchEditingStage so Sketch UI does not add branches to this owner.
 */
export function PartModelStage(props: PartModelStageProps) {
  if (props.activeWorkspace === 'sketch' && props.activeSketch) {
    return <SketchEditingStage {...props} activeSketch={props.activeSketch} />;
  }

  return (
    <div
      className="part-model-stage"
      data-testid="part-model-stage"
      data-workarea-kind={props.renderModel ? 'part-model' : 'part-empty'}
      data-selected-base-plane={props.selectedPlane ?? ''}
      data-sketch-context="model"
      data-sketch-support=""
      data-sketch-projection=""
      data-model-context-ready="false"
      data-sketch-view-span=""
      data-sketch-view-center=""
      data-selected-sketch-entity-id=""
    >
      <div className="origin-widget" aria-label="Ориентация">
        <span className="axis-z">Z</span>
        <span className="axis-x">X</span>
        <span className="axis-y">Y</span>
      </div>
      <div className="stage-grid" />
      <CadViewport
        model={props.renderModel}
        selectionMode={props.selectionMode}
        onPick={props.onPick}
        viewCommand={props.viewCommand}
        selectedBodyId={props.selectedBodyId}
        onBodySelect={props.onBodySelect}
        referencePlanes={props.document.origin.planes}
        selectedPlane={props.selectedPlane}
        onPlaneSelect={props.onPlaneSelect}
      />
      <PartStageStatus runtimeStatus={props.runtimeStatus} fixtureError={props.fixtureError} />
    </div>
  );
}
