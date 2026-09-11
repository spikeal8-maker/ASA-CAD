import { readFileSync, writeFileSync, rmSync, existsSync } from 'node:fs';

function patch(path, replacements) {
  let source = readFileSync(path, 'utf8');
  for (const [label, before, after] of replacements) {
    if (!source.includes(before)) throw new Error(`O7 runtime codemod could not find ${label} in ${path}`);
    source = source.replace(before, after);
  }
  writeFileSync(path, source);
}

patch('src/application/commands/SketchCommandHandlers.ts', [[
  'typed sketch support assignment',
  '        support: String(command.payload.support),',
  '        support: command.payload.support,',
]]);

patch('src/contracts/document.ts', [[
  'CadSketchSupport re-export',
  '  CadSketchPointSelector,\n  CadVerticalConstraint,',
  '  CadSketchPointSelector,\n  CadSketchSupport,\n  CadVerticalConstraint,',
]]);

patch('src/runtime/OpenCascadePartRuntime.ts', [
  [
    'line entity type import',
    '  CadSketch,\n  CadSketchEntity,\n  CadStableReference,',
    '  CadSketch,\n  CadSketchEntity,\n  CadSketchLineEntity,\n  CadStableReference,',
  ],
  [
    'rectangle line narrowing',
    ".filter((entity) => entity.type === 'line' && String(entity.data.role ?? '').startsWith('rectangle-edge-'))",
    ".filter((entity): entity is CadSketchLineEntity => entity.type === 'line' && String(entity.data.role ?? '').startsWith('rectangle-edge-'))",
  ],
]);

writeFileSync('src/runtime/PlaneGCSSketchSolverRuntime.ts', `import type {
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
      return this.failure('SKETCH_SOLVER_PART_ONLY', \`Sketch solve requires Part, got \${document.kind}\`);
    }

    const sketch = document.sketches.find((item) => item.id === sketchId);
    if (!sketch) return this.failure('SKETCH_NOT_FOUND', \`Sketch \${sketchId} not found\`);

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
        entities,
        diagnostics: result.converged
          ? []
          : [{ severity: 'error', code: 'SKETCH_SOLVE_NOT_CONVERGED', message: \`PlaneGCS did not converge (residual \${result.residual})\` }],
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
          throw new Error(\`Linear dimension \${dimension.id} currently requires exactly one entity\`);
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
      entities: [],
      diagnostics: [{ severity: 'error', code, message }],
    };
  }
}
`);

patch('tests/m1/sketch-solver.ts', [
  [
    'line solver discriminant assertion',
    "assert.ok(solvedLine);\nconst from = solvedLine.data.from as [number, number];\nconst to = solvedLine.data.to as [number, number];",
    "assert.ok(solvedLine);\nassert.equal(solvedLine.type, 'line');\nif (solvedLine.type !== 'line') throw new Error('Expected solved line');\nconst from = solvedLine.data.from;\nconst to = solvedLine.data.to;",
  ],
  [
    'circle solver discriminant assertion',
    "assert.ok(solvedCircle);\nassert.ok(Math.abs(Number(solvedCircle.data.diameter) - 10) < 1e-5, 'driving diameter was not solved to 10');",
    "assert.ok(solvedCircle);\nassert.equal(solvedCircle.type, 'circle');\nif (solvedCircle.type !== 'circle') throw new Error('Expected solved circle');\nassert.ok(Math.abs(solvedCircle.data.diameter - 10) < 1e-5, 'driving diameter was not solved to 10');",
  ],
]);

