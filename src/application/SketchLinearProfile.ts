import type { CadPoint2, CadSketch, CadSketchLineEntity } from '../contracts/document';

const PROFILE_TOLERANCE = 1e-6;

export interface ClosedLinearProfile {
  points: CadPoint2[];
  area: number;
}

/**
 * Validates and orders one simple closed linear contour from solved Sketch geometry.
 * The caller must supply solver output, not raw persisted coordinates.
 */
export function buildClosedLinearProfile(sketch: Readonly<CadSketch>): ClosedLinearProfile {
  const geometry = sketch.entities.filter((entity) => !(entity.type === 'line' && entity.data.construction));
  if (geometry.length === 0) throw new Error(`${sketch.name}: profile is empty`);
  if (geometry.some((entity) => entity.type !== 'line')) {
    throw new Error(`${sketch.name}: extrude currently supports one closed linear contour only`);
  }
  const lines = geometry as readonly CadSketchLineEntity[];
  if (lines.length < 3) throw new Error(`${sketch.name}: profile needs at least three line segments`);

  const vertices: CadPoint2[] = [];
  const vertexFor = (point: CadPoint2): number => {
    const existing = vertices.findIndex((candidate) => pointDistance(candidate, point) <= PROFILE_TOLERANCE);
    if (existing >= 0) return existing;
    vertices.push([point[0], point[1]]);
    return vertices.length - 1;
  };
  const edges = lines.map((line) => {
    if (pointDistance(line.data.from, line.data.to) <= PROFILE_TOLERANCE) {
      throw new Error(`${sketch.name}: profile contains a degenerate segment`);
    }
    const a = vertexFor(line.data.from);
    const b = vertexFor(line.data.to);
    if (a === b) throw new Error(`${sketch.name}: profile contains a collapsed segment`);
    return { a, b, id: line.id };
  });

  const incident = vertices.map(() => [] as number[]);
  edges.forEach((edge, index) => {
    incident[edge.a].push(index);
    incident[edge.b].push(index);
  });
  if (vertices.length !== edges.length || incident.some((items) => items.length !== 2)) {
    throw new Error(`${sketch.name}: profile must be one connected closed contour`);
  }

  const orderedVertexIds: number[] = [0];
  const usedEdges = new Set<number>();
  let current = 0;
  while (usedEdges.size < edges.length) {
    const edgeIndex = incident[current].find((index) => !usedEdges.has(index));
    if (edgeIndex === undefined) throw new Error(`${sketch.name}: profile contour is disconnected`);
    usedEdges.add(edgeIndex);
    const edge = edges[edgeIndex];
    current = edge.a === current ? edge.b : edge.a;
    if (current !== 0) orderedVertexIds.push(current);
  }
  if (current !== 0 || orderedVertexIds.length !== vertices.length) {
    throw new Error(`${sketch.name}: profile contour does not close exactly once`);
  }

  const points = orderedVertexIds.map((index) => vertices[index]);
  for (let i = 0; i < points.length; i += 1) {
    const a1 = points[i];
    const a2 = points[(i + 1) % points.length];
    for (let j = i + 1; j < points.length; j += 1) {
      if (j === i + 1 || (i === 0 && j === points.length - 1)) continue;
      const b1 = points[j];
      const b2 = points[(j + 1) % points.length];
      if (segmentsIntersect(a1, a2, b1, b2)) {
        throw new Error(`${sketch.name}: profile self-intersects`);
      }
    }
  }

  const signedArea = points.reduce((sum, point, index) => {
    const next = points[(index + 1) % points.length];
    return sum + point[0] * next[1] - next[0] * point[1];
  }, 0) / 2;
  const area = Math.abs(signedArea);
  if (area <= PROFILE_TOLERANCE * PROFILE_TOLERANCE) {
    throw new Error(`${sketch.name}: profile area is degenerate`);
  }
  return { points, area };
}
function pointDistance(a: CadPoint2, b: CadPoint2): number {
  return Math.hypot(a[0] - b[0], a[1] - b[1]);
}

function cross(a: CadPoint2, b: CadPoint2, c: CadPoint2): number {
  return (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]);
}

function onSegment(a: CadPoint2, b: CadPoint2, p: CadPoint2): boolean {
  if (Math.abs(cross(a, b, p)) > PROFILE_TOLERANCE) return false;
  return p[0] >= Math.min(a[0], b[0]) - PROFILE_TOLERANCE
    && p[0] <= Math.max(a[0], b[0]) + PROFILE_TOLERANCE
    && p[1] >= Math.min(a[1], b[1]) - PROFILE_TOLERANCE
    && p[1] <= Math.max(a[1], b[1]) + PROFILE_TOLERANCE;
}

function segmentsIntersect(a: CadPoint2, b: CadPoint2, c: CadPoint2, d: CadPoint2): boolean {
  const abC = cross(a, b, c);
  const abD = cross(a, b, d);
  const cdA = cross(c, d, a);
  const cdB = cross(c, d, b);
  if (((abC > PROFILE_TOLERANCE && abD < -PROFILE_TOLERANCE)
    || (abC < -PROFILE_TOLERANCE && abD > PROFILE_TOLERANCE))
    && ((cdA > PROFILE_TOLERANCE && cdB < -PROFILE_TOLERANCE)
      || (cdA < -PROFILE_TOLERANCE && cdB > PROFILE_TOLERANCE))) return true;
  return (Math.abs(abC) <= PROFILE_TOLERANCE && onSegment(a, b, c))
    || (Math.abs(abD) <= PROFILE_TOLERANCE && onSegment(a, b, d))
    || (Math.abs(cdA) <= PROFILE_TOLERANCE && onSegment(c, d, a))
    || (Math.abs(cdB) <= PROFILE_TOLERANCE && onSegment(c, d, b));
}
