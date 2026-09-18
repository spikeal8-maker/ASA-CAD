import assert from 'node:assert/strict';
import fs from 'node:fs';

const registry = JSON.parse(fs.readFileSync('spec/ui/command-registry.v1.json', 'utf8'));
const gates = JSON.parse(fs.readFileSync('spec/process/milestone-gates.v1.json', 'utf8'));
const health = JSON.parse(fs.readFileSync('spec/process/repository-health.v1.json', 'utf8'));

const registryIds = new Set(registry.commands.map((command) => command.id));
const required = new Set(gates.m3.requiredCommandIds);
const extension = new Set(gates.m3.extensionCommandIds);

for (const id of required) assert.ok(registryIds.has(id), `M3 required command missing from registry: ${id}`);
for (const id of extension) assert.ok(registryIds.has(id), `M3 extension command missing from registry: ${id}`);
for (const id of required) assert.equal(extension.has(id), false, `M3 command classified twice: ${id}`);

const sketchIds = registry.commands
  .filter((command) => command.workspace === 'sketch')
  .map((command) => command.id);
const unclassified = sketchIds.filter((id) => !required.has(id) && !extension.has(id));
assert.deepEqual(unclassified, [], `Unclassified Sketch command(s): ${unclassified.join(', ')}`);

assert.equal(
  health.auditCadence.fullAuditEveryAcceptedSlices,
  3,
  'Full Repository Health Audit cadence must remain iteration-based at three accepted slices',
);

assert.ok(gates.m3.requiredCapabilities.includes('non-null meaningful DOF feedback'));
assert.ok(gates.gateBCloseout.requires.includes('M2V KOMPAS visual acceptance'));
assert.ok(gates.gateBCloseout.requires.includes('M3X shared ASA-CAD/ASA-Lab golden contract green'));
assert.ok(gates.gateBCloseout.requires.includes('M3M-009 closed'));
assert.ok(gates.preM4PerformanceBaselines.length >= 4);
assert.ok(gates.m4TopologyCorpus.some((item) => item.includes('never silently bind')));
assert.equal(gates.publicBeta.rootLicenseRequired, true);
assert.equal(gates.publicBeta.thirdPartyNoticeRequired, true);

console.log('ASA-CAD milestone gate policy PASS');
