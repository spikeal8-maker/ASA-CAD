import { readFileSync, writeFileSync, rmSync, existsSync } from 'node:fs';

function patch(path, replacements) {
  let source = readFileSync(path, 'utf8');
  for (const [label, before, after] of replacements) {
    if (!source.includes(before)) throw new Error(`Semantic validation codemod could not find ${label} in ${path}`);
    source = source.replace(before, after);
  }
  writeFileSync(path, source);
}

patch('src/contracts/document.ts', [
  [
    'semantic validator import',
    "import { validateCadPartSketchCollections } from './sketch';\n",
    "import { validateCadPartSketchCollections } from './sketch';\nimport { validateCadPartSemantics } from './partSemantics';\n",
  ],
  [
    'semantic validator invocation',
    "  if (document.kind === 'part') {\n    validateCadPartSketchCollections(value);\n  }",
    "  if (document.kind === 'part') {\n    validateCadPartSketchCollections(value);\n    validateCadPartSemantics(value as CadPartDocument);\n  }",
  ],
]);

patch('package.json', [
  [
    'semantic validation test script',
    '    "test:m2o:sketch-contracts": "node vendor/toubkal/node_modules/tsx/dist/cli.mjs tests/m2o/typed-sketch-dtos.ts && node tests/m2o/sketch-contract-boundary.mjs",\n    "test:m2o":',
    '    "test:m2o:sketch-contracts": "node vendor/toubkal/node_modules/tsx/dist/cli.mjs tests/m2o/typed-sketch-dtos.ts && node tests/m2o/sketch-contract-boundary.mjs",\n    "test:m2o:semantics": "node vendor/toubkal/node_modules/tsx/dist/cli.mjs tests/m2o/semantic-document-validation.ts",\n    "test:m2o":',
  ],
  [
    'semantic validation test gate',
    'npm run test:m2o:handlers && npm run test:m2o:sketch-contracts",',
    'npm run test:m2o:handlers && npm run test:m2o:sketch-contracts && npm run test:m2o:semantics",',
  ],
]);

for (const path of [
  'scripts/m2o/apply-semantic-validation.mjs',
  '.github/workflows/m2o-semantic-validation-codemod.yml',
]) {
  if (existsSync(path)) rmSync(path);
}

console.log('Applied semantic validation wiring and removed one-shot codemod');
