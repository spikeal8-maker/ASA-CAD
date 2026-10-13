import type { CadPoint2, CadSketch } from '../contracts/document';
import type { CadSketchEntityId } from '../contracts/ids';

/**
 * Feature profile from Sketch geometry: one outer closed contour plus optional
 * holes, built from Lines, Arcs and Circles. Construction Lines are ignored.
 *
 * The B-Rep runtime calls this on solver output; the UI calls the same
 * function on the persisted Sketch to decide whether a feature can start.
 * One analysis, one set of reasons — the UI never offers what the kernel
 * rejects.
 */

const TOLERANCE = 1e-5;
const ARC_SAMPLES_PER_TURN = 64;
const TWO_PI = Math.PI * 2;

export type CadProfileSegment =
  | { kind: 'line'; entityId: CadSketchEntityId; from: CadPoint2; to: CadPoint2 }
  | {
    kind: 'arc';
    entityId: CadSketchEntityId;
    center: CadPoint2;
    radius: number;
    /** Traversal goes from -> mid -> to along the persisted arc. */
    from: CadPoint2;
    mid: CadPoint2;
    to: CadPoint2;
  };

export interface CadProfileLoop {
  circle?: { entityId: CadSketchEntityId; center: CadPoint2; radius: number };
  segments: CadProfileSegment[];
  /** Polyline approximation for containment/intersection checks only. */
  outline: CadPoint2[];
  area: number;
}

export interface CadSketchProfile {
  outer: CadProfileLoop;
  holes: CadProfileLoop[];
  /** Net area: outer minus holes. */
  area: number;
}

export type CadSketchProfileAnalysis =
  | { ok: true; profile: CadSketchProfile }
  | { ok: false; reason: string };

export class CadSketchProfileError extends Error {}

export function analyzeSketchProfile(sketch: Readonly<CadSketch>): CadSketchProfileAnalysis {
  try {
    return { ok: true, profile: buildSketchProfile(sketch) };
  } catch (error) {
    if (error instanceof CadSketchProfileError) return { ok: false, reason: error.message };
    throw error;
  }
}

export function buildSketchProfile(sketch: Readonly<CadSketch>): CadSketchProfile {
  const loops: CadProfileLoop[] = [];
  const chainItems: ChainItem[] = [];

  for (const entity of sketch.entities) {
    if (entity.type === 'line') {
      if (entity.data.construction) continue;
      const from = point(entity.data.from);
      const to = point(entity.data.to);
      if (distance(from, to) <= TOLERANCE) fail('в контуре есть отрезок нулевой длины');
      chainItems.push({ kind: 'line', entityId: entity.id, a: from, b: to });
    } else if (entity.type === 'arc') {
      const { center, radius, startAngle, endAngle } = entity.data;
      const sweep = endAngle - startAngle;
      if (!(radius > TOLERANCE) || !(sweep > 1e-9) || !(sweep < TWO_PI - 1e-9)) fail('в контуре есть вырожденная дуга');
      const c = point(center);
      chainItems.push({
        kind: 'arc',
        entityId: entity.id,
        center: c,
        radius,
        startAngle,
        endAngle,
        a: polar(c, radius, startAngle),
        b: polar(c, radius, endAngle),
      });
    } else if (entity.type === 'circle') {
      const center = point(entity.data.center);
      const radius = entity.data.diameter / 2;
      if (!(radius > TOLERANCE)) fail('в контуре есть окружность нулевого радиуса');
      const outline = sampleArc(center, radius, 0, TWO_PI, false);
      loops.push({
        circle: { entityId: entity.id, center, radius },
        segments: [],
        outline,
        area: Math.PI * radius * radius,
      });
    }
  }

  loops.push(...chainLoops(chainItems));
  if (loops.length === 0) fail('эскиз пуст: нет отрезков, дуг или окружностей для профиля');

  for (const loop of loops) {
    if (outlineSelfIntersects(loop.outline)) fail('контур пересекает сам себя');
    if (!(loop.area > TOLERANCE * TOLERANCE)) fail('контур имеет нулевую площадь');
  }
  for (let i = 0; i < loops.length; i += 1) {
    for (let j = i + 1; j < loops.length; j += 1) {
      if (outlinesIntersect(loops[i].outline, loops[j].outline)) fail('контуры пересекаются друг с другом');
    }
  }

  const depth = loops.map((loop, index) => loops.filter((other, otherIndex) => (
    otherIndex !== index && pointInPolygon(loop.outline[0], other.outline)
  )).length);
  const outers = loops.filter((_, index) => depth[index] === 0);
  if (depth.some((value) => value > 1)) fail('вложенные острова внутри отверстий пока не поддерживаются');
  if (outers.length !== 1) {
    fail(`профиль должен иметь один внешний контур, найдено ${outers.length}`);
  }
  const outer = outers[0];
  const holes = loops.filter((_, index) => depth[index] === 1);
  return { outer, holes, area: outer.area - holes.reduce((sum, hole) => sum + hole.area, 0) };
}

