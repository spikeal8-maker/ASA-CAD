import { useCallback, useLayoutEffect, useRef, useState } from 'react';
import type { CadPoint2 } from '../../contracts/document';
import {
  bindLiveLineInteraction, createLiveLineSnapshot, publishLiveLineInteraction,
  type LiveLineNumericField, type LiveLinePhase, type LiveLinePointerContext, type LiveLineSnapshot,
} from './LiveLineInteraction';
import type { SketchLineDraft, UseSketchLineToolOptions, LiveLineFlight } from './LiveLineToolTypes';
import { useLiveLineCommit } from './useLiveLineCommit';
import {
  MIN_LINE_LENGTH, finitePoint, copyPoint, withGeometry, matchingSnap,
  numericError, parseNumeric, validAngleInput, angleInputError,
  endpointReference, findLine, sketchFingerprint,
} from './LiveLineGeometry';
export type { SketchLineDraft, UseSketchLineToolOptions } from './LiveLineToolTypes';

/**
 * Fusion interaction adapter for the shared application commands. Transient gestures never
 * write CadDocument. All geometry, constraints and dimensions use real commands.
 * Each changed execute has a separate Undo frame; no transaction is fabricated.
 */
export function useSketchLineTool(options: UseSketchLineToolOptions) {
  const optionsRef = useRef(options);
  optionsRef.current = options;
  const token = useRef(Symbol('live-line-owner'));
  const mounted = useRef(false);
  const epoch = useRef(0);
  const flight = useRef<LiveLineFlight | null>(null);
  const pointerContext = useRef<LiveLinePointerContext | null>(null);
  const rawPointer = useRef<CadPoint2 | null>(null);
  const state = useRef(createLiveLineSnapshot(options.active, options.sketchId));
  const [view, setView] = useState(state.current);

  const publish = useCallback((next: LiveLineSnapshot) => {
    state.current = next;
    if (mounted.current) setView(next);
    publishLiveLineInteraction(token.current, next);
  }, []);

  const clear = useCallback((phase: LiveLinePhase, active: boolean) => {
    epoch.current += 1;
    pointerContext.current = null;
    rawPointer.current = null;
    publish({
      ...createLiveLineSnapshot(active, optionsRef.current.sketchId),
      phase, committing: flight.current !== null, lastCommit: state.current.lastCommit,
    });
  }, [publish]);

  const reset = useCallback(() => {
    const active = optionsRef.current.active;
    // The shared controller calls reset before every Line toolbar invocation.
    // Native reselecting an already active Line preserves its pending chain.
    // Cancellation, Undo/Open and option changes have their own clear path.
    if (active && state.current.active) return;
    clear(active ? 'AWAITING_START' : 'IDLE', active);
  }, [clear]);

  const finishChain = useCallback(() => {
    const active = state.current.active && optionsRef.current.active;
    clear(active ? 'AWAITING_START' : 'IDLE', active);
    if (active) optionsRef.current.setNotice('Укажите начальную точку отрезка');
  }, [clear]);

  const cancelPreview = useCallback(() => {
    clear('CANCELLED', state.current.active && optionsRef.current.active);
  }, [clear]);

  const exitTool = useCallback(() => {
    if (!state.current.active) return;
    clear('CANCELLED', false);
    optionsRef.current.onCommitted();
  }, [clear]);

  const setPointerContext = useCallback((context: LiveLinePointerContext) => {
    if (!finitePoint(context.point)) return;
    pointerContext.current = {
      point: copyPoint(context.point),
      snap: context.snap ? {
        ...context.snap, point: copyPoint(context.snap.point),
        ref: context.snap.ref ? { ...context.snap.ref } : undefined,
      } : null,
    };
    if (context.snap === null && state.current.snap !== null) {
      publish({ ...state.current, snap: null });
    }
  }, [publish]);

  const move = useCallback((point: CadPoint2) => {
    const current = state.current;
    if (!optionsRef.current.active || !current.active || !current.from || flight.current || !finitePoint(point)) return;
    rawPointer.current = copyPoint(point);
    const next = withGeometry({
      ...current, phase: current.focusedField ? 'NUMERIC_INPUT' : 'PREVIEW_SEGMENT',
    }, point);
    publish({ ...next, snap: matchingSnap(pointerContext.current, point, next.to!) });
  }, [publish]);

  const focusNumeric = useCallback((field: LiveLineNumericField | null) => {
    const current = state.current;
    if (!current.active || !current.from || flight.current) return;
    publish({ ...current, focusedField: field, phase: field ? 'NUMERIC_INPUT' : 'PREVIEW_SEGMENT' });
  }, [publish]);

  const setNumeric = useCallback((field: LiveLineNumericField, text: string) => {
    const current = state.current;
    if (!current.active || !current.from || flight.current) return;
    const edited = field === 'length'
      ? { ...current, lengthText: text, lengthEdited: true }
      : { ...current, angleText: text, angleEdited: true };
    const next = withGeometry({
      ...edited, focusedField: field, phase: 'NUMERIC_INPUT', error: null,
    }, rawPointer.current ?? current.to ?? current.from);
    publish({ ...next, snap: null, error: numericError(next) });
  }, [publish]);

  const lockNumeric = useCallback((field: LiveLineNumericField): boolean => {
    const current = state.current;
    if (!current.active || !current.from || flight.current) return false;
    const value = parseNumeric(field === 'length' ? current.lengthText : current.angleText);
    if (field === 'length' ? value === null || value <= MIN_LINE_LENGTH : !validAngleInput(value, current.angleMode)) {
      const error = field === 'length' ? 'Введите положительную длину' : angleInputError(current.angleMode);
      const invalid = field === 'length'
        ? { ...current, lengthEdited: true, lengthValid: false }
        : { ...current, angleEdited: true, angleValid: false };
      publish({ ...invalid, numericTextValid: false, error, focusedField: field, phase: 'NUMERIC_INPUT' });
      optionsRef.current.setNotice(error);
      return false;
    }
    const locked = field === 'length'
      ? { ...current, lengthLocked: true, lengthEdited: true }
      : { ...current, angleLocked: true, angleEdited: true };
    const raw = rawPointer.current ?? current.to ?? current.from;
    const next = withGeometry({ ...locked, phase: 'NUMERIC_INPUT', error: null }, raw);
    publish({ ...next, snap: matchingSnap(pointerContext.current, raw, next.to!) });
    return true;
  }, [publish]);

  const unlockNumeric = useCallback((field: LiveLineNumericField) => {
    const current = state.current;
    if (!current.active || !current.from || flight.current) return;
    const unlocked = field === 'length'
      ? { ...current, lengthLocked: false, lengthEdited: false }
      : { ...current, angleLocked: false, angleEdited: false };
    const next = withGeometry({ ...unlocked, error: null }, rawPointer.current ?? current.to ?? current.from);
    publish({ ...next, snap: null, error: numericError(next) });
  }, [publish]);

  const commitFromDraft = useLiveLineCommit({
    optionsRef, mounted, epoch, flight, pointerContext, rawPointer, state, publish, clear,
  });

  const point = useCallback(async (value: CadPoint2) => {
    const current = state.current;
    if (!optionsRef.current.active || !current.active || flight.current || !finitePoint(value)) return;
    rawPointer.current = copyPoint(value);
    if (!current.from) {
      const snap = matchingSnap(pointerContext.current, value, value);
      const reference = endpointReference(snap);
      const validReference = reference && optionsRef.current.sketchId
        && findLine(optionsRef.current.app, optionsRef.current.sketchId, reference.entityId) ? reference : null;
      publish({
        ...createLiveLineSnapshot(true, optionsRef.current.sketchId),
        phase: 'PREVIEW_SEGMENT', from: copyPoint(value), to: copyPoint(value), pointerPoint: copyPoint(value),
        fromReference: validReference, chainStart: copyPoint(value),
        lengthText: '0', angleText: '0', snap, lastCommit: current.lastCommit,
      });
      optionsRef.current.setNotice('Укажите конечную точку отрезка');
      return;
    }
    await commitFromDraft(value);
  }, [commitFromDraft, publish]);

  const commitPreview = useCallback(async () => {
    const current = state.current;
    if (!current.from || !current.to) return false;
    return commitFromDraft(rawPointer.current ?? current.to);
  }, [commitFromDraft]);

  useLayoutEffect(() => {
    mounted.current = true;
    if (!options.active) return () => { mounted.current = false; epoch.current += 1; };
    const unbind = bindLiveLineInteraction(token.current, {
      setPointerContext, focusNumeric, setNumeric, lockNumeric, unlockNumeric,
      commitPreview, finishChain, cancelPreview, exitTool,
    }, state.current);
    return () => {
      mounted.current = false;
      epoch.current += 1;
      unbind();
    };
  }, [options.active, cancelPreview, commitPreview, exitTool, finishChain, focusNumeric, lockNumeric, setNumeric, setPointerContext, unlockNumeric]);

  useLayoutEffect(() => {
    const previous = state.current;
    clear(options.active ? 'AWAITING_START' : 'IDLE', options.active);
    if (previous.sketchId !== options.sketchId) publish({ ...state.current, lastCommit: null });
    if (!options.active) return;
    let observedDocument = options.app.getDocument();
    let observedGeometry = sketchFingerprint(observedDocument, options.sketchId);
    return options.app.subscribe(() => {
      const document = options.app.getDocument();
      const geometry = sketchFingerprint(document, options.sketchId);
      const replaced = document !== observedDocument;
      const changed = geometry !== observedGeometry;
      observedDocument = document;
      observedGeometry = geometry;
      if (replaced || (changed && !flight.current && state.current.from)) {
        clear(optionsRef.current.active ? 'AWAITING_START' : 'IDLE', optionsRef.current.active);
      }
    });
  }, [options.active, options.app, options.sketchId, clear, publish]);

  return {
    draft: { from: view.from, to: view.to } as SketchLineDraft,
    committing: view.committing, move, point, reset, commitPreview,
  };
}