writeFileSync('tests/m2o/typed-sketch-dtos.ts', `import assert from 'node:assert/strict';
import {
  CAD_DOCUMENT_SCHEMA_VERSION,
  createCadId,
  createEmptyCadDocument,
  parseCadDocument,
  serializeCadDocument,
  type CadCoincidentConstraint,
  type CadDiameterDimension,
  type CadHorizontalConstraint,
  type CadLinearDimension,
  type CadSketch,
  type CadSketchCircleEntity,
  type CadSketchEntityId,
  type CadSketchId,
  type CadSketchLineEntity,
} from '../../src';
import type { CadConstraintId, CadDimensionId } from '../../src/contracts/ids';

assert.equal(CAD_DOCUMENT_SCHEMA_VERSION, 1, 'O7 must not change the persisted schema version');

const part = createEmptyCadDocument('part', { title: 'O7 typed sketch' });
const sketchId = createCadId<CadSketchId>('sketch');
const lineAId = createCadId<CadSketchEntityId>('entity');
const lineBId = createCadId<CadSketchEntityId>('entity');
const circleId = createCadId<CadSketchEntityId>('entity');

const lineA: CadSketchLineEntity = {
  id: lineAId,
  type: 'line',
  data: { from: [0, 0], to: [60, 0], role: 'typed-line-a' },
};
const lineB: CadSketchLineEntity = {
  id: lineBId,
  type: 'line',
  data: { from: [60, 0], to: [60, 40] },
};
const circle: CadSketchCircleEntity = {
  id: circleId,
  type: 'circle',
  data: { center: [30, 20], diameter: 12 },
};

const horizontalId = createCadId<CadConstraintId>('constraint');
const coincidentId = createCadId<CadConstraintId>('constraint');
const horizontal: CadHorizontalConstraint = {
  id: horizontalId,
  type: 'horizontal',
  entityIds: [lineAId],
};
const coincident: CadCoincidentConstraint = {
  id: coincidentId,
  type: 'coincident',
  entityIds: [lineAId, lineBId],
  data: {
    refs: [
      { entityId: lineAId, point: 'b' },
      { entityId: lineBId, point: 'a' },
    ],
  },
};

const linearId = createCadId<CadDimensionId>('dimension');
const diameterId = createCadId<CadDimensionId>('dimension');
const linear: CadLinearDimension = {
  id: linearId,
  type: 'linear',
  entityIds: [lineAId],
  value: 60,
  driving: true,
  name: 'width',
};
const diameter: CadDiameterDimension = {
  id: diameterId,
  type: 'diameter',
  entityIds: [circleId],
  value: 12,
  driving: true,
  name: 'diameter',
};

const sketch: CadSketch = {
  id: sketchId,
  name: 'Эскиз 1',
  support: 'XY',
  entities: [lineA, lineB, circle],
  constraintIds: [horizontalId, coincidentId],
  dimensionIds: [linearId, diameterId],
};
part.sketches.push(sketch);
part.constraints.push(horizontal, coincident);
part.dimensions.push(linear, diameter);

const serialized = serializeCadDocument(part);
const parsed = parseCadDocument(serialized);
assert.deepEqual(parsed, part, 'typed schema-v1 Sketch DTO must round-trip without wire-format changes');
assert.equal(parsed.kind, 'part');
if (parsed.kind !== 'part') throw new Error('expected part');
assert.equal(parsed.sketches[0]?.entities[0]?.type, 'line');
assert.equal(parsed.sketches[0]?.entities[2]?.type, 'circle');

function mutateAndReject(mutator: (value: any) => void, pattern: RegExp): void {
  const value = JSON.parse(serialized);
  mutator(value);
  assert.throws(() => parseCadDocument(JSON.stringify(value)), pattern);
}

mutateAndReject(
  (value) => { value.sketches[0].entities[0].type = 'mystery-curve'; },
  /entities\\[0\\]\\.type is unsupported/,
);
mutateAndReject(
  (value) => { value.sketches[0].entities[0].data.from = ['x', 0]; },
  /data\\.from\\[0\\] must be finite/,
);
mutateAndReject(
  (value) => { value.sketches[0].support = 'freeform-plane'; },
  /support must be XY, XZ, YZ or a stable reference id/,
);
mutateAndReject(
  (value) => { value.constraints[1].data.refs = [{ entityId: lineAId }]; },
  /data\\.refs must contain exactly two references/,
);
mutateAndReject(
  (value) => { value.dimensions[1].entityIds = [circleId, lineAId]; },
  /diameter requires exactly one entity id/,
);
mutateAndReject(
  (value) => { value.dimensions[0].type = 'mystery-dimension'; },
  /dimensions\\[0\\]\\.type is unsupported/,
);

const legacyCompatible = createEmptyCadDocument('part', { title: 'Legacy compatible' });
const legacySketchId = createCadId<CadSketchId>('sketch');
const legacyEntityId = createCadId<CadSketchEntityId>('entity');
const legacyJson = JSON.parse(serializeCadDocument(legacyCompatible));
legacyJson.sketches.push({
  id: legacySketchId,
  name: 'Эскиз 1',
  support: 'XY',
  entities: [{ id: legacyEntityId, type: 'line', data: { from: [0, 0], to: [10, 0] } }],
  constraintIds: [],
  dimensionIds: [],
});
const legacyParsed = parseCadDocument(JSON.stringify(legacyJson));
assert.equal(legacyParsed.kind, 'part');
assert.equal(legacyParsed.kind === 'part' ? legacyParsed.sketches.length : -1, 1);

console.log('M2O O7 typed Sketch DTO PASS (schema-v1 round-trip + strict malformed-shape rejection)');
`);

