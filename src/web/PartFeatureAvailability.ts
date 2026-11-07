import { analyzeSketchProfile } from '../application/SketchProfile';
import type { CadDocument, CadPartDocument, CadSketch } from '../contracts/document';
import type { CadSketchId } from '../contracts/ids';
import { currentFeatureProfile, type FeatureProfileSnapshot } from './PartFeatureProfile';

export interface FeatureAvailability {
  enabled: boolean;
  reason?: string;
}

/**
 * Solid-feature availability for every UI surface (ribbon, menu, search,
 * shortcut, mobile). Profile validity comes from the same analysis the B-Rep
 * runtime runs on solved Sketch geometry, so the UI offers exactly what the
 * kernel can build and shows the kernel's own reason otherwise.
 */
export function extrudeAvailability(
  document: Readonly<CadDocument>,
  sketch: Readonly<CadSketch> | null,
  activeSketchId: CadSketchId | null,
  solved: Readonly<FeatureProfileSnapshot> | null = null,
): FeatureAvailability {
  if (document.kind !== 'part') return { enabled: false, reason: 'Выдавливание доступно только для детали' };
  if (document.features.length > 0 || document.bodies.length > 0) {
    return { enabled: false, reason: 'Первое выдавливание уже создано' };
  }
  if (activeSketchId || !sketch) return { enabled: false, reason: 'Завершите эскиз с замкнутым контуром' };
  return profileAvailability(document, sketch, solved);
}

export function cutAvailability(
  part: Readonly<CadPartDocument> | null,
  sketch: Readonly<CadSketch> | null,
  solved: Readonly<FeatureProfileSnapshot> | null = null,
): FeatureAvailability {
  if (!part?.bodies.length) return { enabled: false, reason: 'Сначала постройте тело выдавливанием' };
  if (part.features.at(-1)?.type !== 'extrude') {
    return { enabled: false, reason: 'Вырез пока доступен сразу после выдавливания' };
  }
  if (!sketch) return { enabled: false, reason: 'Создайте и завершите эскиз выреза' };
  return profileAvailability(part, sketch, solved);
}

/** Same Sketch the Part feature controller uses: active one, otherwise the latest. */
export function featureProfileSketch(
  part: Readonly<CadPartDocument> | null,
  activeSketch: Readonly<CadSketch> | null,
): Readonly<CadSketch> | null {
  return activeSketch ?? part?.sketches.at(-1) ?? null;
}

function profileAvailability(
  document: Readonly<CadDocument>,
  sketch: Readonly<CadSketch>,
  solved: Readonly<FeatureProfileSnapshot> | null,
): FeatureAvailability {
  if (!sketch.entities.length) return { enabled: false, reason: 'Профиль: эскиз не содержит геометрии' };
  if (!currentFeatureProfile(solved, document, sketch.id) || solved.status === 'solving') {
    return { enabled: false, reason: 'Проверка решённого профиля…' };
  }
  if (solved.status !== 'solved' || !solved.sketch) {
    return { enabled: false, reason: solved.reason ?? 'Не удалось решить профиль эскиза' };
  }
  const profile = analyzeSketchProfile(solved.sketch);
  return profile.ok ? { enabled: true } : { enabled: false, reason: profile.reason };
}
