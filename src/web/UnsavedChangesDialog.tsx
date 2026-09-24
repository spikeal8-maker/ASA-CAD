import React from 'react';

export interface UnsavedChangesDialogProps {
  open: boolean;
  action: 'new' | 'open' | null;
  busy: boolean;
  onSaveAndContinue(): void | Promise<void>;
  onDiscard(): void | Promise<void>;
  onCancel(): void;
}

export function UnsavedChangesDialog(props: UnsavedChangesDialogProps) {
  if (!props.open || !props.action) return null;
  const actionLabel = props.action === 'new' ? 'Новый' : 'Открыть';

  return (
    <div className="modal-backdrop" role="presentation">
      <section
        className="new-document-dialog unsaved-changes-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="unsaved-changes-title"
        data-replacement-kind={props.action}
        onKeyDown={(event) => {
          if (event.key === 'Escape' && !props.busy) {
            event.preventDefault();
            event.stopPropagation();
            props.onCancel();
          }
        }}
      >
        <header>
          <div>
            <h2 id="unsaved-changes-title">Есть несохранённые изменения</h2>
            <p>Действие «{actionLabel}» может заменить текущий документ.</p>
          </div>
        </header>
        <div className="unsaved-changes-body">
          <p>Сохраните изменения перед продолжением или явно продолжите без сохранения.</p>
          <div className="unsaved-changes-actions">
            <button className="primary" type="button" disabled={props.busy} onClick={() => { void props.onSaveAndContinue(); }}>Сохранить и продолжить</button>
            <button type="button" disabled={props.busy} onClick={() => { void props.onDiscard(); }}>Не сохранять</button>
            <button type="button" disabled={props.busy} onClick={props.onCancel}>Отмена</button>
          </div>
        </div>
      </section>
    </div>
  );
}
