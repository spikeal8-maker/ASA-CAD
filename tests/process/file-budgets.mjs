import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const KB = 1024;

const frozenCeilings = new Map([
  ['src/web/App.tsx', 31_555],
  ['src/web/CadViewport.tsx', 27_846],
  ['src/web/usePartSketchWorkspace.ts', 26_745],
  ['src/web/PartModelStage.tsx', 9_179],
  ['src/web/styles.css', 22_588],
  ['src/runtime/OpenCascadePartRuntime.ts', 20_347],
  ['src/application/commands/SketchCommandHandlers.ts', 15_384],
]);

const policies = [
  {
    name: 'agent entry/status document',
    target: 5 * KB,
    hard: 8 * KB,
    matches: (file) => file === 'AGENTS.md' || file === 'docs/STATUS.md',
  },
  {
    name: 'focused narrative spec',
    target: 12 * KB,
    hard: 20 * KB,
    matches: (file) => file.startsWith('docs/') && file.endsWith('.md'),
  },
  {
    name: 'Sketch command handler',
    target: 10 * KB,
    hard: 16 * KB,
    matches: (file) => file.startsWith('src/application/commands/') && file.endsWith('.ts'),
  },
  {
    name: 'runtime/adapter',
    target: 14 * KB,
    hard: 24 * KB,
    matches: (file) => file.startsWith('src/runtime/') && file.endsWith('.ts'),
  },
  {
    name: 'UI/controller',
    target: 10 * KB,
    hard: 20 * KB,
    matches: (file) => file.startsWith('src/web/') && /\.(?:ts|tsx)$/.test(file),
  },
  {
    name: 'domain CSS',
    target: 10 * KB,
    hard: 20 * KB,
    matches: (file) => file.startsWith('src/web/') && file.endsWith('.css'),
  },
  {
    name: 'M3 browser regression',
    target: 8 * KB,
    hard: 14 * KB,
    matches: (file) => file.startsWith('tests/m3/') && file.endsWith('-browser.mjs'),
  },
];

const policyGrandfathering = new Map([
  ['docs/UI_COMMAND_SPEC.md', 31_166],
]);

const roots = ['AGENTS.md', 'docs', 'src/web', 'src/runtime', 'src/application/commands', 'tests/m3'];
const files = [];

for (const root of roots) {
  if (!fs.existsSync(root)) continue;
  const info = fs.statSync(root);
  if (info.isFile()) files.push(root.replaceAll('\\', '/'));
  else walk(root, files);
}

const warnings = [];
const checked = new Set();

for (const file of files) {
  const normalized = file.replaceAll('\\', '/');
  const policy = policies.find((candidate) => candidate.matches(normalized));
  if (!policy) continue;

  const size = fs.statSync(file).size;
  checked.add(normalized);

  const frozen = frozenCeilings.get(normalized);
  if (frozen != null) {
    assert.ok(
      size <= frozen,
      `${normalized} grew to ${size} bytes; frozen maintenance ceiling is ${frozen}. Extract responsibility instead of raising the ceiling.`,
    );
  }

  const grandfathered = policyGrandfathering.get(normalized);
  const hard = frozen ?? grandfathered ?? policy.hard;
  assert.ok(
    size <= hard,
    `${normalized} is ${size} bytes; ${policy.name} hard limit is ${hard}. Split the file into focused owners.`,
  );

  if (size > policy.target) {
    warnings.push(`${normalized}: ${size} bytes > ${policy.target}-byte ${policy.name} target`);
  }
}

for (const [file, ceiling] of frozenCeilings) {
  assert.ok(checked.has(file), `Frozen hotspot disappeared from budget scan: ${file}`);
  const size = fs.statSync(file).size;
  assert.ok(size <= ceiling);
}

for (const warning of warnings) console.warn(`File budget warning: ${warning}`);

console.log(
  `ASA-CAD file budgets PASS (${checked.size} files checked; ${frozenCeilings.size} hotspots frozen).`,
);

function walk(root, output) {
  for (const entry of fs.readdirSync(root, { withFileTypes: true })) {
    const full = path.join(root, entry.name);
    if (entry.isDirectory()) walk(full, output);
    else if (entry.isFile()) output.push(full.replaceAll('\\', '/'));
  }
}