interface LineItem { kind: 'line'; entityId: CadSketchEntityId; a: CadPoint2; b: CadPoint2 }
interface ArcItem {
  kind: 'arc';
  entityId: CadSketchEntityId;
  center: CadPoint2;
  radius: number;
  startAngle: number;
  endAngle: number;
  a: CadPoint2;
  b: CadPoint2;
}
type ChainItem = LineItem | ArcItem;

function chainLoops(items: ChainItem[]): CadProfileLoop[] {
  if (items.length === 0) return [];
  const vertices: CadPoint2[] = [];
  const vertexFor = (value: CadPoint2): number => {
    const existing = vertices.findIndex((candidate) => distance(candidate, value) <= TOLERANCE);
    if (existing >= 0) return existing;
    vertices.push(value);
    return vertices.length - 1;
  };
  const edges = items.map((item) => ({ item, a: vertexFor(item.a), b: vertexFor(item.b) }));
  if (edges.some((edge) => edge.a === edge.b)) fail('в контуре есть сегмент, замкнутый сам на себя');

  const incident = vertices.map(() => [] as number[]);
  edges.forEach((edge, index) => {
    incident[edge.a].push(index);
    incident[edge.b].push(index);
  });
  if (incident.some((list) => list.length < 2)) fail('контур не замкнут: у сегмента есть свободный конец');
  if (incident.some((list) => list.length > 2)) fail('контур ветвится: в одной точке сходится больше двух сегментов');

  const used = new Set<number>();
  const loops: CadProfileLoop[] = [];
  for (let start = 0; start < edges.length; start += 1) {
    if (used.has(start)) continue;
    const segments: CadProfileSegment[] = [];
    const outline: CadPoint2[] = [];
    let edgeIndex = start;
    let fromVertex = edges[start].a;
    while (!used.has(edgeIndex)) {
      used.add(edgeIndex);
      const edge = edges[edgeIndex];
      const forward = edge.a === fromVertex;
      const toVertex = forward ? edge.b : edge.a;
      const segment = orientedSegment(edge.item, forward, vertices[fromVertex], vertices[toVertex]);
      segments.push(segment);
      outline.push(...segmentOutline(edge.item, forward));
      fromVertex = toVertex;
      const next = incident[toVertex].find((index) => index !== edgeIndex && !used.has(index));
      if (next === undefined) break;
      edgeIndex = next;
    }
    loops.push({ segments, outline, area: Math.abs(signedArea(outline)) });
  }
  return loops;
}

/** Endpoints come from merged vertices so consecutive segments meet exactly. */
function orientedSegment(item: ChainItem, forward: boolean, from: CadPoint2, to: CadPoint2): CadProfileSegment {
  if (item.kind === 'line') return { kind: 'line', entityId: item.entityId, from, to };
  const mid = polar(item.center, item.radius, (item.startAngle + item.endAngle) / 2);
  return { kind: 'arc', entityId: item.entityId, center: item.center, radius: item.radius, from, mid, to };
}

/** Polyline points of a traversed segment, excluding its final point. */
function segmentOutline(item: ChainItem, forward: boolean): CadPoint2[] {
  if (item.kind === 'line') return [forward ? item.a : item.b];
  return sampleArc(item.center, item.radius, item.startAngle, item.endAngle, !forward);
}

