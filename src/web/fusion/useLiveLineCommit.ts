import { useCallback } from 'react';
import type { CadCommand, CadCommandId } from '../../contracts/commands';
import type { CadPoint2, CadSketchLineEntity } from '../../contracts/document';
import type { CadSketchEntityId } from '../../contracts/ids';
import { createLiveLineSnapshot, resolveLiveLineCommit, type LiveLineCommit } from './LiveLineInteraction';
import type { LiveLineCommitOwner, LiveLineFlight } from './LiveLineToolTypes';
import {
  MIN_LINE_LENGTH, POINT_TOLERANCE, withGeometry, numericError, finitePoint,
  distance, findLine, copyPoint, matchingSnap, endpointReference, parseNumeric,
  normalizeDegrees, sketchFingerprint,
} from './LiveLineGeometry';

/** Existing commands own every persisted change; their Undo frames remain separate. */
export function useLiveLineCommit(owner: LiveLineCommitOwner) {
  const { optionsRef, mounted, epoch, flight, pointerContext, rawPointer, state, publish, clear } = owner;
  return useCallback(async (requested: CadPoint2): Promise<boolean> => {
    const current = state.current;
    const currentOptions = optionsRef.current;
    const { app, sketchId } = currentOptions;
    if (!currentOptions.active || !current.active || !sketchId || !current.from || flight.current || !finitePoint(requested)) return false;
    const prepared = withGeometry(current, requested);
    const validationError = numericError(prepared);
    if (validationError || !prepared.to || !finitePoint(prepared.to) || !Number.isFinite(prepared.length)
      || distance(current.from, prepared.to) <= MIN_LINE_LENGTH) {
      const error = validationError ?? (!prepared.to || !finitePoint(prepared.to) || !Number.isFinite(prepared.length)
        ? 'Координаты и длина должны быть конечными числами' : 'Конечная точка должна отличаться от начальной');
      publish({ ...prepared, error });
      currentOptions.setNotice(error);
      return false;
    }
    const document = app.getDocument();
    const sketch = document.kind === 'part' ? document.sketches.find(item => item.id === sketchId) : null;
    if (!sketch || (current.fromReference && !findLine(app, sketchId, current.fromReference.entityId))) {
      clear('AWAITING_START', true);
      currentOptions.setNotice('Начальная геометрия изменена. Укажите начальную точку заново');
      return false;
    }
    const from = copyPoint(current.from);
    const to = copyPoint(prepared.to);
    const snap = matchingSnap(pointerContext.current, requested, to);
    const closed = current.chainSegmentIds.length >= 2 && current.chainStart !== null
      && distance(to, current.chainStart) <= POINT_TOLERANCE;
    const endReference = closed ? current.chainStartReference : endpointReference(snap);
    if (endReference && !findLine(app, sketchId, endReference.entityId)) {
      const error = 'Точка привязки больше не существует';
      publish({ ...prepared, error, snap: null });
      currentOptions.setNotice(error);
      return false;
    }
    // Synchronous ref ownership prevents two clicks/Enter events before rerender.
    const pending: LiveLineFlight = { epoch: epoch.current, app, document };
    flight.current = pending;
    publish({ ...prepared, snap, committing: true, phase: closed ? 'CLOSING_CHAIN' : 'COMMITTING_SEGMENT', error: null });
    const commands: CadCommandId[] = [];
    const createdIds: string[] = [];
    const coincidentIds: string[] = [];
    let undoFrames = 0;
    let entityId: CadSketchEntityId | null = null;
    let orientationConstraintId: string | null = null;
    let lengthDimensionId: string | null = null;
    let resolvedFrom = from;
    let resolvedTo = to;
    const inputAngleDegrees = current.angleEdited || current.angleLocked
      ? parseNumeric(current.angleText) : null;
    const coordinateAngleDegrees = inputAngleDegrees === null ? null
      : normalizeDegrees(Math.atan2(to[1] - from[1], to[0] - from[0]) * 180 / Math.PI);
    const sameSession = () => mounted.current && epoch.current === pending.epoch
      && optionsRef.current.app === app && optionsRef.current.sketchId === sketchId
      && optionsRef.current.active && state.current.active;
    const describeCommit = (completed: boolean, error: string | null): LiveLineCommit => ({
      entityId, from: resolvedFrom, to: resolvedTo, closed, completed, createdIds: [...createdIds],
      commands: [...commands], undoFrames, coincidentIds: [...coincidentIds],
      orientationConstraintId, lengthDimensionId, inputAngleDegrees,
      angleMode: current.angleMode, coordinateAngleDegrees, angleDriving: false, error,
    });
    const execute = async (command: CadCommand) => {
      // Undo/Open replace the actual document object. Never attach queued refs
      // to a replacement document. Exit/reset alone does not abort accepted intent.
      if (app.getDocument() !== document) throw new Error('Документ изменён; оставшиеся команды сегмента не выполнены');
      commands.push(command.id);
      const result = await app.execute(command);
      if (result.changed) undoFrames += 1;
      if (result.createdIds) createdIds.push(...result.createdIds);
      if (!result.ok) throw new Error(result.error?.message ?? 'Команда ' + command.id + ' не выполнена');
      if (app.getDocument() !== document) throw new Error('Документ изменён во время команды; сегмент не подтверждён');
      return result;
    };
    try {
      const lineResult = await execute({ id: 'sketch.line', payload: { sketchId, from, to } });
      const lineIds = new Set<string>(lineResult.createdIds ?? []);
      const created = sketch.entities.find((item): item is CadSketchLineEntity => item.type === 'line' && lineIds.has(item.id));
      if (!created) throw new Error('Команда линии не вернула идентификатор созданного отрезка');
      entityId = created.id;
      if (current.fromReference) {
        const result = await execute({
          id: 'constraint.coincident',
          payload: { sketchId, a: current.fromReference, b: { entityId, point: 'a' } },
        });
        coincidentIds.push(...(result.createdIds ?? []));
      }
      if (endReference) {
        const result = await execute({
          id: 'constraint.coincident',
          payload: { sketchId, a: { entityId, point: 'b' }, b: endReference },
        });
        coincidentIds.push(...(result.createdIds ?? []));
      }
      // A current endpoint/closure snap can also imply an exact axis alignment.
      // Null context (including Snap off) never creates an inferred H/V constraint.
      if (snap && Math.abs(to[1] - from[1]) <= POINT_TOLERANCE) {
        const result = await execute({ id: 'constraint.horizontal', payload: { sketchId, entityId } });
        orientationConstraintId = result.createdIds?.[0] ?? null;
      } else if (snap && Math.abs(to[0] - from[0]) <= POINT_TOLERANCE) {
        const result = await execute({ id: 'constraint.vertical', payload: { sketchId, entityId } });
        orientationConstraintId = result.createdIds?.[0] ?? null;
      }
      if (current.lengthEdited || current.lengthLocked) {
        const result = await execute({
          id: 'dimension.linear',
          payload: { sketchId, entityIds: [entityId], value: parseNumeric(current.lengthText)! },
        });
        lengthDimensionId = result.createdIds?.[0] ?? null;
      }
      if (app.getDocument() !== document) throw new Error('Документ изменён; завершение сегмента отменено');
      const expectedGeometry = sketchFingerprint(document, sketchId);
      const solved = await resolveLiveLineCommit(sketchId);
      if (app.getDocument() !== document || sketchFingerprint(app.getDocument(), sketchId) !== expectedGeometry) {
        throw new Error('Эскиз изменён во время решения; продолжение цепочки отменено');
      }
      if (solved.status !== 'solved' || solved.converged !== true || solved.sketchId !== sketchId) {
        const diagnostic = solved.diagnostics.find(item => item.severity === 'error')?.message;
        throw new Error('Решение эскиза не завершено' + (diagnostic ? ': ' + diagnostic : ''));
      }
      const solvedLine = solved.previewEntities.find(
        (item): item is CadSketchLineEntity => item.id === entityId && item.type === 'line',
      );
      const firstId = current.chainSegmentIds[0] ?? entityId;
      const solvedFirst = solved.previewEntities.find(
        (item): item is CadSketchLineEntity => item.id === firstId && item.type === 'line',
      );
      if (!solvedLine || !solvedFirst || !finitePoint(solvedLine.data.from)
        || !finitePoint(solvedLine.data.to) || !finitePoint(solvedFirst.data.from)
        || distance(solvedLine.data.from, solvedLine.data.to) <= MIN_LINE_LENGTH) {
        throw new Error('Решение не содержит корректные конечные точки созданной цепочки');
      }
      resolvedFrom = copyPoint(solvedLine.data.from);
      resolvedTo = copyPoint(solvedLine.data.to);
      const lastCommit = describeCommit(true, null);
      const canContinue = sameSession();
      if (canContinue) {
        pointerContext.current = null;
        rawPointer.current = closed ? null : copyPoint(requested);
        const next = createLiveLineSnapshot(true, sketchId);
        publish(closed ? { ...next, committing: true, lastCommit } : {
          ...next, phase: 'CONTINUING_CHAIN', committing: true,
          from: copyPoint(resolvedTo), to: copyPoint(resolvedTo), pointerPoint: copyPoint(requested),
          fromReference: { entityId, point: 'b' },
          chainStart: copyPoint(solvedFirst.data.from),
          chainStartReference: current.chainStartReference ?? { entityId, point: 'a' },
          chainSegmentIds: [...current.chainSegmentIds, entityId],
          previousSegmentFrom: copyPoint(resolvedFrom), angleMode: 'chain-interior',
          angleDegrees: 180, lengthText: '0', angleText: '180', lastCommit,
        });
        currentOptions.setNotice(closed
          ? 'Контур замкнут. Укажите начальную точку новой цепочки'
          : coordinateAngleDegrees === null
            ? 'Отрезок создан. Укажите следующую точку'
            : current.angleMode === 'chain-interior'
              ? 'Отрезок создан. Внутренний угол задан координатами; угловой размер не создан'
              : 'Отрезок создан. Угол задан координатами; абсолютный угловой размер недоступен');
      } else if (optionsRef.current.app === app && optionsRef.current.sketchId === sketchId) {
        publish({ ...state.current, lastCommit });
      }
      return canContinue;
    } catch (cause) {
      const detail = cause instanceof Error ? cause.message : String(cause);
      const error = entityId && app.getDocument() === document
        ? 'Отрезок создан, но часть ограничений не выполнена: ' + detail : detail;
      const lastCommit = describeCommit(false, error);
      if (sameSession()) {
        if (entityId) {
          // Never leave a failed partial commit as a retryable duplicate preview.
          epoch.current += 1;
          pointerContext.current = null;
          rawPointer.current = null;
          publish({ ...createLiveLineSnapshot(true, sketchId), committing: true, error, lastCommit });
        } else {
          publish({ ...prepared, committing: true, phase: 'PREVIEW_SEGMENT', error, lastCommit });
        }
      } else if (optionsRef.current.app === app && optionsRef.current.sketchId === sketchId) {
        publish({ ...state.current, error, lastCommit });
      }
      if (optionsRef.current.app === app) optionsRef.current.setNotice(error);
      return false;
    } finally {
      if (flight.current === pending) {
        flight.current = null;
        publish({ ...state.current, committing: false });
      }
    }
  }, [clear, publish]);

}
