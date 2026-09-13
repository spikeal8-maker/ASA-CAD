import React from 'react';
import type { CadDocumentKind } from '../contracts/document';
import {
  documentDescriptions,
  documentKindIcon,
  documentNames,
} from './CadDocumentPresentation';

export interface NewDocumentDialogProps {
  open: boolean;
  onClose: () => void;
  onCreate: (kind: CadDocumentKind) => void | Promise<void>;
}

export function NewDocumentDialog(props: NewDocumentDialogProps) {
  if (!props.open) return null;

  return (
    <div
      className="modal-backdrop"
      role="presentation"
      onMouseDown={(event) => event.target === event.currentTarget && props.onClose()}
    >
      <section className="new-document-dialog" role="dialog" aria-modal="true" aria-labelledby="new-document-title">
        <header>
          <div>
            <h2 id="new-document-title">Новый документ</h2>
            <p>Один ASA-CAD, шесть инженерных типов документов</p>
          </div>
          <button type="button" onClick={props.onClose} aria-label="Закрыть">×</button>
        </header>
        <div className="document-kind-grid">
          {(Object.keys(documentNames) as CadDocumentKind[]).map((kind) => (
            <button key={kind} type="button" onClick={() => props.onCreate(kind)}>
              <span className="kind-card-icon">{documentKindIcon(kind)}</span>
              <span className="kind-card-text">
                <strong>{documentNames[kind]}</strong>
                <small>{documentDescriptions[kind]}</small>
              </span>
            </button>
          ))}
        </div>
      </section>
    </div>
  );
}