writeFileSync('tests/m2o/sketch-contract-boundary.mjs', `import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const sketchContract = readFileSync('src/contracts/sketch.ts', 'utf8');
const documentContract = readFileSync('src/contracts/document.ts', 'utf8');
const solverContract = readFileSync('src/contracts/sketchSolver.ts', 'utf8');
const solver = readFileSync('src/runtime/PlaneGCSSketchSolverRuntime.ts', 'utf8');
const handlers = readFileSync('src/application/commands/SketchCommandHandlers.ts', 'utf8');

assert.match(sketchContract, /type CadSketchEntity = CadSketchLineEntity \\| CadSketchCircleEntity/, 'Sketch entities must be a discriminated union');
assert.match(sketchContract, /support: CadSketchSupport/, 'Sketch support must not degrade to arbitrary string');
assert.match(sketchContract, /type CadConstraint =/, 'Sketch constraints must be a discriminated union');
assert.match(sketchContract, /type CadDimension =/, 'Sketch dimensions must be a discriminated union');
assert.match(sketchContract, /validateCadPartSketchCollections/, 'Sketch DTO runtime validator must exist');
assert.match(documentContract, /validateCadPartSketchCollections\\(value\\)/, 'CadDocument parser must validate Part Sketch DTOs');
assert.doesNotMatch(documentContract, /interface CadSketchEntity[\\s\\S]*type: string;[\\s\\S]*Record<string, unknown>/, 'legacy permissive Sketch entity contract must not return');
assert.doesNotMatch(documentContract, /interface CadConstraint[\\s\\S]*type: string;/, 'legacy permissive constraint contract must not return');
assert.doesNotMatch(documentContract, /interface CadDimension[\\s\\S]*type: string;/, 'legacy permissive dimension contract must not return');
assert.match(solverContract, /type CadSolvedSketchEntity = CadSketchEntity/, 'Solved entities must retain their discriminant');

assert.doesNotMatch(solver, /function point2\\(/, 'PlaneGCS adapter must not parse typed entity coordinates as unknown');
assert.doesNotMatch(solver, /function number\\(/, 'PlaneGCS adapter must not parse typed numeric entity fields as unknown');
assert.doesNotMatch(solver, /as StoredPointRef/, 'PlaneGCS adapter must consume typed constraint refs directly');
assert.match(solver, /switch \\(entity.type\\)/, 'PlaneGCS geometry conversion must narrow on entity discriminants');
assert.match(solver, /case 'coincident':/, 'PlaneGCS typed constraint boundary must retain current coincident support');
assert.match(solver, /case 'diameter':/, 'PlaneGCS typed dimension boundary must retain current diameter support');

assert.doesNotMatch(handlers, /function addConstraint\\([\\s\\S]*type: string/, 'Sketch handlers must not construct arbitrary string-typed constraints');
assert.doesNotMatch(handlers, /data\\?: Record<string, unknown>/, 'Sketch handlers must not construct arbitrary constraint payload maps');
assert.match(handlers, /const dimension: CadDimension =/, 'Sketch handlers must construct typed dimension DTOs');
assert.match(handlers, /const constraint: CadConstraint =/, 'Sketch handlers must construct typed constraint DTOs');
assert.doesNotMatch(handlers, /support: String\\(command\\.payload\\.support\\)/, 'Sketch support must retain its typed command value');

console.log('M2O O7 Sketch contract boundary PASS (typed DTOs + typed PlaneGCS/handler consumption)');
`);

patch('package.json', [
  [
    'O7 test script',
    '    "test:m2o:handlers": "node tests/m2o/application-handlers.mjs && node vendor/toubkal/node_modules/tsx/dist/cli.mjs tests/m2o/sketch-command-handlers.ts",\n    "test:m2o":',
    '    "test:m2o:handlers": "node tests/m2o/application-handlers.mjs && node vendor/toubkal/node_modules/tsx/dist/cli.mjs tests/m2o/sketch-command-handlers.ts",\n    "test:m2o:sketch-contracts": "node vendor/toubkal/node_modules/tsx/dist/cli.mjs tests/m2o/typed-sketch-dtos.ts && node tests/m2o/sketch-contract-boundary.mjs",\n    "test:m2o":',
  ],
  [
    'O7 test gate inclusion',
    'npm run test:m2o:decomposition && npm run test:m2o:handlers",',
    'npm run test:m2o:decomposition && npm run test:m2o:handlers && npm run test:m2o:sketch-contracts",',
  ],
]);

for (const path of [
  'scripts/m2o/apply-o7-sketch-contracts.mjs',
  '.github/workflows/m2o-o7-sketch-contracts-codemod.yml',
  'scripts/m2o/apply-o7-runtime-typing.mjs',
  '.github/workflows/m2o-o7-runtime-typing-codemod.yml',
]) {
  if (existsSync(path)) rmSync(path);
}

console.log('Applied O7 runtime typing fixes and removed one-shot codemods');
