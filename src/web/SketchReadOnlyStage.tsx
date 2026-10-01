import React, { useState } from 'react';
import type { CadPartDocument, CadSketch } from '../contracts/document';
import type { CadSketchEntityId } from '../contracts/ids';
import { CadViewport } from './CadViewport';
import { dimensionLabel, dimensionUnit } from './SketchDimensionPresentation';
import { SketchSolveStatus } from './SketchSolveStatus';
import { SketchSelectionLayer } from './viewport/SketchSelectionLayer';
import { useActiveSketchSolveOverlay } from './useActiveSketchSolveOverlay';
import { SketchViewportFrameProvider } from './viewport/SketchViewportFrameContext';
import { resetSketchViewportState, sketchDisplayFrame } from './viewport/SketchViewportGeometry';
import { resolveSketchWorkplaneProjection } from './viewport/SketchWorkplaneProjection';

export interface SketchReadOnlyStageProps {
  document: Readonly<CadPartDocument>;
  sketch: Readonly<CadSketch>;
  revisionToken: number;
}

/** Read-only presentation of one persisted Sketch outside an edit-session. */
export function SketchReadOnlyStage({ document, sketch, revisionToken }: SketchReadOnlyStageProps) {
  const [selectedEntityId, setSelectedEntityId] = useState<CadSketchEntityId | null>(null);
  const projection = resolveSketchWorkplaneProjection(sketch.support);
  const viewport = resetSketchViewportState();
  const frame = sketchDisplayFrame(viewport);
  const solve = useActiveSketchSolveOverlay({
    document,
    sketch,
    active: true,
    revisionToken,
  });
  const dimensions = document.dimensions.filter((item) => sketch.dimensionIds.includes(item.id));

  return (
    <SketchViewportFrameProvider frame={frame}>
      <div
        className="part-model-stage"
        data-testid="part-model-stage"
        data-sketch-context="read-only"
        data-sketch-id={sketch.id}
        data-sketch-support={sketch.support}
        data-sketch-projection={projection?.kind ?? ''}
        data-model-context-ready={projection?.modelContextReady ? 'true' : 'false'}
        data-sketch-view-span={viewport.span}
        data-sketch-view-center={viewport.center.join(',')}
        data-selected-sketch-entity-id={selectedEntityId ?? ''}
      >
        <div className="origin-widget" aria-label="Ориентация">
          <span className="axis-z">Z</span>
          <span className="axis-x">X</span>
          <span className="axis-y">Y</span>
        </div>
        <div className="stage-grid" />
        <CadViewport model={null} sketchOverlay={solve.overlay} />
        <SketchSelectionLayer
          model={solve.overlay}
          enabled
          selectedEntityId={selectedEntityId}
          onEntitySelect={setSelectedEntityId}
        />
        <div className="sketch-solve-hud" data-testid="sketch-readonly-hud">
          <strong>{sketch.name}</strong>
          <span data-testid="sketch-readonly-support">Опора: {sketch.support}</span>
          {dimensions.map((dimension) => (
            <span key={dimension.id} data-dimension-id={dimension.id}>
              {dimensionLabel(dimension.name, dimension.type)}: {dimension.value} {dimensionUnit(dimension.type)}
            </span>
          ))}
          <SketchSolveStatus snapshot={solve.snapshot} />
          <span>Только просмотр</span>
        </div>
      </div>
    </SketchViewportFrameProvider>
  );
}
