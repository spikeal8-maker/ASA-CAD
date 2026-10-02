import React from 'react';
import type { CadDrawingDocument } from '../contracts/document';
import type { CadDraftEntityId } from '../contracts/ids';
import { CadIcon } from './CadIcon';

export function DrawingTree(props: {
  document: Readonly<CadDrawingDocument>;
  selectedEntityId: CadDraftEntityId | null;
  onSelectEntity(id: CadDraftEntityId): void;
}) {
  const sheet = props.document.sheets[0];
  const layer = sheet?.layers.find((item) => item.id === sheet.activeLayerId);
  return (
    <div className="tree-panel drawing-tree" data-testid="drawing-tree">
      <div className="panel-title-row"><strong>Дерево чертежа</strong></div>
      <div className="tree-root">
        <div className="tree-row bold" style={{ paddingInlineStart: 10 }}>
          <span className="tree-chevron" />
          <span className="tree-icon"><CadIcon name="drawing" size={15} /></span>
          <span className="tree-label">{props.document.title}</span>
        </div>
        {sheet && (
          <>
            <div className="tree-row bold" style={{ paddingInlineStart: 28 }} data-drawing-sheet-id={sheet.id}>
              <span className="tree-chevron" />
              <span className="tree-icon">▱</span>
              <span className="tree-label">{sheet.name} · {sheet.format}</span>
            </div>
            <div className="tree-row muted" style={{ paddingInlineStart: 46 }} data-drawing-view="system">
              <span className="tree-chevron" />
              <span className="tree-icon">⌖</span>
              <span className="tree-label">Системный вид · 1:{sheet.scale}</span>
            </div>
            <div className="tree-row" style={{ paddingInlineStart: 46 }} data-drawing-layer-id={layer?.id ?? ''}>
              <span className="tree-chevron" />
              <span className="tree-icon">▤</span>
              <span className="tree-label">{layer?.name ?? 'Слой'}</span>
            </div>
            {sheet.entities.map((entity, index) => (
              <button
                key={entity.id}
                type="button"
                className={'tree-row interactive' + (props.selectedEntityId === entity.id ? ' selected' : '')}
                style={{ paddingInlineStart: 64 }}
                data-drawing-tree-entity-id={entity.id}
                onClick={() => props.onSelectEntity(entity.id)}
              >
                <span className="tree-chevron" />
                <span className="tree-icon">╱</span>
                <span className="tree-label">Отрезок {index + 1}</span>
              </button>
            ))}
          </>
        )}
      </div>
    </div>
  );
}
