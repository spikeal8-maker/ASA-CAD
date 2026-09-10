import type { CadConstraint, CadDimension, CadPartDocument, CadSketch } from '../contracts/document';
import type { CadSketchEntityId, CadSketchId } from '../contracts/ids';
import type { CadSketchSolveResult, CadSketchSolverAdapter } from '../contracts/sketchSolver';
import { PlaneGCSSolverAdapter } from '../../vendor/toubkal/src/services/solver/PlaneGCSSolverAdapter';
import type { EntityGeom } from '../../vendor/toubkal/src/services/solver/model';
import type { SketchConstraint, SketchRef } from '../../vendor/toubkal/src/store/cadStore';

interface StoredPointRef {
  entityId: CadSketchEntityId;
  point?: 'a' | 'b' | 'c';
}

/**
 * ASA boundary around the existing PlaneGCS implementation. Vendor geometry and
 * constraint shapes are created locally and never escape this adapter.
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

  solve(document: Readonly<import('../contracts/document').CadDocument>, sketchId: CadSketchId): CadSketchSolveResult {
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
      const entities = sketch.entities.map((entity) => {
        const solved = result.geoms[entity.id];
        if (!solved) return { id: entity.id, data: structuredClone(entity.data) };
        if (entity.type === 'line' && solved.kind === 'line') {
          return { id: entity.id, data: { ...entity.data, from: [...solved.a], to: [...solved.b] } };
        }
        if (entity.type === 'circle' && solved.kind === 'circle') {
          return { id: entity.id, data: { ...entity.data, center: [...solved.c], diameter: solved.r * 2 } };
        }
        return { id: entity.id, data: structuredClone(entity.data) };
      });

      return {
        ok: result.converged,
        converged: result.converged,
        residual: result.residual,
        iterations: result.iterations,
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
      if (entity.type === 'line') {
        return [{
          id: entity.id,
          kind: 'line',
          a: [...entity.data.from] as [number, number],
          b: [...entity.data.to] as [number, number],
        }];
      }
      if (entity.type === 'circle') {
        return [{
          id: entity.id,
          kind: 'circle',
          c: [...entity.data.center] as [number, number],
          r: entity.data.diameter / 2,
        }];
      }
      return [];
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
      default: {
        const unreachable: never = constraint;
        void unreachable;
        throw new Error('M1 PlaneGCS adapter received an unsupported typed constraint');
      }
    }
  }

  private toVendorDimensions(part: CadPartDocument, sketch: CadSketch): SketchConstraint[] {
    const ids = new Set(sketch.dimensionIds);
    return part.dimensions
      .filter((dimension) => ids.has(dimension.id) && dimension.driving)
      .map((dimension) => this.toVendorDimension(dimension));
  }

  private toVendorDimension(dimension: CadDimension): SketchConstraint {
    if (dimension.type === 'linear' && dimension.entityIds.length === 1) {
      return {
        id: dimension.id,
        type: 'LENGTH',
        refs: [{ kind: 'entity', id: dimension.entityIds[0] }],
        value: dimension.value,
      };
    }
    if (dimension.type === 'diameter' && dimension.entityIds.length === 1) {
      return {
        id: dimension.id,
        type: 'RADIUS',
        refs: [{ kind: 'entity', id: dimension.entityIds[0] }],
        value: dimension.value / 2,
      };
    }
    throw new Error(`M1 PlaneGCS adapter does not support dimension ${dimension.type}`);
  }

  private vendorConstraint(
    constraint: CadConstraint,
    type: SketchConstraint['type'],
    refs: readonly StoredPointRef[],
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
      entities: [],
      diagnostics: [{ severity: 'error', code, message }],
    };
  }
}
