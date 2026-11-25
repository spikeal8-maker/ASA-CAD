import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire, isBuiltin } from 'node:module';
import { flags, hash, hashFile, outsideRepo, sourceIdentity } from './performance-common.mjs';

const args = flags(process.argv.slice(2), ['--repo', '--expected-head', '--audit', '--out']);
const repo = fs.realpathSync(args['--repo']);
const output = outsideRepo(repo, args['--out']);
assert.equal(fs.existsSync(output), false, 'Evidence output must be fresh');
const before = sourceIdentity(repo, args['--expected-head']);
const auditPath = path.resolve(args['--audit']);
const auditBytes = fs.readFileSync(auditPath);
const audit = JSON.parse(auditBytes);
const lockPath = path.join(repo, 'vendor/toubkal/package-lock.json');
const lock = JSON.parse(fs.readFileSync(lockPath));
const packagePath = path.join(repo, 'vendor/toubkal/package.json');
const rootPackage = JSON.parse(fs.readFileSync(packagePath));
const require = createRequire(packagePath);
const semver = require('semver');
const ts = require('typescript');
const packages = lock.packages;
const affectedNodes = new Set(Object.values(audit.vulnerabilities).flatMap(value => value.nodes));

function resolvePackage(from, name) {
  let parent = from;
  while (true) {
    const key = (parent ? parent + '/' : '') + 'node_modules/' + name;
    if (packages[key]) return key;
    if (!parent) return null;
    const nested = parent.lastIndexOf('/node_modules/');
    parent = nested >= 0 ? parent.slice(0, nested) : '';
  }
}
function children(key) {
  const current = packages[key] ?? {};
  const result = [];
  for (const kind of ['dependencies', 'optionalDependencies', 'peerDependencies']) {
    for (const [name, requested] of Object.entries(current[kind] ?? {})) {
      const target = resolvePackage(key, name);
      if (target) result.push({ name, requested, kind, key: target, version: packages[target].version });
    }
  }
  return result;
}
function routes(name) {
  const start = resolvePackage('', name);
  if (!start) return new Map();
  const root = { name, key: start, version: packages[start].version, kind: 'declared-root' };
  const found = new Map([[start, [root]]]);
  const queue = [start];
  for (let i = 0; i < queue.length; i++) {
    for (const edge of children(queue[i])) if (!found.has(edge.key)) {
      found.set(edge.key, [...found.get(queue[i]), edge]);
      queue.push(edge.key);
    }
  }
  return found;
}
const roots = {
  production: Object.keys(rootPackage.dependencies ?? {}),
  development: Object.keys(rootPackage.devDependencies ?? {}),
};
const routeSets = Object.fromEntries(Object.entries(roots).map(([kind, names]) => [kind, names.map(name => ({ root: name, paths: routes(name) }))]));
function rootPaths(node, kind) {
  return routeSets[kind].filter(entry => entry.paths.has(node)).map(entry => ({ root: entry.root, route: entry.paths.get(node) }));
}

const entry = path.join(repo, 'src/web/index.tsx');
const visited = new Set(), npmImports = new Map(), unresolved = [];
const npmName = name => name.startsWith('@') ? name.split('/').slice(0, 2).join('/') : name.split('/')[0];
function addNpm(name, importer, specifier) {
  const root = npmName(name);
  if (!npmImports.has(root)) npmImports.set(root, []);
  npmImports.get(root).push({ importer: path.relative(repo, importer).replaceAll('\\', '/'), specifier });
}
function resolveFile(candidate) {
  for (const file of [
    candidate, ...['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs', '.json', '.css', '.svg', '.wasm'].map(ext => candidate + ext),
    ...['index.ts', 'index.tsx', 'index.js', 'index.mjs'].map(name => path.join(candidate, name)),
  ]) if (fs.existsSync(file) && fs.statSync(file).isFile()) return path.resolve(file);
  if (/\.[mc]?js$/.test(candidate)) {
    const typed = candidate.replace(/\.[mc]?js$/, '.ts');
    if (fs.existsSync(typed)) return typed;
  }
  return null;
}
const queue = [entry];
for (let cursor = 0; cursor < queue.length; cursor++) {
  const file = queue[cursor];
  if (visited.has(file)) continue;
  visited.add(file);
  const content = fs.readFileSync(file, 'utf8');
  if (!/\.[cm]?[jt]sx?$/.test(file)) continue;
  for (const imported of ts.preProcessFile(content, true, true).importedFiles) {
    const specifier = imported.fileName;
    if (isBuiltin(specifier) || specifier.startsWith('node:')) continue;
    if (!specifier.startsWith('.') && !path.isAbsolute(specifier)) { addNpm(specifier, file, specifier); continue; }
    const candidate = path.resolve(path.dirname(file), specifier.replace(/\?.*$/, ''));
    const normalized = candidate.replaceAll('\\', '/');
    const marker = normalized.lastIndexOf('/node_modules/');
    if (marker >= 0) { addNpm(normalized.slice(marker + '/node_modules/'.length), file, specifier); continue; }
    const resolved = resolveFile(candidate);
    if (resolved) queue.push(resolved);
    else unresolved.push({ importer: path.relative(repo, file).replaceAll('\\', '/'), specifier });
  }
}
const runtimeRoots = [...npmImports].sort(([a], [b]) => a.localeCompare(b)).map(([name, imports]) => {
  const reachable = routes(name);
  return {
    name, key: resolvePackage('', name), version: packages[resolvePackage('', name)]?.version,
    importSites: imports, reachableAffected: [...reachable].filter(([key]) => affectedNodes.has(key)).map(([key, route]) => ({ key, route })),
  };
});

