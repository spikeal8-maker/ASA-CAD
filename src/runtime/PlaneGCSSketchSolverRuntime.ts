import type {
  CadConstraint,
  CadConstraintPointReference,
  CadDimension,
  CadDocument,
  CadPartDocument,
  CadSketch,
  CadSketchEntity,
} from '../contracts/document';
import type { CadSketchId } from '../contracts/ids';
import type { CadSketchSolveResult, CadSketchSolverAdapter } from '../contracts/sketchSolver';
import { PlaneGCSSolverAdapter } from '../../vendor/toubkal/src/services/solver/PlaneGCSSolverAdapter';
import type { EntityGeom } from '../../vendor/toubkal/src/services/solver/model';
import type { SketchConstraint, SketchRef } from '../../vendor/toubkal/src/store/cadStore';

/**
 * ASA boundary around the existing PlaneGCS implementation. Persisted ASA DTOs
 * are already validated before they reach this adapter, so entity/constraint
 * payloads stay strongly typed and vendor shapes never escape this boundary.
 */
export class PlaneGCSSketchSolverRuntime implements CadSketchSolverAdapter {
  private readonly solver: PlaneGCSSolverAdapter;
  private initialized = false;

  constructor(wasmUrl?: string) {
    this.solver = new PlaneGCSSolverAdapter(wasmUrl);
  }

  async init(): Promise<void> {
    if (this.initialized) return;
    await this.solver.init();
    this.initialized = true;
  }

  solve(document: Readonly<CadDocument>, sketchId: CadSketchId): CadSketchSolveResult {
    if (!this.initialized) throw new Error('PlaneGCSSketchSolverRuntime.init() must be awaited before solve()');
    if (document.kind !== 'part') {
      return this.failure('SKETCH_SOLVER_PART_ONLY', `Sketch solve requires Part, got ${document.kind}`);
    }

    const sketch = document.sketches.find((item) => item.id === sketchId);
    if (!sketch) return this.failure('SKETCH_NOT_FOUND', `Sketch ${sketchId} not found`);

    try {
      const geoms = this.toVendorGeometry(sketch);
      const constraints = [
        ...this.toVendorConstraints(document, sketch),
        ...this.toVendorDimensions(document, sketch),
      ];
      const result = this.solver.solve(geoms, constraints);
      const entities: CadSketchEntity[] = sketch.entities.map((entity) => {
        const solved = result.geoms[entity.id];
        if (!solved) return structuredClone(entity);

        if (entity.type === 'line' && solved.kind === 'line') {
          return {
            id: entity.id,
            type: 'line',
            data: {
              ...entity.data,
              from: [solved.a[0], solved.a[1]],
              to: [solved.b[0], solved.b[1]],
            },
          };
        }

        if (entity.type === 'circle' && solved.kind === 'circle') {
          return {
            id: entity.id,
            type: 'circle',
            data: {
              ...entity.data,
              center: [solved.c[0], solved.c[1]],
              diameter: solved.r * 2,
            },
          };
        }

        if (entity.type === 'arc' && solved.kind === 'arc') {
          const startAngle = normalizeArcAngle(solved.a1);
          const sweep = positiveArcSweep(solved.a1, solved.a2);
          return {
            id: entity.id,
            type: 'arc',
            data: {
              center: [solved.c[0], solved.c[1]],
              radius: solved.r,
              startAngle,
              endAngle: startAngle + sweep,
            },
          };
        }

        return structuredClone(entity);
      });

      return {
        ok: result.converged,
        converged: result.converged,
        residual: result.residual,
        iterations: result.iterations,
        // Current @salusoft89/planegcs wrapper does not expose solver rank/DoF.
        // Do not infer it from convergence; M3 may enrich the adapter later.
        degreesOfFreedom: null,
        entities,
        diagnostics: result.converged
          ? []
          : [{ severity: 'error', code: 'SKETCH_SOLVE_NOT_CONVERGED', message: `PlaneGCS did not converge (residual ${result.residual})` }],
      };
    } catch (error) {
      return this.failure('SKETCH_SOLVE_FAILED', error instanceof Error ? error.message : String(error));
    }
  }

