import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const policy = JSON.parse(readFileSync('spec/process/ui-core-unification.v1.json', 'utf8'));
const health = JSON.parse(readFileSync('spec/process/repository-health.v1.json', 'utf8'));
const status = readFileSync('docs/STATUS.md', 'utf8');
const roadmap = readFileSync('docs/ROADMAP.md', 'utf8');
const spec = readFileSync('docs/UI_CORE_UNIFICATION_SPEC.md', 'utf8');

assert.equal(policy.schemaVersion, 1);
assert.equal(policy.initiative, 'UI-CORE-UNIFICATION-001');
assert.equal(policy.integrationBranch, 'integration/ui-core-unification');
assert.equal(policy.uiReference.pr, 170);
assert.equal(policy.uiReference.sha, '88c535c652dac8b04f0d68fa144cf8486afdc926');
assert.equal(policy.uiReference.tag, 'ui-reference-20261004');
assert.equal(policy.uiReference.frozen, true);
assert.equal(policy.uiReference.role, 'UI_UX_REFERENCE_ONLY');

assert.equal(policy.cadence.acceptedPermanentSlicesBeforeU1, 2);
assert.equal(policy.cadence.u1CountsAsOnePermanentSlice, true);
assert.equal(policy.cadence.acceptedPermanentSlicesAfterU1, 3);
assert.equal(policy.cadence.fullRepositoryHealthAuditRequiredImmediatelyAfterU1Acceptance, true);
assert.equal(policy.cadence.u2BlockedUntilAuditAccepted, true);
assert.equal(policy.cadence.u1CheckpointsDoNotIncrementCadenceSeparately, true);
assert.equal(health.auditCadence.fullAuditEveryAcceptedSlices, 3);
assert.equal(policy.preflight.maintenancePrerequisites.find((item) => item.pr === 181)?.mergeSha, '47aa4836adb30432adcb09609da93fb309125aa5');
assert.equal(policy.preflight.maintenancePrerequisites.find((item) => item.pr === 183)?.mergeSha, '27380d161210aaf309fa3a8c76109fb7038a3533');

assert.deepEqual(policy.u1.checkpoints.map((item) => item.id), ['U1A', 'U1B', 'U1C']);
assert.ok(policy.u1.checkpoints.every((item) => item.permanentSlice === false));
assert.equal(policy.u1.maxPermanentSlices, 1);

const reuse = new Map(policy.reuseMap.map((item) => [item.source, item]));
assert.equal(reuse.get('PR#170')?.decision, 'REFERENCE_ONLY');
assert.equal(reuse.get('PR#177')?.sha, '44d87bef78fd66aa0e85fa1fa7ba9dc58e280a65');
assert.equal(reuse.get('ARCHIVED-PR#182')?.sha, '27c55222331681d23ba101bd4992c9dc24a0ac42');
assert.equal(reuse.get('PR#179')?.decision, 'HOLD_NOT_INTEGRATION_BASE');

assert.match(status, /U1A|U1B|U1C/);
assert.match(status, /Full Repository Health Audit/i);
assert.match(roadmap, /U1A|U1B|U1C/);
assert.match(roadmap, /U2.*BLOCKED|U2.*audit/i);
assert.match(spec, /ui-reference-20261004/);
assert.match(spec, /U1A/);
assert.match(spec, /U1B/);
assert.match(spec, /U1C/);
assert.match(spec, /U2.*BLOCKED|U2.*audit/i);
assert.match(spec, /REUSE.*#177|#177.*REUSE/i);
assert.match(spec, /#182.*EXTRACT|EXTRACT.*#182/i);

for (const forbidden of policy.forbiddenPrototypeAuthorities) {
  assert.ok(forbidden.length > 0);
}

console.log('UI/core unification policy PASS');
