import { cutAvailability } from './PartFeatureAvailability';
import { findSketch, partDocument } from './PartSketchWorkspaceModel';
import type { ExtrudeOperationControllerOptions } from './useExtrudeOperationController';

interface CutOperationOptions extends ExtrudeOperationControllerOptions {
  rebuild(progress: string, failure: string, done: string): Promise<void>;
}

/** Cut shares the same current solved-profile admission at render, begin and commit. */
export function useCutOperationController(options: CutOperationOptions) {
  function inspect() {
    const part = partDocument(options.app.getDocument());
    const sketch = findSketch(part, options.sketch?.id ?? null);
    return { sketch, availability: cutAvailability(part, sketch, options.profile.getSnapshot()) };
  }
  const current = inspect().availability;

  function begin() {
    const check = inspect().availability;
    if (!check.enabled) {
      options.setNotice(check.reason ?? 'Вырез недоступен');
      return;
    }
    options.setActiveCommand('part.cutExtrude');
    options.setPanel('parameters');
    options.clearTransientSelection();
    options.setNotice('Вырез будет выполнен сквозь всё тело');
  }

  async function commit() {
    const { sketch, availability } = inspect();
    if (!sketch || !availability.enabled) {
      options.setNotice(availability.reason ?? 'Вырез недоступен');
      return;
    }
    const feature = await options.app.execute({
      id: 'feature.cutExtrude',
      payload: { sketchId: sketch.id, end: 'through-all' },
    });
    if (!feature.ok) {
      options.setNotice(feature.error?.message ?? 'Не удалось создать вырез');
      return;
    }
    await options.rebuild('Перестроение сквозного выреза…', 'Ошибка перестроения выреза', 'Сквозной вырез построен локально');
  }

  return { canStart: current.enabled, disabledReason: current.reason, begin, commit };
}
