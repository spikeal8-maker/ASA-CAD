import type { CadPoint2, CadSketch, CadSketchEntity } from '../../contracts/document';
import { analyzeSketchProfile } from '../../application/SketchProfile';
import type { SketchOverlayModel } from '../viewport/SketchOverlayModel';
import {
  sketchDisplayFrame,
  type SketchDisplayFrame, type SketchScreenRect, type SketchViewportState,
} from '../viewport/SketchViewportGeometry';

export interface SketchPointMark {
  entityId: string;
  kind: 'endpoint' | 'center';
  point: CadPoint2;
}
export interface SketchSnap {
  point: CadPoint2;
  kind: 'endpoint' | 'center' | 'origin' | 'grid';
  entityId?: string;
}
export interface SketchGridTick {
  value: number;
  major: boolean;
}

/** Fill the scene without changing the product camera's short-edge scale. */
export function sketchFrameForScreen(
  viewport: SketchViewportState,
  size: Pick<SketchScreenRect, 'width' | 'height'>,
): SketchDisplayFrame {
  const square = sketchDisplayFrame(viewport);
  if (!(size.width > 0 && size.height > 0)
    || !Number.isFinite(size.width) || !Number.isFinite(size.height)) return square;
  const scale = Math.min(size.width / square.width, size.height / square.height);
  const width = size.width / scale, height = size.height / scale;
  const minX = viewport.center[0] - width / 2, minY = -viewport.center[1] - height / 2;
  return { minX, minY, maxX: minX + width, maxY: minY + height,
    width, height, viewBox: [minX, minY, width, height].join(' ') };
}

/** Presentation coordinates only; entity creation and constraint solving remain in App. */
export function sketchPointMarks(entities: readonly CadSketchEntity[]): SketchPointMark[] {
  return entities.flatMap((entity): SketchPointMark[] => {
    if (entity.type === 'line') return [
      { entityId: entity.id, kind: 'endpoint', point: entity.data.from },
      { entityId: entity.id, kind: 'endpoint', point: entity.data.to },
    ];
    if (entity.type === 'circle') return [{ entityId: entity.id, kind: 'center', point: entity.data.center }];
    const { center, radius, startAngle, endAngle } = entity.data;
    return [
      { entityId: entity.id, kind: 'center', point: center },
      ...[startAngle, endAngle].map((angle): SketchPointMark => ({
        entityId: entity.id, kind: 'endpoint',
        point: [center[0] + radius * Math.cos(angle), center[1] + radius * Math.sin(angle)],
      })),
    ];
  });
}

/** Native reference minor pitch is about 26.7 CSS px; ticks retain real sketch units. */
export function sketchGridStep(span: number, shortEdge = 700): number {
  const validSpan = Number.isFinite(span) && span > 0 ? span : 100;
  const validEdge = Number.isFinite(shortEdge) && shortEdge > 0 ? shortEdge : 700;
  const target = 26.7 * validSpan / validEdge;
  const magnitude = 10 ** Math.floor(Math.log10(target));
  return [1, 2, 2.5, 5, 10].map(value => value * magnitude).reduce((best, value) =>
    Math.abs(Math.log(value / target)) < Math.abs(Math.log(best / target)) ? value : best);
}

/** Integer tick indices avoid floating-point drift between major lines and labels. */
export function sketchGridTicks(min: number, max: number, step: number): SketchGridTick[] {
  const result: SketchGridTick[] = [];
  for (let index = Math.ceil(min / step - 1e-10); index <= Math.floor(max / step + 1e-10); index += 1) {
    result.push({ value: Number((index * step).toPrecision(12)), major: index % 5 === 0 });
  }
  return result;
}

/** A render-only subset: retain entity identity and every solver field, never clone CAD intent. */
export function sketchDisplayOverlay(
  overlay: SketchOverlayModel | null, showConstruction: boolean,
): SketchOverlayModel | null {
  if (!overlay || showConstruction) return overlay;
  const entities = overlay.entities.filter(entity => entity.type !== 'line' || !entity.data.construction);
  return entities.length === overlay.entities.length ? overlay : { ...overlay, entities };
}

/** Snap affects the actual existing drawing callback, not just a visual marker. */
export function resolveSketchSnap(
  point: CadPoint2, entities: readonly CadSketchEntity[], step: number,
  tolerance: number, enabled: boolean,
): SketchSnap | null {
  if (!enabled) return null;
  const marks: SketchSnap[] = [
    ...sketchPointMarks(entities),
    { point: [0, 0], kind: 'origin' },
  ];
  let closest: SketchSnap | null = null;
  let distance = tolerance;
  for (const mark of marks) {
    const next = Math.hypot(mark.point[0] - point[0], mark.point[1] - point[1]);
    if (next <= distance) { distance = next; closest = mark; }
  }
  if (closest) return closest;
  const gridPoint: CadPoint2 = [Math.round(point[0] / step) * step, Math.round(point[1] / step) * step];
  return Math.hypot(gridPoint[0] - point[0], gridPoint[1] - point[1]) <= tolerance
    ? { point: gridPoint, kind: 'grid' } : null;
}

export function fitSketchViewport(entities: readonly CadSketchEntity[]): SketchViewportState {
  if (!entities.length) return { center: [0, 0], span: 100 };
  const points = sketchPointMarks(entities).map(mark => mark.point);
  for (const entity of entities) {
    if (entity.type === 'line') continue;
    const radius = entity.type === 'circle' ? entity.data.diameter / 2 : entity.data.radius;
    const [x, y] = entity.data.center;
    points.push([x - radius, y - radius], [x + radius, y + radius]);
  }
  const xs = points.map(point => point[0]);
  const ys = points.map(point => point[1]);
  const minX = Math.min(...xs), maxX = Math.max(...xs);
  const minY = Math.min(...ys), maxY = Math.max(...ys);
  return {
    center: [(minX + maxX) / 2, (minY + maxY) / 2],
    span: Math.min(100000, Math.max(2, Math.max(maxX - minX, maxY - minY) * 1.3)),
  };
}

export function sketchEntityAnchor(entity: CadSketchEntity): CadPoint2 {
  if (entity.type === 'line') return [
    (entity.data.from[0] + entity.data.to[0]) / 2,
    (entity.data.from[1] + entity.data.to[1]) / 2,
  ];
  if (entity.type === 'circle') return [entity.data.center[0] + entity.data.diameter / 2, entity.data.center[1]];
  const angle = (entity.data.startAngle + entity.data.endAngle) / 2;
  return [entity.data.center[0] + entity.data.radius * Math.cos(angle), entity.data.center[1] + entity.data.radius * Math.sin(angle)];
}

/** The product profile analyzer alone decides whether a contour is a supported closed profile. */
export function sketchProfilePath(sketch: Readonly<CadSketch>, entities: readonly CadSketchEntity[]): string | null {
  const analysis = analyzeSketchProfile({ ...sketch, entities: [...entities] });
  if (!analysis.ok) return null;
  return [analysis.profile.outer, ...analysis.profile.holes].map(loop => {
    if (loop.circle) {
      const { center: [x, y], radius } = loop.circle;
      return `M ${x - radius} ${-y} a ${radius} ${radius} 0 1 0 ${2 * radius} 0 a ${radius} ${radius} 0 1 0 ${-2 * radius} 0 Z`;
    }
    return loop.outline.map(([x, y], index) => `${index ? 'L' : 'M'} ${x} ${-y}`).join(' ') + ' Z';
  }).join(' ');
}