const byAdvisory = new Map();
const entries = Object.values(audit.vulnerabilities).map(value => {
  const direct = value.via.filter(item => typeof item === 'object');
  for (const advisory of direct) {
    const current = byAdvisory.get(advisory.url) ?? { ...advisory, ghsa: advisory.url.split('/').at(-1), affectedPackageEntries: [] };
    current.affectedPackageEntries.push(value.name);
    byAdvisory.set(advisory.url, current);
  }
  return {
    package: value.name, npmAggregateSeverity: value.severity, isDirect: value.isDirect,
    auditRange: value.range, effects: value.effects, directAdvisoryUrls: direct.map(item => item.url),
    inheritedViaPackages: value.via.filter(item => typeof item === 'string'),
    fixAvailableCaptured: value.fixAvailable,
    nodes: value.nodes.map(key => {
      const installed = packages[key];
      assert.ok(installed, 'Reported node missing from lock: ' + key);
      const matches = semver.satisfies(installed.version, value.range, { includePrerelease: true });
      assert.equal(matches, true, 'Captured report range does not match locked version');
      return {
        key, version: installed.version, lockDev: installed.dev ?? false,
        lockOptional: installed.optional ?? false, lockPeer: installed.peer ?? false, affectedRangeMatches: matches,
        productionRootPaths: rootPaths(key, 'production'), developmentRootPaths: rootPaths(key, 'development'),
        mainEntryRuntimePaths: runtimeRoots.flatMap(root => root.reachableAffected.filter(item => item.key === key).map(item => ({ root: root.name, route: item.route }))),
      };
    }),
  };
});
const advisories = [...byAdvisory.values()].sort((a, b) => a.ghsa.localeCompare(b.ghsa));
const directSeverity = {};
for (const advisory of advisories) directSeverity[advisory.severity] = (directSeverity[advisory.severity] ?? 0) + 1;
const dockerBytes = fs.readFileSync(path.join(repo, 'Dockerfile'));
const docker = dockerBytes.toString();
const fromLines = docker.match(/^FROM .+$/gm) ?? [];
const finalStage = docker.slice(docker.lastIndexOf('\nFROM ') + 1);
const primary = [
  ['GHSA-rgw5-rvv9-x895', 'brace-expansion', 'Crafted brace expansion can exhaust memory or CPU', 'turn3view0'],
  ['GHSA-c83g-rgw3-j3cx', 'browserslist', 'Unbounded distinct query/context cache can exhaust memory', 'turn3view1'],
  ['GHSA-qw65-cvwx-89v3', 'fast-uri', 'Authority injection requires untrusted URI component input, especially port', 'turn3view2'],
  ['GHSA-mrhx-c7xc-m3w5', 'zod', 'Large failing collection validation can allocate excessive issue objects', 'turn3view3'],
  ['GHSA-g3hv-75wg-m249', 'minimatch', 'Attacker-controlled patterns amplify work with relevant optimization setting', 'turn3view4'],
  ['GHSA-3g3m-2fjr-6pw4', 'glob', 'Aborted asynchronous traversal can continue filesystem work', 'turn3view5'],
  ['GHSA-w5vr-8v7q-w6rv', 'baseline-browser-mapping', 'Invalid/conflicting inputs can terminate the process', 'turn3view6'],
].map(([ghsa, packageName, inputCondition, retrievalReference]) => ({
  ghsa, package: packageName, url: 'https://github.com/advisories/' + ghsa,
  primarySource: 'GitHub Advisory Database, GitHub-reviewed page',
  reviewedOn: '2026-11-07', retrievalReference, inputCondition,
  scope: 'Confirms advisory input condition, not ASA reachability or exploitation',
}));
const questionableSuggestions = entries.filter(item => typeof item.fixAvailableCaptured === 'object').map(item => {
  const fix = item.fixAvailableCaptured;
  const current = rootPackage.devDependencies?.[fix.name] ?? rootPackage.dependencies?.[fix.name];
  const locked = packages['node_modules/' + fix.name]?.version;
  return {
    reportedPackage: item.package, suggestedPackage: fix.name, suggestedVersion: fix.version,
    installedVersion: locked, declaredRange: current, isSemVerMajorCaptured: fix.isSemVerMajor,
    isDowngrade: locked ? semver.lt(fix.version, locked) : null,
    withinDeclaredRange: current ? semver.satisfies(fix.version, current) : null,
  };
});
const after = sourceIdentity(repo, args['--expected-head']);
assert.equal(after.fingerprint, before.fingerprint, 'Source/lock/runtime assets changed during classification');
const report = {
  schemaVersion: 1, generatedAt: new Date().toISOString(), status: 'ANALYZED_FINDINGS_REMAIN_OPEN',
  repo, sourceHead: before.head, sourceFingerprintBefore: before.fingerprint, sourceFingerprintAfter: after.fingerprint, checkoutCleanBeforeAndAfter: true,
  capturedAudit: { path: auditPath, sha256: hash(auditBytes), bytes: auditBytes.length, fileModifiedAt: fs.statSync(auditPath).mtime.toISOString(), auditReportVersion: audit.auditReportVersion, metadata: audit.metadata },
  lock: before.lock,
  counts: { affectedPackageEntries: entries.length, distinctDirectAdvisories: advisories.length, directAdvisorySeverity: directSeverity, npmAggregatePackageSeverity: audit.metadata.vulnerabilities, directAdvisoryLeafPackages: new Set(advisories.map(item => item.name)).size },
  dependencyGraph: { lockfileVersion: lock.lockfileVersion, lockedEntriesIncludingRoot: Object.keys(packages).length, roots, edgeKindsIncluded: ['dependencies', 'optionalDependencies', 'peerDependencies'], pathSemantics: 'One shortest discovered installed-lock path per declared root; peers are conservative reachability, not proof of execution' },
  affectedPackages: entries, uniqueDirectAdvisories: advisories,
  mainProductImportGraph: {
    entry: 'src/web/index.tsx', sourceFileCount: visited.size,
    sourceFiles: [...visited].sort().map(file => ({ path: path.relative(repo, file).replaceAll('\\', '/'), sha256: hashFile(file) })),
    unresolvedLiteralImports: unresolved, npmRoots: runtimeRoots,
    reachableAffectedNodes: [...new Set(runtimeRoots.flatMap(root => root.reachableAffected.map(item => item.key)))],
    parser: 'TypeScript preProcessFile with literal/dynamic literal imports and JS require detection; conservative type-only inclusion',
  },
  packaging: {
    dockerfileSha256: hash(dockerBytes), stages: fromLines, finalStageCopies: finalStage.split('\n').filter(line => line.startsWith('COPY ')),
    finalStageContainsNodeModulesCopy: /^COPY .*node_modules/m.test(finalStage),
    asaBuildConfiguration: { path: 'build/rspack.asa.config.cjs', sha256: hashFile(path.join(repo, 'build/rspack.asa.config.cjs')), compiler: 'Rspack', entry: 'src/web/index.tsx' },
    lintConfiguration: { path: 'vendor/toubkal/eslint.config.js', sha256: hashFile(path.join(repo, 'vendor/toubkal/eslint.config.js')) },
    note: 'opencascade.js is declared dev but actually imported at runtime; classification therefore uses source reachability, not lock.dev alone',
  },
  primaryAdvisoryReviews: primary, fixSuggestionsRequiringCompatibilityReview: questionableSuggestions,
  limitations: [
    'Counts/severities are from the captured npm audit report; no new npm audit or npm audit fix was executed',
    'Seven representative primary advisory pages reviewed; remaining advisory details are attributed to captured report',
    'No application SSRF, code execution or denial-of-service exploit is claimed from package presence alone',
    'No built-bundle execution/instrumentation or exploit test performed',
    'Static graph does not resolve arbitrary nonliteral dynamic imports or externally supplied code',
    'Installed peer dependency path does not prove that library executes under Rspack',
    'Toolchain/lint/build/clean exposure remains; dev-only classification does not grant a high-severity exception',
    'No package/lock/product/workflow edits, install, upgrade, override, audit fix or automatic remediation',
  ],
};
fs.writeFileSync(output, JSON.stringify(report, null, 2) + '\n', { flag: 'wx' });
console.log(JSON.stringify({ output, sha256: hashFile(output), bytes: fs.statSync(output).size, counts: report.counts, sourceFileCount: visited.size, unresolved: unresolved.length, runtimeAffectedNodes: report.mainProductImportGraph.reachableAffectedNodes, sourceUnchanged: before.fingerprint === after.fingerprint }, null, 2));
