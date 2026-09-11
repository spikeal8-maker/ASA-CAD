import { readFileSync, writeFileSync, rmSync, existsSync } from 'node:fs';

function patch(path, replacements) {
  let source = readFileSync(path, 'utf8');
  for (const [label, before, after] of replacements) {
    if (!source.includes(before)) throw new Error(`Sketch solve-cycle codemod could not find ${label} in ${path}`);
    source = source.replace(before, after);
  }
  writeFileSync(path, source);
}

patch('src/runtime/PlaneGCSSketchSolverRuntime.ts', [
  [
    'PlaneGCS success DoF field',
    `        residual: result.residual,
        iterations: result.iterations,
        entities,`,
    `        residual: result.residual,
        iterations: result.iterations,
        // Current @salusoft89/planegcs wrapper does not expose solver rank/DoF.
        // Do not infer it from convergence; M3 may enrich the adapter later.
        degreesOfFreedom: null,
        entities,`,
  ],
  [
    'PlaneGCS failure DoF field',
    `      residual: Number.POSITIVE_INFINITY,
      iterations: 0,
      entities: [],`,
    `      residual: Number.POSITIVE_INFINITY,
      iterations: 0,
      degreesOfFreedom: null,
      entities: [],`,
  ],
]);

patch('src/index.ts', [[
  'SketchSolveSession public export',
  "export * from './application/CadApplicationImpl';\n",
  "export * from './application/CadApplicationImpl';\nexport * from './application/SketchSolveSession';\n",
]]);

patch('package.json', [
  [
    'Sketch solve-cycle test script',
    '    "test:m2o:sketch-session": "node vendor/toubkal/node_modules/tsx/dist/cli.mjs tests/m2o/sketch-session.ts",\n    "test:m2o":',
    '    "test:m2o:sketch-session": "node vendor/toubkal/node_modules/tsx/dist/cli.mjs tests/m2o/sketch-session.ts",\n    "test:m2o:solve-cycle": "node vendor/toubkal/node_modules/tsx/dist/cli.mjs tests/m2o/sketch-solve-session.ts && node tests/m2o/sketch-solve-boundary.mjs",\n    "test:m2o":',
  ],
  [
    'Sketch solve-cycle gate inclusion',
    'npm run test:m2o:semantics && npm run test:m2o:sketch-session",',
    'npm run test:m2o:semantics && npm run test:m2o:sketch-session && npm run test:m2o:solve-cycle",',
  ],
]);

for (const path of [
  'scripts/m2o/apply-sketch-solve-cycle.mjs',
  '.github/workflows/m2o-sketch-solve-cycle-codemod.yml',
]) {
  if (existsSync(path)) rmSync(path);
}

console.log('Applied Sketch solve-cycle wiring and removed one-shot codemod');
