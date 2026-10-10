import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';

const policy = JSON.parse(readFileSync('spec/process/ui-core-unification.v1.json', 'utf8'));
const active = JSON.parse(readFileSync('spec/process/active-work.v1.json', 'utf8'));
const protection = policy.integrationProtection?.current;
const flow = policy.developmentFlow;
const current = active.currentCheckpoint;

// Historical command name retained for compatibility with existing build tasks.
// Now validates the active checkpoint's permanent owner authorization.
assert.ok(protection, 'integrationProtection.current must exist');
assert.ok(['ENFORCED', 'DETECT_ONLY'].includes(protection.mode), 'Unknown protection state');
if (protection.mode === 'DETECT_ONLY') {
  assert.equal(protection.adminProtectionVerified, false, 'Cannot claim admin enforcement while DETECT_ONLY');
  assert.equal(protection.risk, 'ADMIN_BRANCH_PROTECTION_NOT_ENFORCED');
} else {
  assert.equal(protection.adminProtectionVerified, true, 'ENFORCED must be verified');
}
assert.equal(protection.detectorWorkflow, '.github/workflows/ui-core-integration-guard.yml');

assert.equal(flow?.ownerAuthorization, 'OWNER_APPROVED_CONTINUOUS_ROADMAP_20261008');
assert.equal(flow.technicalCheckpointIntegrationAllowed, true);
assert.equal(flow.checkpointOwnerApprovalRequired, false);
assert.equal(flow.serverProtectionIsRiskNotProductReadinessGate, true);
assert.ok(flow.authorizedCheckpoints.includes(current), 'Current checkpoint needs permanent owner authorization');
assert.equal(active.developmentAuthorization, flow.ownerAuthorization);
assert.equal(active.baseBranch, flow.implementationBaseBranch);
assert.equal(active.nextCheckpoint, flow.nextCheckpointById[current], 'Invalid automatic transition');
assert.equal(active.blocker, null);
assert.equal(active.productCodeStartAllowed, current !== 'FULL_REPOSITORY_HEALTH_AUDIT');

for (const flag of [
  'pullRequestRequired', 'noDirectPush', 'noForcePush', 'exactHeadCIRequired',
  'independentReadOnlyReviewRequired', 'documentedAgentReviewWhenGithubApprovedUnavailable',
  'realOrdinaryUserFlowRequired', 'criticalFindingsMustBeZero', 'separateOwnerProductAcceptance',
]) assert.equal(flow.technicalGates[flag], true, 'Checkpoint cannot weaken technical gate ' + flag);

// Checkpoints after the mandatory audit need its machine-readable result in
// active-work: GREEN, or YELLOW explicitly accepted, with a committed report.
function checkpointsAfterAudit() {
  const after = [];
  let seenAudit = false;
  for (let id = 'U1A'; id; id = flow.nextCheckpointById[id]) {
    if (seenAudit) after.push(id);
    if (id === 'FULL_REPOSITORY_HEALTH_AUDIT') seenAudit = true;
  }
  return after;
}
function assertAuditGate(work) {
  if (!checkpointsAfterAudit().includes(work.currentCheckpoint)) return;
  const audit = work.fullRepositoryHealthAudit;
  assert.ok(audit, work.currentCheckpoint + ' requires fullRepositoryHealthAudit result in active-work');
  assert.ok(['GREEN', 'YELLOW_ACCEPTED'].includes(audit.outcome), 'Audit outcome must be GREEN or YELLOW_ACCEPTED, got ' + audit.outcome);
  if (audit.outcome === 'YELLOW_ACCEPTED') assert.ok(audit.acceptedBy, 'Accepted YELLOW audit must name who accepted it');
  assert.match(String(audit.auditedSha), /^[0-9a-f]{40}$/, 'Audit must name the exact audited SHA');
  assert.ok(typeof audit.report === 'string' && existsSync(audit.report), 'Audit report must be committed: ' + audit.report);
}
assert.deepEqual(checkpointsAfterAudit(), ['U2', 'U3', 'U4', 'U5']);
assertAuditGate(active);
assert.throws(() => assertAuditGate({ ...active, currentCheckpoint: 'U2', fullRepositoryHealthAudit: undefined }),
  /requires fullRepositoryHealthAudit/, 'U2 without an audit result must be rejected');
assert.throws(() => assertAuditGate({ ...active, currentCheckpoint: 'U3',
  fullRepositoryHealthAudit: { outcome: 'RED', auditedSha: '0'.repeat(40), report: 'docs/STATUS.md' } }),
  /GREEN or YELLOW_ACCEPTED/, 'RED audit must block U2+');

assert.equal(flow.mandatoryAuditAfterU1, true);
assert.equal(flow.auditYellowProceedOnlyWhenAccepted, true);
assert.equal(flow.auditRedRequiresRepair, true);
assert.ok(flow.ownerProductDecisionsRequiredFor.includes('integration-to-main'));
assert.ok(flow.ownerProductDecisionsRequiredFor.includes('production-deployment'));
assert.ok(flow.ownerProductDecisionsRequiredFor.includes('final-visual-parity'));
assert.deepEqual(policy.integrationProtection.desired.requiredGeneralChecks,
  ['shell-build', 'vendor-baseline', 'asa-m1', 'asa-m1b']);
assert.equal(policy.integrationProtection.desired.pullRequestRequired, true);
assert.equal(policy.integrationProtection.desired.directPushForbidden, true);
assert.equal(policy.integrationProtection.desired.adminEnforcementRequired, true);

console.log('UI/core checkpoint readiness PASS (' + current + '; permanent owner flow; protection=' + protection.mode + ')');
