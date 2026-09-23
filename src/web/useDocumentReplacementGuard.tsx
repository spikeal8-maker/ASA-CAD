import React, { useCallback, useState } from 'react';
import type { CadDocumentKind } from '../contracts/document';
import { NewDocumentDialog } from './NewDocumentDialog';
import { UnsavedChangesDialog } from './UnsavedChangesDialog';

type ReplacementAction = 'new' | 'open';

export interface DocumentReplacementGuardOptions {
  dirty: boolean;
  save(): Promise<boolean>;
  open(): Promise<boolean>;
  onCreate(kind: CadDocumentKind): void | Promise<void>;
}

export function useDocumentReplacementGuard(options: DocumentReplacementGuardOptions) {
  const [newDialogOpen, setNewDialogOpen] = useState(false);
  const [pending, setPending] = useState<ReplacementAction | null>(null);
  const [busy, setBusy] = useState(false);

  const perform = useCallback(async (action: ReplacementAction) => {
    if (action === 'new') {
      setNewDialogOpen(true);
      return true;
    }
    return options.open();
  }, [options.open]);

  const request = useCallback(async (action: ReplacementAction) => {
    if (options.dirty) {
      setPending(action);
      return;
    }
    await perform(action);
  }, [options.dirty, perform]);

  const newDocument = useCallback(async () => request('new'), [request]);
  const openDocument = useCallback(async () => request('open'), [request]);
  const cancel = useCallback(() => { if (!busy) setPending(null); }, [busy]);

  const discard = useCallback(async () => {
    if (!pending || busy) return;
    const action = pending;
    setPending(null);
    await perform(action);
  }, [busy, pending, perform]);

  const saveAndContinue = useCallback(async () => {
    if (!pending || busy) return;
    const action = pending;
    setBusy(true);
    try {
      if (!(await options.save())) return;
      setPending(null);
      await perform(action);
    } finally {
      setBusy(false);
    }
  }, [busy, options.save, pending, perform]);

  const createDocument = useCallback(async (kind: CadDocumentKind) => {
    await options.onCreate(kind);
    setNewDialogOpen(false);
  }, [options.onCreate]);

  const dialogs = (
    <>
      <NewDocumentDialog open={newDialogOpen} onClose={() => setNewDialogOpen(false)} onCreate={createDocument} />
      <UnsavedChangesDialog open={pending !== null} action={pending} busy={busy} onSaveAndContinue={saveAndContinue} onDiscard={discard} onCancel={cancel} />
    </>
  );

  return { newDocument, openDocument, dialogs };
}