  dispose(): void {
    this.initialized = false;
  }

  private toVendorGeometry(sketch: CadSketch): EntityGeom[] {
    return sketch.entities.flatMap((entity): EntityGeom[] => {
      switch (entity.type) {
        case 'line':
          return [{
            id: entity.id,
            kind: 'line',
            a: [entity.data.from[0], entity.data.from[1]],
            b: [entity.data.to[0], entity.data.to[1]],
          }];
        case 'circle':
          return [{
            id: entity.id,
            kind: 'circle',
            c: [entity.data.center[0], entity.data.center[1]],
            r: entity.data.diameter / 2,
          }];
        case 'arc':
          return [{
            id: entity.id,
            kind: 'arc',
            c: [entity.data.center[0], entity.data.center[1]],
            r: entity.data.radius,
            a1: entity.data.startAngle,
            a2: entity.data.endAngle,
          }];
      }
    });
  }

  private toVendorConstraints(part: CadPartDocument, sketch: CadSketch): SketchConstraint[] {
    const ids = new Set(sketch.constraintIds);
    return part.constraints
      .filter((constraint) => ids.has(constraint.id))
      .map((constraint) => this.toVendorConstraint(constraint));
  }

  private toVendorConstraint(constraint: CadConstraint): SketchConstraint {
    switch (constraint.type) {
      case 'horizontal':
        return this.vendorConstraint(constraint, 'HORIZONTAL', [{ entityId: constraint.entityIds[0] }]);
      case 'vertical':
        return this.vendorConstraint(constraint, 'VERTICAL', [{ entityId: constraint.entityIds[0] }]);
      case 'parallel':
        return this.vendorConstraint(constraint, 'PARALLEL', constraint.entityIds.map((entityId) => ({ entityId })));
      case 'perpendicular':
        return this.vendorConstraint(constraint, 'PERPENDICULAR', constraint.entityIds.map((entityId) => ({ entityId })));
      case 'tangent':
        return this.vendorConstraint(constraint, 'TANGENT', constraint.entityIds.map((entityId) => ({ entityId })));
      case 'concentric':
        return this.vendorConstraint(constraint, 'CONCENTRIC', constraint.entityIds.map((entityId) => ({ entityId })));
      case 'equal':
        return this.vendorConstraint(constraint, 'EQUAL', constraint.entityIds.map((entityId) => ({ entityId })));
      case 'symmetric':
        return this.vendorConstraint(constraint, 'SYMMETRY', [constraint.data.refs[0], constraint.data.refs[1], { entityId: constraint.entityIds[2] }]);
      case 'pointOnCurve':
        return this.vendorConstraint(constraint, 'POINT_ON_CURVE', [constraint.data.source, { entityId: constraint.entityIds[1] }]);
      case 'fixed':
        return this.vendorConstraint(constraint, 'FIXED', [{ entityId: constraint.entityIds[0] }]);
      case 'coincident':
        return this.vendorConstraint(constraint, 'COINCIDENT', constraint.data.refs);
    }
  }

  private toVendorDimensions(part: CadPartDocument, sketch: CadSketch): SketchConstraint[] {
    const ids = new Set(sketch.dimensionIds);
    return part.dimensions
      .filter((dimension) => ids.has(dimension.id) && dimension.driving)
      .map((dimension) => this.toVendorDimension(dimension, sketch));
  }

