import { useState, type Dispatch, type SetStateAction } from 'react';
import type { CadApplication } from '../contracts/application';
import type { CadDocument, CadSketch } from '../contracts/document';
import type { CadSketchId } from '../contracts/ids';
import type { CadWorkspacePanel } from './PartSketchWorkspaceTypes';
import { findSketch, hasRectangle, partDocument } from './PartSketchWorkspaceModel';

export interface ExtrudeOperationController {
  profileId: CadSketchId | null;
  profileName: string | null;
  profileSupport: string | null;
  distance: number;
  setDistance(value: number): void;
  reverse: boolean;
  toggleReverse(): void;
  symmetric: boolean;
  setSymmetric(value: boolean): void;
  validationError: string | null;
  canStart: boolean;
  disabledReason?: string;
  begin(): void;
  commit(): Promise<void>;
  reset(): void;
}

export interface ExtrudeOperationControllerOptions {
  app: CadApplication;
  document: Readonly<CadDocument>;
  activeSketchId: CadSketchId | null;
  sketch: Readonly<CadSketch> | null;
  setActiveCommand: Dispatch<SetStateAction<string | null>>;
  setActiveWorkspace: Dispatch<SetStateAction<string>>;
  setPanel(panel: CadWorkspacePanel): void;
  setNotice(message: string): void;
  clearTransientSelection(): void;
}

function availability(
  document: Readonly<CadDocument>,
  sketch: Readonly<CadSketch> | null,
  activeSketchId: CadSketchId | null,
): { enabled: boolean; reason?: string } {
  const part = partDocument(document);
  if (!part) return { enabled: false, reason: 'Выдавливание доступно только для детали' };
  if (part.features.length > 0 || part.bodies.length > 0) {
    return { enabled: false, reason: 'Первое выдавливание уже создано' };
  }
  if (activeSketchId || !sketch || !hasRectangle(sketch)) {
    return { enabled: false, reason: 'Завершите прямоугольный эскиз' };
  }
  if (sketch.support !== 'XY') {
    return {
      enabled: false,
      reason: 'Текущее выдавливание поддерживает прямоугольный эскиз на плоскости XY',
    };
  }
  return { enabled: true };
}

export function useExtrudeOperationController(
  options: ExtrudeOperationControllerOptions,
): ExtrudeOperationController {
  const [distance, setDistance] = useState(10);
  const [reverse, setReverse] = useState(false);
  const [symmetric, setSymmetricState] = useState(false);
  const [executionError, setExecutionError] = useState<string | null>(null);
  const currentAvailability = availability(options.document, options.sketch, options.activeSketchId);
  const validationError = Number.isFinite(distance) && distance > 0
    ? executionError
    : 'Расстояние должно быть больше 0';

  function reset() {
    setDistance(10);
    setReverse(false);
    setSymmetricState(false);
    setExecutionError(null);
  }

  function setSymmetric(value: boolean) {
    setSymmetricState(value);
    if (value) setReverse(false);
    setExecutionError(null);
  }

  function toggleReverse() {
    if (symmetric) return;
    setReverse((value) => !value);
    setExecutionError(null);
  }

  function begin() {
    if (!currentAvailability.enabled) return;
    reset();
    options.setActiveCommand('part.extrude');
    options.setPanel('parameters');
    options.clearTransientSelection();
    options.setNotice('Задайте параметры выдавливания');
  }

  async function commit() {
    setExecutionError(null);
    const currentPart = partDocument(options.app.getDocument());
    const currentSketch = findSketch(currentPart, options.sketch?.id ?? null);
    const current = availability(options.app.getDocument(), currentSketch, null);
    if (!current.enabled || !currentSketch) {
      const message = current.reason ?? 'Выдавливание недоступно';
      setExecutionError(message);
      options.setNotice(message);
      return;
    }
    if (!Number.isFinite(distance) || distance <= 0) {
      options.setNotice('Расстояние должно быть больше 0');
      return;
    }

    const feature = await options.app.execute({
      id: 'feature.extrude',
      payload: {
        sketchId: currentSketch.id,
        distance,
        reverse: symmetric ? false : reverse,
        symmetric,
      },
    });
    if (!feature.ok) {
      const message = feature.error?.message ?? 'Не удалось создать выдавливание';
      setExecutionError(message);
      options.setNotice(message);
      return;
    }

    options.setNotice('Построение выдавливания…');
    const rebuild = await options.app.execute({ id: 'document.rebuild', payload: {} });
    if (!rebuild.ok) {
      const message = rebuild.error?.message ?? 'Ошибка перестроения';
      setExecutionError(message);
      options.setNotice(message);
      return;
    }

    options.setActiveCommand(null);
    options.setPanel('tree');
    options.setActiveWorkspace('solid');
    options.clearTransientSelection();
    options.setNotice(`Выдавливание ${distance} мм построено локально`);
  }

  return {
    profileId: options.sketch?.id ?? null,
    profileName: options.sketch?.name ?? null,
    profileSupport: options.sketch ? String(options.sketch.support) : null,
    distance,
    setDistance: (value) => { setDistance(value); setExecutionError(null); },
    reverse,
    toggleReverse,
    symmetric,
    setSymmetric,
    validationError,
    canStart: currentAvailability.enabled,
    disabledReason: currentAvailability.reason,
    begin,
    commit,
    reset,
  };
}
