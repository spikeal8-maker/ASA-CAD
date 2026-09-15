import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const policyPath = 'spec/process/repository-health.v1.json';
assert.ok(fs.existsSync(policyPath), `${policyPath} must remain present`);

const policy = JSON.parse(fs.readFileSync(policyPath, 'utf8'));
assert.equal(policy.schemaVersion, 1, 'Unsupported repository-health policy schema');

const frozenCeilings = new Map(
  Object.entries(policy.frozenCeilings ?? {}).map(([file, bytes]) => [file, Number(bytes)]),
);
const grandfatheredHardCeilings = new Map(
  Object.entries(policy.grandfatheredHardCeilings ?? {}).map(([file, bytes]) => [file, Number(bytes)]),
);
const policies = policy.fileBudgets ?? [];

const roots = ['AGENTS.md', 'docs', 'src/web', 'src/runtime', 'src/application', 'src/contracts', 'tests'];
const files = [];

for (const root of roots) {
  if (!fs.existsSync(root)) continue;
  const info = fs.statSync(root);
  if (info.isFile()) files.push(normalize(root));
  else walk(root, files);
}

const warnings = [];
const checked = new Set();

for (const file of files) {
  const normalized = normalize(file);
  const budget = policies.find((candidate) => matchesBudget(candidate, normalized));
  if (!budget) continue;

  const metrics = canonicalMetrics(file);
  checked.add(normalized);

  const frozen = frozenCeilings.get(normalized);
  if (frozen != null) {
    assert.equal(
      metrics.bytes,
      frozen,
      `${normalized} is ${metrics.bytes} canonical UTF-8 bytes but its frozen ratchet is ${frozen}. ` +
        'Frozen files may not regrow; if the file shrank, lower the machine-readable ceiling in the same PR.',
    );
  }

  const grandfathered = grandfatheredHardCeilings.get(normalized);
  const hard = frozen ?? grandfathered ?? Number(budget.hardBytes);
  assert.ok(
    metrics.bytes <= hard,
    `${normalized} is ${metrics.bytes} canonical UTF-8 bytes; ${budget.description} hard limit is ${hard}. Split the file into focused owners.`,
  );

  if (metrics.bytes > Number(budget.targetBytes)) {
    warnings.push(
      `${normalized}: ${metrics.bytes} canonical UTF-8 bytes > ${budget.targetBytes}-byte ${budget.description} target`,
    );
  }

  if (budget.lineReviewTarget != null && metrics.lines > Number(budget.lineReviewTarget)) {
    warnings.push(
      `${normalized}: ${metrics.lines} logical lines > ${budget.lineReviewTarget}-line ${budget.description} review target`,
    );
  }
}

for (const [file, ceiling] of frozenCeilings) {
  assert.ok(fs.existsSync(file), `Frozen hotspot disappeared from repository without updating policy: ${file}`);
  assert.ok(checked.has(file), `Frozen hotspot is no longer covered by a file-budget policy: ${file}`);
  assert.equal(
    canonicalMetrics(file).bytes,
    ceiling,
    `Frozen hotspot ratchet is stale for ${file}; keep the machine-readable ceiling equal to current canonical bytes.`,
  );
}

for (const [file, ceiling] of grandfatheredHardCeilings) {
  assert.ok(fs.existsSync(file), `Grandfathered file disappeared without updating policy: ${file}`);
  assert.ok(checked.has(file), `Grandfathered file is no longer covered by a file-budget policy: ${file}`);
  assert.ok(canonicalMetrics(file).bytes <= ceiling);
}

for (const warning of warnings) console.warn(`File budget warning: ${warning}`);

console.log(
  `ASA-CAD file budgets PASS (${checked.size} files checked; ${frozenCeilings.size} exact ratchets frozen; ${grandfatheredHardCeilings.size} hard-limit exceptions).`,
);

function matchesBudget(budget, file) {
  if (Array.isArray(budget.exactFiles) && budget.exactFiles.includes(file)) return true;
  if (Array.isArray(budget.exactFiles)) return false;
  if (budget.prefix && !file.startsWith(budget.prefix)) return false;
  if (budget.suffix && !file.endsWith(budget.suffix)) return false;
  if (Array.isArray(budget.extensions) && !budget.extensions.some((extension) => file.endsWith(extension))) {
    return false;
  }
  return Boolean(budget.prefix || budget.suffix || budget.extensions);
}

function canonicalMetrics(file) {
  const text = fs.readFileSync(file, 'utf8').replace(/\r\n?/g, '\n');
  return {
    bytes: Buffer.byteLength(text, 'utf8'),
    lines: text.length === 0 ? 0 : text.split('\n').length,
  };
}

function normalize(file) {
  return file.replaceAll('\\', '/');
}

function walk(root, output) {
  for (const entry of fs.readdirSync(root, { withFileTypes: true })) {
    const full = path.join(root, entry.name);
    if (entry.isDirectory()) walk(full, output);
    else if (entry.isFile()) output.push(normalize(full));
  }
}
