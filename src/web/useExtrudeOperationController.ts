import { useState, type Dispatch, type SetStateAction } from 'react';
import type { CadApplication } from '../contracts/application';
import type { CadDocument, CadSketch } from '../contracts/document';
import type { CadSketchId } from '../contracts/ids';
import type { CadWorkspacePanel, SetWorkspace } from './PartSketchWorkspaceTypes';
import { findSketch, partDocument } from './PartSketchWorkspaceModel';
import { extrudeAvailability } from './PartFeatureAvailability';
import type { PartFeatureProfile } from './PartFeatureProfile';

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
  profile: PartFeatureProfile;
  document: Readonly<CadDocument>;
  activeSketchId: CadSketchId | null;
  sketch: Readonly<CadSketch> | null;
  setActiveCommand: Dispatch<SetStateAction<string | null>>;
  setActiveWorkspace: SetWorkspace;
  setPanel(panel: CadWorkspacePanel): void;
  setNotice(message: string): void;
  clearTransientSelection(): void;
}

const availability = extrudeAvailability;

export function useExtrudeOperationController(
  options: ExtrudeOperationControllerOptions,
): ExtrudeOperationController {
  const [distance, setDistance] = useState(10);
  const [reverse, setReverse] = useState(false);
  const [symmetric, setSymmetricState] = useState(false);
  const [executionError, setExecutionError] = useState<string | null>(null);
  const currentAvailability = inspect().availability;
  const validationError = !currentAvailability.enabled
    ? currentAvailability.reason ?? 'Выдавливание недоступно'
    : Number.isFinite(distance) && distance > 0 ? executionError : 'Расстояние должно быть больше 0';

  function inspect() {
    const document = options.app.getDocument();
    const sketch = findSketch(partDocument(document), options.sketch?.id ?? null);
    return {
      sketch,
      availability: availability(document, sketch, options.activeSketchId, options.profile.getSnapshot()),
    };
  }

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
    const current = inspect().availability;
    if (!current.enabled) {
      options.setNotice(current.reason ?? 'Выдавливание недоступно');
      return;
    }
    reset();
    options.setActiveCommand('part.extrude');
    options.setPanel('parameters');
    options.clearTransientSelection();
    options.setNotice('Задайте параметры выдавливания');
  }

  async function commit() {
    setExecutionError(null);
    const { sketch: currentSketch, availability: current } = inspect();
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