  private toVendorDimension(dimension: CadDimension, sketch: CadSketch): SketchConstraint {
    switch (dimension.type) {
      case 'linear':
        if (dimension.entityIds.length !== 1) {
          throw new Error(`Linear dimension ${dimension.id} currently requires exactly one entity`);
        }
        return {
          id: dimension.id,
          type: 'LENGTH',
          refs: [{ kind: 'entity', id: dimension.entityIds[0] }],
          value: dimension.value,
        };
      case 'horizontal':
      case 'vertical': {
        const entity = sketch.entities.find((item) => item.id === dimension.entityIds[0]);
        if (!entity) throw new Error(`Directional dimension ${dimension.id} references an unknown entity`);
        if (entity.type !== 'line') {
          throw new Error(`Directional dimension ${dimension.id} requires a Line entity, got ${entity.type}`);
        }
        const axis = dimension.type === 'horizontal' ? 0 : 1;
        const fromValue = entity.data.from[axis];
        const toValue = entity.data.to[axis];
        const refs: SketchRef[] = fromValue <= toValue
          ? [
              { kind: 'point', id: entity.id, pt: 'a' },
              { kind: 'point', id: entity.id, pt: 'b' },
            ]
          : [
              { kind: 'point', id: entity.id, pt: 'b' },
              { kind: 'point', id: entity.id, pt: 'a' },
            ];
        return {
          id: dimension.id,
          type: dimension.type === 'horizontal' ? 'DISTANCE_X' : 'DISTANCE_Y',
          refs,
          value: dimension.value,
        };
      }
      case 'diameter':
        return {
          id: dimension.id,
          type: 'RADIUS',
          refs: [{ kind: 'entity', id: dimension.entityIds[0] }],
          value: dimension.value / 2,
        };
      case 'radius': {
        const entity = sketch.entities.find((item) => item.id === dimension.entityIds[0]);
        if (!entity) throw new Error(`Radius dimension ${dimension.id} references an unknown entity`);
        if (entity.type !== 'circle' && entity.type !== 'arc') {
          throw new Error(`Radius dimension ${dimension.id} requires a Circle or Arc entity, got ${entity.type}`);
        }
        return {
          id: dimension.id,
          type: 'RADIUS',
          refs: [{ kind: 'entity', id: dimension.entityIds[0] }],
          value: dimension.value,
        };
      }
      case 'angular': {
        if (dimension.entityIds.length !== 2) {
          throw new Error(`Angular dimension ${dimension.id} requires exactly two Line entity refs`);
        }
        const [aId, bId] = dimension.entityIds;
        if (aId === bId) throw new Error(`Angular dimension ${dimension.id} requires two distinct Line entities`);
        const a = sketch.entities.find((item) => item.id === aId);
        const b = sketch.entities.find((item) => item.id === bId);
        if (!a) throw new Error(`Angular dimension ${dimension.id} references unknown entity ${aId}`);
        if (!b) throw new Error(`Angular dimension ${dimension.id} references unknown entity ${bId}`);
        if (a.type !== 'line' || b.type !== 'line') {
          throw new Error(`Angular dimension ${dimension.id} requires two Line entities, got ${a.type} and ${b.type}`);
        }
        return {
          id: dimension.id,
          type: 'ANGLE',
          refs: [
            { kind: 'entity', id: aId },
            { kind: 'entity', id: bId },
          ],
          value: dimension.value,
        };
      }
    }
  }

  private vendorConstraint(
    constraint: CadConstraint,
    type: SketchConstraint['type'],
    refs: readonly CadConstraintPointReference[],
  ): SketchConstraint {
    return {
      id: constraint.id,
      type,
      refs: refs.map((ref): SketchRef => ({
        kind: ref.point ? 'point' : 'entity',
        id: ref.entityId,
        pt: ref.point,
      })),
    };
  }

  private failure(code: string, message: string): CadSketchSolveResult {
    return {
      ok: false,
      converged: false,
      residual: Number.POSITIVE_INFINITY,
      iterations: 0,
      degreesOfFreedom: null,
      entities: [],
      diagnostics: [{ severity: 'error', code, message }],
    };
  }
}

const ARC_TWO_PI = Math.PI * 2;

function normalizeArcAngle(value: number): number {
  const normalized = ((value % ARC_TWO_PI) + ARC_TWO_PI) % ARC_TWO_PI;
  return Object.is(normalized, -0) ? 0 : normalized;
}

function positiveArcSweep(start: number, end: number): number {
  let sweep = normalizeArcAngle(end) - normalizeArcAngle(start);
  if (sweep <= 0) sweep += ARC_TWO_PI;
  return sweep;
}
