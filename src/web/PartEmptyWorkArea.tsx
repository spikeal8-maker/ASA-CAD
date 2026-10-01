import React from 'react';
import type { CadPlaneName } from '../contracts/commands';

export interface PartEmptyWorkAreaProps {
  selectedPlane: CadPlaneName;
  onSelectPlane(plane: CadPlaneName): void;
  fixtureError?: string;
  sketchCount: number;
}

const planes: Array<{ id: CadPlaneName; points: string; labelX: number; labelY: number }> = [
  { id: 'XY', points: '160,230 360,150 520,220 320,302', labelX: 338, labelY: 234 },
  { id: 'XZ', points: '160,230 320,302 320,112 160,42', labelX: 244, labelY: 171 },
  { id: 'YZ', points: '320,302 520,220 520,30 320,112', labelX: 422, labelY: 165 },
];

export function PartEmptyWorkArea(props: PartEmptyWorkAreaProps) {
  return (
    <div
      className="part-model-stage part-empty-workarea"
      data-testid="part-model-stage"
      data-workarea-kind="part-empty"
      data-selected-base-plane={props.selectedPlane}
      data-sketch-context="model"
      data-model-context-ready="true"
      data-sketch-support=""
      data-sketch-projection=""
      data-sketch-view-span=""
      data-sketch-view-center=""
      data-selected-sketch-entity-id=""
    >
      <div className="stage-grid" />
      <svg
        className="part-reference-scene"
        viewBox="0 0 680 360"
        preserveAspectRatio="xMidYMid meet"
        role="radiogroup"
        aria-label="Базовые плоскости детали"
      >
        <g className="part-reference-axes" aria-hidden="true">
          <line x1="320" y1="208" x2="548" y2="278" />
          <line x1="320" y1="208" x2="112" y2="292" />
          <line x1="320" y1="208" x2="320" y2="20" />
          <text x="557" y="285">X</text>
          <text x="98" y="304">Y</text>
          <text x="326" y="20">Z</text>
          <circle cx="320" cy="208" r="4" />
        </g>
        {planes.map((plane) => (
          <g
            key={plane.id}
            className={'part-base-plane' + (props.selectedPlane === plane.id ? ' selected' : '')}
            data-plane-id={plane.id}
            role="radio"
            tabIndex={0}
            aria-checked={props.selectedPlane === plane.id}
            aria-label={'Плоскость ' + plane.id}
            onClick={() => props.onSelectPlane(plane.id)}
            onKeyDown={(event) => {
              if (event.key !== 'Enter' && event.key !== ' ') return;
              event.preventDefault();
              props.onSelectPlane(plane.id);
            }}
          >
            <polygon points={plane.points} />
            <text x={plane.labelX} y={plane.labelY}>{plane.id}</text>
          </g>
        ))}
      </svg>
      <div className="part-workarea-hud">
        <strong>{props.fixtureError ? 'Ошибка перестроения' : 'Рабочая область детали'}</strong>
        <span>Опора эскиза: <b>{props.selectedPlane}</b></span>
        <span>{props.sketchCount ? 'Эскизы: ' + props.sketchCount : 'Выберите плоскость в сцене или дереве'}</span>
        {props.fixtureError && <small>{props.fixtureError}</small>}
      </div>
      <div className="origin-widget" aria-label="Ориентация">
        <span className="axis-z">Z</span>
        <span className="axis-x">X</span>
        <span className="axis-y">Y</span>
      </div>
    </div>
  );
}
