import React, { useEffect, useMemo, useState } from 'react';
import type { CadDrawingSheet, CadPoint2 } from '../contracts/document';
import type { CadDraftEntityId } from '../contracts/ids';
import type { CadViewportViewCommand } from './CadViewport';
import type { DrawingLineDraft } from './useDrawingWorkspace';
import { SketchInteractionSurface } from './viewport/SketchInteractionSurface';
import {
  sketchDisplayFrame,
  zoomSketchViewport,
  type SketchViewportState,
} from './viewport/SketchViewportGeometry';

export interface DrawingStageProps {
  sheet: Readonly<CadDrawingSheet>;
  activeCommand: string | null;
  selectedEntityId: CadDraftEntityId | null;
  lineDraft: DrawingLineDraft;
  committing: boolean;
  viewCommand: CadViewportViewCommand;
  onLineMove(point: CadPoint2): void;
  onLinePoint(point: CadPoint2): void | Promise<void>;
  onSelectEntity(id: CadDraftEntityId): void;
}

export function DrawingStage(props: DrawingStageProps) {
  const [viewport, setViewport] = useState<SketchViewportState>(() => defaultViewport(props.sheet));
  useEffect(() => setViewport(defaultViewport(props.sheet)), [props.sheet.id]);
  useEffect(() => {
    if (props.viewCommand.sequence === 0) return;
    const view = props.viewCommand.view;
    setViewport((current) => {
      if (view === 'fit') return defaultViewport(props.sheet);
      if (view === 'zoom-in') return zoomSketchViewport(current, 0.8, current.center);
      if (view === 'zoom-out') return zoomSketchViewport(current, 1.25, current.center);
      const step = current.span * 0.08;
      if (view === 'pan-left') return { ...current, center: [current.center[0] - step, current.center[1]] };
      if (view === 'pan-right') return { ...current, center: [current.center[0] + step, current.center[1]] };
      if (view === 'pan-up') return { ...current, center: [current.center[0], current.center[1] + step] };
      if (view === 'pan-down') return { ...current, center: [current.center[0], current.center[1] - step] };
      return current;
    });
  }, [props.sheet, props.viewCommand.sequence, props.viewCommand.view]);

  const frame = useMemo(() => sketchDisplayFrame(viewport), [viewport]);
  const lineActive = props.activeCommand === 'draft.line';
  const selectionEnabled = props.activeCommand === null;
  const pointInsideSheet = (point: CadPoint2) => (
    point[0] >= 0 && point[0] <= props.sheet.width
    && point[1] >= 0 && point[1] <= props.sheet.height
  );

  return (
    <div
      className="drawing-stage"
      data-testid="drawing-stage"
      data-sheet-id={props.sheet.id}
      data-sheet-format={props.sheet.format}
      data-sheet-width={props.sheet.width}
      data-sheet-height={props.sheet.height}
      data-drawing-view-span={viewport.span}
      data-drawing-view-center={viewport.center.join(',')}
      data-selected-drawing-entity-id={props.selectedEntityId ?? ''}
    >
      <div className="stage-grid" />
      <SketchInteractionSurface
        frame={frame}
        viewportState={viewport}
        onViewportStateChange={setViewport}
        active
        committing={props.committing}
        tool={lineActive ? 'draft.line' : 'drawing.navigate'}
        ariaLabel="Лист чертежа"
        dataAttributes={{ 'data-drawing-line-active': lineActive ? 'true' : 'false' }}
        onPointMove={(point) => { if (lineActive && pointInsideSheet(point)) props.onLineMove(point); }}
        onPoint={(point) => { if (lineActive && pointInsideSheet(point)) return props.onLinePoint(point); }}
      >
        <rect
          className="drawing-sheet-paper"
          data-testid="drawing-sheet-paper"
          x={0}
          y={-props.sheet.height}
          width={props.sheet.width}
          height={props.sheet.height}
        />
        <g className="drawing-entities" data-testid="drawing-entities">
          {props.sheet.entities.map((entity) => (
            <React.Fragment key={entity.id}>
              <line
                className={'drawing-line' + (props.selectedEntityId === entity.id ? ' selected' : '')}
                data-drawing-entity-id={entity.id}
                data-drawing-length={lineLength(entity.from, entity.to)}
                x1={entity.from[0]}
                y1={-entity.from[1]}
                x2={entity.to[0]}
                y2={-entity.to[1]}
                vectorEffect="non-scaling-stroke"
              />
              {selectionEnabled && (
                <line
                  className="drawing-line-hit"
                  data-drawing-select-id={entity.id}
                  x1={entity.from[0]}
                  y1={-entity.from[1]}
                  x2={entity.to[0]}
                  y2={-entity.to[1]}
                  vectorEffect="non-scaling-stroke"
                  onPointerDown={(event) => { event.preventDefault(); event.stopPropagation(); }}
                  onPointerUp={(event) => {
                    event.preventDefault();
                    event.stopPropagation();
                    props.onSelectEntity(entity.id);
                  }}
                />
              )}
            </React.Fragment>
          ))}
          {lineActive && props.lineDraft.from && props.lineDraft.to && (
            <line
              className="drawing-line-preview"
              data-testid="drawing-line-preview"
              x1={props.lineDraft.from[0]}
              y1={-props.lineDraft.from[1]}
              x2={props.lineDraft.to[0]}
              y2={-props.lineDraft.to[1]}
              vectorEffect="non-scaling-stroke"
            />
          )}
        </g>
      </SketchInteractionSurface>
      <div className="drawing-sheet-caption">
        <strong>{props.sheet.name}</strong>
        <span>{props.sheet.format} · {props.sheet.orientation === 'landscape' ? 'альбомная' : 'книжная'} · 1:{props.sheet.scale}</span>
        <span>мм · {props.sheet.layers.find((layer) => layer.id === props.sheet.activeLayerId)?.name ?? 'Слой'}</span>
      </div>
    </div>
  );
}

function defaultViewport(sheet: Readonly<CadDrawingSheet>): SketchViewportState {
  return {
    center: [sheet.width / 2, sheet.height / 2],
    span: Math.max(sheet.width, sheet.height) * 1.12,
  };
}

function lineLength(from: readonly [number, number], to: readonly [number, number]): string {
  return Number(Math.hypot(to[0] - from[0], to[1] - from[1]).toFixed(6)).toString();
}
