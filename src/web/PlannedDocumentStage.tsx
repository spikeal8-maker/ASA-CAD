import React from 'react';
import type { CadDocumentKind } from '../contracts/document';
import {
  documentDescriptions,
  documentKindIcon,
  documentNames,
} from './CadDocumentPresentation';

export function PlannedDocumentStage(props: { kind: CadDocumentKind }) {
  return (
    <div className="stage-message">
      <div className="stage-symbol">{documentKindIcon(props.kind)}</div>
      <strong>{documentNames[props.kind]}</strong>
      <span>{documentDescriptions[props.kind]}</span>
      <small>Каркас маршрута готов; функциональный редактор включается на соответствующем milestone.</small>
    </div>
  );
}
