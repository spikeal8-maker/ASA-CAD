import React from 'react';
import type { CadPlaneName } from '../contracts/commands';
import type { CadPartDocument, CadSketch } from '../contracts/document';
import type { CadBodyId } from '../contracts/ids';
import type { CadRenderModel, CadViewportPick } from '../contracts/render';
import {
  CadViewport,
  type CadViewportViewCommand,
} from './CadViewport';
import {
  SketchEditingStage,
  type SketchEditingStageProps,
} from './SketchEditingStage';
import { PartEmptyWorkArea } from './PartEmptyWorkArea';

export interface PartModelStageProps extends Omit<SketchEditingStageProps, 'activeSketch'> {
  activeSketch: Readonly<CadSketch> | null;
  activeWorkspace: string;
  renderModel: CadRenderModel | null;
  runtimeStatus: string;
  fixtureError?: string;
  rectangleReady: boolean;
  selectionMode: 'none' | 'face' | 'edge';
  onPick(pick: CadViewportPick): void;
  viewCommand: CadViewportViewCommand;
  selectedBodyId: CadBodyId | null;
  onBodySelect(bodyId: CadBodyId | null): void;
  selectedPlane: CadPlaneName;
  onPlaneSelect(plane: CadPlaneName): void;
}

/**
 * Part work-area mode coordinator.
 *
 * Solid/B-Rep presentation stays here. Active Sketch presentation is delegated
 * wholesale to SketchEditingStage so future drag/snap/constraint UI does not
 * add branches or direct dependencies to this owner.
 */
export function PartModelStage(props: PartModelStageProps) {
  if (props.activeWorkspace === 'sketch' && props.activeSketch) {
    return <SketchEditingStage {...props} activeSketch={props.activeSketch} />;
  }

  if (!props.renderModel) {
    return (
      <PartEmptyWorkArea
        selectedPlane={props.selectedPlane}
        onSelectPlane={props.onPlaneSelect}
        fixtureError={props.fixtureError}
        sketchCount={props.document.sketches.length}
      />
    );
  }

  return (
    <div
      className="part-model-stage"
      data-testid="part-model-stage"
      data-sketch-context="model"
      data-sketch-support=""
      data-sketch-projection=""
      data-model-context-ready="true"
      data-sketch-view-span=""
      data-sketch-view-center=""
      data-selected-sketch-entity-id=""
    >
      <div className="origin-widget" aria-label="Ориентация">
        <span className="axis-z">Z</span><span className="axis-x">X</span><span className="axis-y">Y</span>
      </div>
      <div className="stage-grid" />
      <CadViewport
        model={props.renderModel}
        selectionMode={props.selectionMode}
        onPick={props.onPick}
        viewCommand={props.viewCommand}
        selectedBodyId={props.selectedBodyId}
        onBodySelect={props.onBodySelect}
      />
    </div>
  );
}
