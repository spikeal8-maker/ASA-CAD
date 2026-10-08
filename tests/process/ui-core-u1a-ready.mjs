import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const policy = JSON.parse(readFileSync('spec/process/ui-core-unification.v1.json', 'utf8'));
const active = JSON.parse(readFileSync('spec/process/active-work.v1.json', 'utf8'));
const protection = policy.integrationProtection?.current;
const exception = policy.u1aDevelopmentException;

assert.ok(protection, 'integrationProtection.current must exist');
assert.equal(protection.mode, 'DETECT_ONLY', 'The U1A exception must never pretend that GitHub Ruleset is active');
assert.equal(protection.adminProtectionVerified, false);
assert.equal(protection.detectorWorkflow, '.github/workflows/ui-core-integration-guard.yml');
assert.equal(protection.risk, 'ADMIN_BRANCH_PROTECTION_NOT_ENFORCED');
assert.equal(protection.blocker, null, 'Known risk is not a U1A development blocker');
assert.equal(protection.u1aStartAllowed, true);

assert.equal(exception?.id, 'OWNER_APPROVED_U1A_DETECT_ONLY_PR_FLOW');
assert.equal(exception.authorizedBy, 'OWNER');
assert.equal(exception.checkpoint, 'U1A');
assert.equal(exception.sourceBranch, 'ui-core/u1a-shell');
assert.equal(exception.targetBranch, 'integration/ui-core-unification');
assert.equal(exception.draftPullRequestRequired, true);
assert.equal(exception.exactHeadCIRequired, true);
assert.equal(exception.independentTechnicalReviewRequired, true);
assert.equal(exception.ownerVisualAcceptanceBeforeMerge, true);
assert.equal(exception.appliesToOtherCheckpoints, false);
assert.equal(exception.serverProtectionNotClaimed, true);

assert.equal(active.initiative, 'UI-CORE-UNIFICATION-001');
assert.equal(active.currentCheckpoint, 'U1A');
assert.equal(active.baseBranch, exception.targetBranch);
assert.equal(active.u1aDevelopmentException, exception.id);
assert.equal(active.productCodeStartAllowed, true);
assert.equal(active.blocker, null);
assert.equal(active.nextCheckpoint, 'U1B');
assert.equal(policy.u1.checkpoints.find((checkpoint) => checkpoint.id === 'U1B')?.permanentSlice, false);
assert.deepEqual(policy.integrationProtection.desired.requiredGeneralChecks, [
  'shell-build', 'vendor-baseline', 'asa-m1', 'asa-m1b',
]);
assert.equal(policy.integrationProtection.desired.pullRequestRequired, true);
assert.equal(policy.integrationProtection.desired.directPushForbidden, true);
assert.equal(policy.integrationProtection.desired.adminEnforcementRequired, true);

console.log('UI/core U1A readiness PASS (owner-approved U1A-only Draft PR exception; protection DETECT_ONLY)');
