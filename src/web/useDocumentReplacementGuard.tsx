import React, { useCallback, useState } from 'react';
import { serializeCadDocument, type CadDocument, type CadDocumentKind } from '../contracts/document';
import { NewDocumentDialog } from './NewDocumentDialog';
import { UnsavedChangesDialog } from './UnsavedChangesDialog';

type ReplacementAction = 'new' | 'open';

export interface DocumentReplacementGuardOptions {
  dirty: boolean;
  document: Readonly<CadDocument>;
  save(): Promise<boolean>;
  open(): Promise<boolean>;
  onCreate(kind: CadDocumentKind): void | Promise<void>;
}

export function useDocumentReplacementGuard(options: DocumentReplacementGuardOptions) {
  const [newDialogOpen, setNewDialogOpen] = useState(false);
  const [pending, setPending] = useState<ReplacementAction | null>(null);
  const [busy, setBusy] = useState(false);
  const [cleanFingerprint, setCleanFingerprint] = useState<string | null>(null);
  const fingerprint = serializeCadDocument(options.document);
  const dirty = options.dirty && cleanFingerprint !== fingerprint;

  const saveDocument = useCallback(async () => {
    const savedFingerprint = fingerprint;
    const saved = await options.save();
    if (saved) setCleanFingerprint(savedFingerprint);
    return saved;
  }, [fingerprint, options.save]);

  const perform = useCallback(async (action: ReplacementAction) => {
    if (action === 'new') {
      setNewDialogOpen(true);
      return true;
    }
    return options.open();
  }, [options.open]);

  const request = useCallback(async (action: ReplacementAction) => {
    if (dirty) {
      setPending(action);
      return;
    }
    await perform(action);
  }, [dirty, perform]);

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
      if (!(await saveDocument())) return;
      setPending(null);
      await perform(action);
    } finally {
      setBusy(false);
    }
  }, [busy, pending, perform, saveDocument]);

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

  return { newDocument, openDocument, saveDocument, dirty, dialogs };
}
