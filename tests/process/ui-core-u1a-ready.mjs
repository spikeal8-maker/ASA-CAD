import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

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