function sampleArc(center: CadPoint2, radius: number, start: number, end: number, reverse: boolean): CadPoint2[] {
  const sweep = end - start;
  const count = Math.max(4, Math.ceil((Math.abs(sweep) / TWO_PI) * ARC_SAMPLES_PER_TURN));
  const fullTurn = Math.abs(Math.abs(sweep) - TWO_PI) < 1e-9;
  const result: CadPoint2[] = [];
  for (let index = 0; index < count; index += 1) {
    const t = index / count;
    const angle = reverse ? end - sweep * t : start + sweep * t;
    result.push(polar(center, radius, angle));
  }
  if (!fullTurn && result.length === 0) result.push(polar(center, radius, reverse ? end : start));
  return result;
}

function outlineSelfIntersects(outline: CadPoint2[]): boolean {
  const n = outline.length;
  for (let i = 0; i < n; i += 1) {
    const a1 = outline[i];
    const a2 = outline[(i + 1) % n];
    for (let j = i + 2; j < n; j += 1) {
      if (i === 0 && j === n - 1) continue;
      if (properIntersection(a1, a2, outline[j], outline[(j + 1) % n])) return true;
    }
  }
  return false;
}

function outlinesIntersect(a: CadPoint2[], b: CadPoint2[]): boolean {
  for (let i = 0; i < a.length; i += 1) {
    for (let j = 0; j < b.length; j += 1) {
      if (anyIntersection(a[i], a[(i + 1) % a.length], b[j], b[(j + 1) % b.length])) return true;
    }
  }
  return false;
}

function cross(a: CadPoint2, b: CadPoint2, c: CadPoint2): number {
  return (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]);
}

function properIntersection(a: CadPoint2, b: CadPoint2, c: CadPoint2, d: CadPoint2): boolean {
  const d1 = cross(a, b, c);
  const d2 = cross(a, b, d);
  const d3 = cross(c, d, a);
  const d4 = cross(c, d, b);
  const eps = TOLERANCE * TOLERANCE;
  return ((d1 > eps && d2 < -eps) || (d1 < -eps && d2 > eps))
    && ((d3 > eps && d4 < -eps) || (d3 < -eps && d4 > eps));
}

function anyIntersection(a: CadPoint2, b: CadPoint2, c: CadPoint2, d: CadPoint2): boolean {
  if (properIntersection(a, b, c, d)) return true;
  return onSegment(a, b, c) || onSegment(a, b, d) || onSegment(c, d, a) || onSegment(c, d, b);
}

function onSegment(a: CadPoint2, b: CadPoint2, p: CadPoint2): boolean {
  if (Math.abs(cross(a, b, p)) > TOLERANCE * Math.max(1, distance(a, b))) return false;
  return p[0] >= Math.min(a[0], b[0]) - TOLERANCE && p[0] <= Math.max(a[0], b[0]) + TOLERANCE
    && p[1] >= Math.min(a[1], b[1]) - TOLERANCE && p[1] <= Math.max(a[1], b[1]) + TOLERANCE;
}

function pointInPolygon(p: CadPoint2, polygon: CadPoint2[]): boolean {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i, i += 1) {
    const [xi, yi] = polygon[i];
    const [xj, yj] = polygon[j];
    if ((yi > p[1]) !== (yj > p[1]) && p[0] < ((xj - xi) * (p[1] - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

function signedArea(outline: CadPoint2[]): number {
  return outline.reduce((sum, current, index) => {
    const next = outline[(index + 1) % outline.length];
    return sum + current[0] * next[1] - next[0] * current[1];
  }, 0) / 2;
}

function polar(center: CadPoint2, radius: number, angle: number): CadPoint2 {
  return [center[0] + radius * Math.cos(angle), center[1] + radius * Math.sin(angle)];
}

function point(value: readonly number[]): CadPoint2 {
  const x = Number(value?.[0]);
  const y = Number(value?.[1]);
  if (!Number.isFinite(x) || !Number.isFinite(y)) fail('в эскизе есть точка с некорректными координатами');
  return [x, y];
}

function distance(a: CadPoint2, b: CadPoint2): number {
  return Math.hypot(a[0] - b[0], a[1] - b[1]);
}

function fail(message: string): never {
  throw new CadSketchProfileError(`Профиль: ${message}`);
}
