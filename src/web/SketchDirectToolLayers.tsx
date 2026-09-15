import React from 'react';
import type { CadPoint2 } from '../contracts/document';
import type { SketchLineDraft } from './useSketchLineTool';
import type { SketchCircleDraft } from './useSketchCircleTool';
import type { SketchArcDraft } from './useSketchArcTool';
import type { SketchRectangleDraft } from './useSketchRectangleTool';
import { SketchLineInteractionLayer } from './viewport/SketchLineInteractionLayer';
import { SketchCircleInteractionLayer } from './viewport/SketchCircleInteractionLayer';
import { SketchArcInteractionLayer } from './viewport/SketchArcInteractionLayer';
import { SketchRectangleInteractionLayer } from './viewport/SketchRectangleInteractionLayer';
import {
  SketchCoincidentInteractionLayer, SketchParallelInteractionLayer, SketchPerpendicularInteractionLayer,
} from './viewport/SketchCoincidentInteractionLayer';
import { SketchTangentInteractionLayer } from './viewport/SketchTangentInteractionLayer';
import { SketchConcentricInteractionLayer } from './viewport/SketchConcentricInteractionLayer';
import type { SketchOverlayModel } from './viewport/SketchOverlayModel';
import type { SketchDisplayFrame, SketchViewportState } from './viewport/SketchViewportGeometry';

export interface SketchDirectToolLayersProps {
  model: SketchOverlayModel | null;
  frame: SketchDisplayFrame;
  viewportState: SketchViewportState;
  onViewportStateChange: React.Dispatch<React.SetStateAction<SketchViewportState>>;
  activeCommand: string | null;
  lineDraft: SketchLineDraft;
  lineCommitting: boolean;
  onLineMove(point: CadPoint2): void;
  onLinePoint(point: CadPoint2): void | Promise<void>;
  rectangleDraft: SketchRectangleDraft;
  rectangleCommitting: boolean;
  onRectangleMove(point: CadPoint2): void;
  onRectanglePoint(point: CadPoint2): void | Promise<void>;
  circleDraft: SketchCircleDraft;
  circleCommitting: boolean;
  onCircleMove(point: CadPoint2): void;
  onCirclePoint(point: CadPoint2): void | Promise<void>;
  arcDraft: SketchArcDraft;
  arcCommitting: boolean;
  onArcMove(point: CadPoint2): void;
  onArcPoint(point: CadPoint2): void | Promise<void>;
}

/** Presentation-only composition for direct Sketch geometry/constraint tools. */
export function SketchDirectToolLayers(props: SketchDirectToolLayersProps) {
  const common = { model: props.model, frame: props.frame, viewportState: props.viewportState, onViewportStateChange: props.onViewportStateChange };
  return (
    <>
      <SketchLineInteractionLayer {...common} active={props.activeCommand === 'sketch.line'} draft={props.lineDraft} committing={props.lineCommitting} onPointMove={props.onLineMove} onPoint={props.onLinePoint} />
      <SketchRectangleInteractionLayer {...common} active={props.activeCommand === 'sketch.rectangle'} draft={props.rectangleDraft} committing={props.rectangleCommitting} onPointMove={props.onRectangleMove} onPoint={props.onRectanglePoint} />
      <SketchCircleInteractionLayer {...common} active={props.activeCommand === 'sketch.circle'} draft={props.circleDraft} committing={props.circleCommitting} onPointMove={props.onCircleMove} onPoint={props.onCirclePoint} />
      <SketchArcInteractionLayer {...common} active={props.activeCommand === 'sketch.arc'} draft={props.arcDraft} committing={props.arcCommitting} onPointMove={props.onArcMove} onPoint={props.onArcPoint} />
      <SketchCoincidentInteractionLayer {...common} active={props.activeCommand === 'constraint.coincident'} />
      <SketchParallelInteractionLayer {...common} active={props.activeCommand === 'constraint.parallel'} />
      <SketchPerpendicularInteractionLayer {...common} active={props.activeCommand === 'constraint.perpendicular'} />
      <SketchTangentInteractionLayer {...common} active={props.activeCommand === 'constraint.tangent'} />
      <SketchConcentricInteractionLayer {...common} active={props.activeCommand === 'constraint.concentric'} />
    </>
  );
}
