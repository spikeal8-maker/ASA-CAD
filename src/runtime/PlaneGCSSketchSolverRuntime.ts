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
      .map((dimension) => this.toVendorDimension(dimension));
  }

  private toVendorDimension(dimension: CadDimension): SketchConstraint {
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
      case 'diameter':
        return {
          id: dimension.id,
          type: 'RADIUS',
          refs: [{ kind: 'entity', id: dimension.entityIds[0] }],
          value: dimension.value / 2,
        };
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
