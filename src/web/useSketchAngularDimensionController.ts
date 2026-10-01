import { useEffect, useRef, useState } from 'react';
import type { CadApplication } from '../contracts/application';
import type { CadSketch, CadSketchEntity } from '../contracts/document';
import type { CadSketchEntityId, CadSketchId } from '../contracts/ids';
import {
  preflightAngularDimension,
  type AngularDimensionPreflightResult,
} from '../browser/AngularDimensionPreflight';
import {
  AngularDimensionAttemptEpoch,
  formatAngularDimensionPreflightMessage,
  isAngularDimensionAttemptCurrent,
  runAngularDimensionAttempt,
  type AngularDimensionAttemptSnapshot,
} from './AngularDimensionAttemptLifecycle';
import type { CadWorkspacePanel } from './PartSketchWorkspaceTypes';
import { dimensionLabel } from './SketchDimensionPresentation';

export interface SketchAngularDimensionControllerOptions {
  app: CadApplication;
  activeCommand: string | null;
  activeSketchId: CadSketchId | null;
  sketch: Readonly<CadSketch> | null;
  setActiveCommand(command: string | null): void;
  setPanel(panel: CadWorkspacePanel): void;
  setNotice(message: string): void;
}

export function useSketchAngularDimensionController(options: SketchAngularDimensionControllerOptions) {
  const {
    app, activeCommand, activeSketchId, sketch,
    setActiveCommand, setPanel, setNotice,
  } = options;
  const [targetSketchId, setTargetSketchId] = useState<CadSketchId | null>(null);
  const [aEntityId, setAEntityId] = useState<CadSketchEntityId | null>(null);
  const [bEntityId, setBEntityId] = useState<CadSketchEntityId | null>(null);
  const [draftValue, setDraftValue] = useState(0);
  const [preflightPending, setPreflightPending] = useState(false);

  const mountedRef = useRef(false);
  const appRevisionRef = useRef(0);
  const attemptEpochRef = useRef(new AngularDimensionAttemptEpoch());
  const activeCommandRef = useRef(activeCommand);
  const activeSketchIdRef = useRef(activeSketchId);
  const targetSketchIdRef = useRef<CadSketchId | null>(null);
  const aEntityIdRef = useRef<CadSketchEntityId | null>(null);
  const bEntityIdRef = useRef<CadSketchEntityId | null>(null);
  const draftValueRef = useRef(0);

  activeCommandRef.current = activeCommand;
  activeSketchIdRef.current = activeSketchId;

  const lineCount = sketch?.entities.filter((entity) => entity.type === 'line').length ?? 0;
  const canApplyAngularDimension = Boolean(activeSketchId && lineCount >= 2);
  const angularDimensionActive = targetSketchId !== null;
  const canCommitAngularDimension = Boolean(
    targetSketchId
      && aEntityId
      && bEntityId
      && Number.isFinite(draftValue)
      && draftValue > 0
      && draftValue < 180
      && !preflightPending,
  );

  useEffect(() => {
    mountedRef.current = true;
    const unsubscribe = app.subscribe(() => { appRevisionRef.current += 1; });
    return () => {
      mountedRef.current = false;
      attemptEpochRef.current.invalidate();
      unsubscribe();
    };
  }, [app]);

  useEffect(() => {
    if (!angularDimensionActive || activeCommand === 'dimension.angular') return;
    reset();
  }, [activeCommand, angularDimensionActive]);

  function invalidatePendingAttempt(): void {
    attemptEpochRef.current.invalidate();
    if (mountedRef.current) setPreflightPending(false);
  }

  function beginAngularDimension(): boolean {
    if (!activeSketchId || lineCount < 2) {
      setNotice('Для углового размера нужны два отрезка эскиза');
      return false;
    }
    invalidatePendingAttempt();
    targetSketchIdRef.current = activeSketchId;
    aEntityIdRef.current = null;
    bEntityIdRef.current = null;
    draftValueRef.current = 0;
    setTargetSketchId(activeSketchId);
    setAEntityId(null);
    setBEntityId(null);
    setDraftValue(0);
    setActiveCommand('dimension.angular');
    setPanel('closed');
    setNotice('Выберите первый отрезок');
    return true;
  }

  async function selectAngularDimensionLines(
    nextAEntityId: CadSketchEntityId,
    nextBEntityId: CadSketchEntityId,
  ): Promise<boolean> {
    const target = targetSketchIdRef.current;
    if (!target || !sketch || sketch.id !== target) {
      setNotice('Сначала запустите угловой размер в активном эскизе');
      return false;
    }
    if (nextAEntityId === nextBEntityId) {
      setNotice('Выберите два разных отрезка');
      return false;
    }
    const a = lineEntity(sketch, nextAEntityId);
    const b = lineEntity(sketch, nextBEntityId);
    if (!a || !b) {
      setNotice('Угловой размер требует два отрезка');
      return false;
    }

    invalidatePendingAttempt();
    const initialValue = lineAngleDegrees(a, b);
    aEntityIdRef.current = nextAEntityId;
    bEntityIdRef.current = nextBEntityId;
    draftValueRef.current = initialValue;
    setAEntityId(nextAEntityId);
    setBEntityId(nextBEntityId);
    setDraftValue(initialValue);
    setPanel('parameters');
    setNotice(dimensionLabel(undefined, 'angular'));
    return true;
  }

  function updateAngularDimensionValue(value: number): void {
    if (!Object.is(value, draftValueRef.current)) invalidatePendingAttempt();
    draftValueRef.current = value;
    setDraftValue(value);
  }

  function attemptIsCurrent(attempt: AngularDimensionAttemptSnapshot): boolean {
    return isAngularDimensionAttemptCurrent(attempt, {
      mounted: mountedRef.current,
      requestCurrent: attemptEpochRef.current.owns(attempt.requestId),
      appRevision: appRevisionRef.current,
      document: app.getDocument(),
      activeCommand: activeCommandRef.current,
      activeSketchId: activeSketchIdRef.current,
      targetSketchId: targetSketchIdRef.current,
      aEntityId: aEntityIdRef.current,
      bEntityId: bEntityIdRef.current,
      value: draftValueRef.current,
    });
  }

  async function commitAngularDimension(): Promise<boolean> {
    const sketchId = targetSketchIdRef.current;
    const firstEntityId = aEntityIdRef.current;
    const secondEntityId = bEntityIdRef.current;
    const value = draftValueRef.current;
    if (
      !sketchId
      || !firstEntityId
      || !secondEntityId
      || !Number.isFinite(value)
      || value <= 0
      || value >= 180
    ) {
      setNotice('Введите угол больше 0 и меньше 180 градусов');
      return false;
    }

    const requestId = attemptEpochRef.current.begin();
    if (requestId === null) return false;
    setPreflightPending(true);
    const attempt: AngularDimensionAttemptSnapshot = {
      requestId,
      appRevision: appRevisionRef.current,
      document: app.getDocument(),
      sketchId,
      aEntityId: firstEntityId,
      bEntityId: secondEntityId,
      value,
    };

    const outcome = await runAngularDimensionAttempt({
      preflight: () => preflightAngularDimension(
        attempt.document, attempt.sketchId, attempt.aEntityId, attempt.bEntityId, attempt.value,
      ),
      isCurrent: () => attemptIsCurrent(attempt),
      execute: () => app.execute({
        id: 'dimension.angular',
        payload: {
          sketchId: attempt.sketchId,
          aEntityId: attempt.aEntityId,
          bEntityId: attempt.bEntityId,
          value: attempt.value,
        },
      }),
    });

    if (outcome.status === 'stale') {
      const stillOwned = attemptEpochRef.current.finish(requestId);
      if (stillOwned && mountedRef.current) {
        setPreflightPending(false);
        if (activeCommandRef.current === 'dimension.angular') {
          setNotice('Документ или команда изменились; повторите проверку углового размера');
        }
      }
      return false;
    }

    if (!attemptEpochRef.current.owns(requestId) || !mountedRef.current) {
      return outcome.status === 'applied';
    }
    attemptEpochRef.current.finish(requestId);
    setPreflightPending(false);

    if (outcome.status === 'preflight-rejected') {
      setNotice(formatAngularDimensionPreflightMessage(outcome.preflight));
      return false;
    }
    if (outcome.status === 'command-failed') {
      setNotice(outcome.result.error?.message ?? 'Не удалось создать угловой размер');
      return false;
    }

    reset();
    setActiveCommand(null);
    setPanel('tree');
    setNotice(`Угловой размер создан: ${attempt.value}°`);
    return true;
  }

  function reset(): void {
    invalidatePendingAttempt();
    targetSketchIdRef.current = null;
    aEntityIdRef.current = null;
    bEntityIdRef.current = null;
    draftValueRef.current = 0;
    setTargetSketchId(null);
    setAEntityId(null);
    setBEntityId(null);
    setDraftValue(0);
  }

  function cancelAngularDimension(): void {
    reset();
    setActiveCommand(null);
    setPanel('tree');
    setNotice('Команда отменена');
  }

  return {
    angularDimensionActive,
    angularDimensionAEntityId: aEntityId,
    angularDimensionBEntityId: bEntityId,
    angularDimensionValue: draftValue,
    setAngularDimensionValue: updateAngularDimensionValue,
    canApplyAngularDimension,
    canCommitAngularDimension,
    beginAngularDimension,
    selectAngularDimensionLines,
    commitAngularDimension,
    cancelAngularDimension,
  };
}

type LineEntity = Extract<CadSketchEntity, { type: 'line' }>;

function lineEntity(sketch: Readonly<CadSketch>, entityId: CadSketchEntityId): LineEntity | null {
  const entity = sketch.entities.find((item) => item.id === entityId);
  return entity?.type === 'line' ? entity : null;
}

function lineAngleDegrees(a: LineEntity, b: LineEntity): number {
  const ax = a.data.to[0] - a.data.from[0];
  const ay = a.data.to[1] - a.data.from[1];
  const bx = b.data.to[0] - b.data.from[0];
  const by = b.data.to[1] - b.data.from[1];
  const cross = ax * by - ay * bx;
  const dot = ax * bx + ay * by;
  return Math.abs(Math.atan2(cross, dot)) * 180 / Math.PI;
}
