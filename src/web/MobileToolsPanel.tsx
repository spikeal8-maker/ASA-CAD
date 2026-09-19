import React from 'react';
import type { CadDocumentKind } from '../contracts/document';
import type { CadUiAction } from './CadUiAction';

interface MobileToolSpec {
  id: string;
  symbol: string;
}

const SOLID_TOOLS: readonly MobileToolSpec[] = [
  { id: 'part.sketch.create', symbol: '▱' },
  { id: 'part.extrude', symbol: '▤' },
  { id: 'part.cutExtrude', symbol: '▣' },
  { id: 'part.fillet', symbol: '◜' },
  { id: 'system.rebuild', symbol: '↻' },
];

const SKETCH_TOOLS: readonly MobileToolSpec[] = [
  { id: 'sketch.line', symbol: '╱' },
  { id: 'sketch.rectangle', symbol: '▭' },
  { id: 'sketch.circle', symbol: '○' },
  { id: 'sketch.arc', symbol: '⌒' },
  { id: 'sketch.construction', symbol: '⋯' },
  { id: 'constraint.horizontal', symbol: '—' },
  { id: 'constraint.vertical', symbol: '|' },
  { id: 'constraint.fixed', symbol: '⌾' },
  { id: 'constraint.coincident', symbol: '●' },
  { id: 'constraint.parallel', symbol: '∥' },
  { id: 'constraint.perpendicular', symbol: '⊥' },
  { id: 'constraint.tangent', symbol: '∿' },
  { id: 'constraint.concentric', symbol: '◎' },
  { id: 'constraint.equal', symbol: '=' },
  { id: 'constraint.symmetric', symbol: '↔' },
  { id: 'constraint.pointOnCurve', symbol: '⌖' },
  { id: 'dimension.linear', symbol: '⟷' },
  { id: 'dimension.horizontal', symbol: '↔' },
  { id: 'dimension.vertical', symbol: '↕' },
  { id: 'dimension.diameter', symbol: 'Ø' },
  { id: 'dimension.radius', symbol: 'R' },
  { id: 'dimension.angular', symbol: '∠' },
  { id: 'sketch.entity.delete', symbol: '⌫' },
  { id: 'sketch.finish', symbol: '✓' },
];

const VIEW_TOOLS: readonly MobileToolSpec[] = [
  { id: 'view.fit', symbol: '⌗' },
  { id: 'view.front', symbol: '◇' },
  { id: 'view.top', symbol: '◇' },
  { id: 'view.left', symbol: '◇' },
  { id: 'view.iso', symbol: '◇' },
];

const DOCUMENT_TOOLS: readonly MobileToolSpec[] = [
  { id: 'system.open', symbol: '⌂' },
  { id: 'system.save', symbol: '▣' },
  { id: 'system.undo', symbol: '↶' },
  { id: 'system.redo', symbol: '↷' },
];

function workspaceTools(documentKind: CadDocumentKind, workspace: string): readonly MobileToolSpec[] {
  if (documentKind !== 'part') return [];
  if (workspace === 'sketch') return SKETCH_TOOLS;
  if (workspace === 'view') return VIEW_TOOLS;
  return SOLID_TOOLS;
}

/** Phone/tablet presentation over the same CadUiAction objects as desktop. */
export function MobileToolsPanel(props: {
  documentKind: CadDocumentKind;
  workspace: string;
  getAction(id: string): CadUiAction;
}) {
  const primary = workspaceTools(props.documentKind, props.workspace);
  return (
    <div className="parameter-panel mobile-tools-panel" data-mobile-tools="true">
      <div className="panel-title-row">
        <div>
          <small>{props.documentKind === 'part' ? props.workspace : props.documentKind}</small>
          <strong>Инструменты</strong>
        </div>
      </div>

      {primary.length > 0 ? (
        <section className="parameter-section">
          <h3>Текущий режим</h3>
          <div className="mobile-tools-grid">
            {primary.map((tool) => (
              <MobileActionButton key={tool.id} action={props.getAction(tool.id)} symbol={tool.symbol} />
            ))}
          </div>
        </section>
      ) : (
        <section className="parameter-section">
          <p>Команды этого типа документа включатся на соответствующем milestone.</p>
        </section>
      )}

      <section className="parameter-section">
        <h3>Документ</h3>
        <div className="mobile-tools-grid compact">
          {DOCUMENT_TOOLS.map((tool) => (
            <MobileActionButton key={tool.id} action={props.getAction(tool.id)} symbol={tool.symbol} />
          ))}
        </div>
      </section>
    </div>
  );
}

function MobileActionButton(props: { action: CadUiAction; symbol: string }) {
  const { action } = props;
  return (
    <button
      className="mobile-tool-action"
      type="button"
      disabled={!action.enabled}
      title={!action.enabled ? `${action.label}: ${action.disabledReason ?? 'Недоступно'}` : action.label}
      data-command-id={action.id}
      onClick={() => { void action.execute(); }}
    >
      <span className="mobile-tool-symbol" aria-hidden="true">{props.symbol}</span>
      <span className="mobile-tool-label">{action.label}</span>
      {!action.enabled && action.disabledReason && <small>{action.disabledReason}</small>}
    </button>
  );
}
