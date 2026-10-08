import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';

const policy = JSON.parse(readFileSync('spec/process/ui-core-unification.v1.json', 'utf8'));
const health = JSON.parse(readFileSync('spec/process/repository-health.v1.json', 'utf8'));
const status = readFileSync('docs/STATUS.md', 'utf8');
const roadmap = readFileSync('docs/ROADMAP.md', 'utf8');
const spec = readFileSync('docs/UI_CORE_UNIFICATION_SPEC.md', 'utf8');
const visualSpec = readFileSync('docs/VISUAL_REFERENCE_SPEC.md', 'utf8');
const u1aMap = readFileSync('docs/UI_CORE_U1A_MAPPING.md', 'utf8');
const canonicalUtf8Bytes = (path) => Buffer.byteLength(readFileSync(path, 'utf8').replace(/\r\n/g, '\n'), 'utf8');

const integrationWorkflows = [
  '.github/workflows/baseline.yml',
  '.github/workflows/m2-shell.yml',
  '.github/workflows/m2-browser.yml',
  '.github/workflows/m3-browser.yml',
  '.github/workflows/docker.yml',
  '.github/workflows/owner-screenshot-capture.yml',
];

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

assert.equal(
  policy.preflight.maintenancePrerequisites.find((item) => item.pr === 181)?.mergeSha,
  '47aa4836adb30432adcb09609da93fb309125aa5',
);
assert.equal(
  policy.preflight.maintenancePrerequisites.find((item) => item.pr === 183)?.mergeSha,
  '27380d161210aaf309fa3a8c76109fb7038a3533',
);

assert.deepEqual(policy.u1.checkpoints.map((item) => item.id), ['U1A', 'U1B', 'U1C']);
assert.ok(policy.u1.checkpoints.every((item) => item.permanentSlice === false));
assert.equal(policy.u1.maxPermanentSlices, 1);

const reuse = new Map(policy.reuseMap.map((item) => [item.source, item]));
assert.equal(reuse.get('PR#170')?.decision, 'REFERENCE_ONLY');
assert.equal(reuse.get('PR#177')?.sha, '44d87bef78fd66aa0e85fa1fa7ba9dc58e280a65');
assert.equal(reuse.get('ARCHIVED-PR#182')?.sha, '27c55222331681d23ba101bd4992c9dc24a0ac42');
assert.equal(reuse.get('PR#179')?.decision, 'HOLD_NOT_INTEGRATION_BASE');

assert.equal(policy.integrationProtection.current.mode, 'DETECT_ONLY');
assert.equal(policy.integrationProtection.current.adminProtectionVerified, false);
assert.equal(policy.integrationProtection.current.u1aStartAllowed, true);
assert.equal(policy.integrationProtection.current.risk, 'ADMIN_BRANCH_PROTECTION_NOT_ENFORCED');
assert.equal(policy.u1aDevelopmentException.id, 'OWNER_APPROVED_U1A_DETECT_ONLY_PR_FLOW');
assert.equal(policy.u1aDevelopmentException.checkpoint, 'U1A');
assert.equal(policy.u1aDevelopmentException.authorizedBy, 'OWNER');
assert.equal(policy.u1aDevelopmentException.targetBranch, 'integration/ui-core-unification');
assert.equal(policy.u1aDevelopmentException.draftPullRequestRequired, true);
assert.equal(policy.u1aDevelopmentException.exactHeadCIRequired, true);
assert.equal(policy.u1aDevelopmentException.independentTechnicalReviewRequired, true);
assert.equal(policy.u1aDevelopmentException.ownerVisualAcceptanceBeforeMerge, true);
assert.equal(policy.u1aDevelopmentException.appliesToOtherCheckpoints, false);
assert.equal(policy.u1aDevelopmentException.serverProtectionNotClaimed, true);
assert.equal(policy.integrationProtection.current.blocker, null);
assert.equal(policy.integrationProtection.desired.pullRequestRequired, true);
assert.equal(policy.integrationProtection.desired.directPushForbidden, true);
assert.equal(policy.integrationProtection.desired.adminEnforcementRequired, true);
assert.deepEqual(policy.integrationProtection.desired.requiredGeneralChecks, ['shell-build', 'vendor-baseline', 'asa-m1', 'asa-m1b']);

assert.equal(policy.u1a.mappingDocument, 'docs/UI_CORE_U1A_MAPPING.md');
assert.equal(policy.u1a.visualEvidenceWorkflow, '.github/workflows/ui-core-u1-visual.yml');
assert.equal(policy.u1a.visualEvidenceScript, 'tests/visual/ui-core-u1-capture.mjs');
assert.deepEqual(policy.u1a.referenceStates, [
  'light-solid-1600x900',
  'light-surfaces-1600x900',
  'light-solid-1366x768',
  'dark-solid-1600x900-reference-only',
]);
assert.deepEqual(policy.u1a.candidateAcceptanceStates, [
  'light-solid-1600x900',
  'light-surfaces-1600x900',
  'light-solid-1366x768',
]);
assert.ok(policy.u1a.noTouchOwners.includes('src/web/CadViewport.tsx'));
assert.ok(policy.u1a.noTouchOwners.includes('src/web/ParameterPanel.tsx'));
assert.ok(policy.u1a.noGrowthOwners.includes('src/web/App.tsx'));
assert.ok(policy.u1a.noGrowthOwners.includes('src/web/responsive.css'));
assert.equal(policy.u1a.checkpointCompleteDoesNotEqualU1Accepted, true);
assert.equal(policy.u1a.ownerVisualAcceptanceRequired, true);

assert.deepEqual(policy.u1a.themeContract.referenceThemes, ['light', 'dark']);
assert.deepEqual(policy.u1a.themeContract.currentProductThemes, ['light']);
assert.deepEqual(policy.u1a.themeContract.u1aAcceptanceThemes, ['light']);
assert.equal(policy.u1a.themeContract.darkThemeParity, 'DEFERRED_NOT_U1A');
assert.equal(policy.u1a.themeContract.noFakeDarkThemeInU1A, true);
assert.equal(policy.u1a.themeContract.mustBeResolvedBeforeOverallVisualParityClaim, true);

assert.deepEqual(
  policy.u1a.semanticRegionContract.map((item) => item.key),
  ['topShell', 'menuItems', 'commandSearch', 'documentTabs', 'activeDocumentTab', 'instrumentArea', 'toolsets', 'ribbon', 'contentArea'],
);
assert.equal(policy.u1a.semanticRegionContract.find((item) => item.key === 'menuItems')?.reference, '#menu');
assert.equal(policy.u1a.semanticRegionContract.find((item) => item.key === 'menuItems')?.candidate, '.main-menu-items');
assert.equal(policy.u1a.semanticRegionContract.find((item) => item.key === 'topShell')?.reference, '.main-menu-bar');
assert.equal(policy.u1a.semanticRegionContract.find((item) => item.key === 'topShell')?.candidate, '.main-menu-bar');

const commandGroupsPressure = policy.u1a.ownerPressure['src/web/CadShellCommandGroups.tsx'];
assert.equal(commandGroupsPressure.targetBytes, 10240);
assert.equal(commandGroupsPressure.pressureRatio, 0.85);
assert.equal(commandGroupsPressure.pressureThresholdBytes, 8704);
assert.equal(commandGroupsPressure.rule, 'EXTRACT_SUBCOMPONENT_BEFORE_EXCEEDING_PRESSURE_THRESHOLD');
assert.ok(
  canonicalUtf8Bytes('src/web/CadShellCommandGroups.tsx') <= commandGroupsPressure.pressureThresholdBytes,
  'U1A BLOCKED: CadShellCommandGroups.tsx exceeded 8704 canonical UTF-8 bytes; extract a focused subcomponent before more growth',
);

assert.match(status, /U1A|U1B|U1C/);
assert.match(status, /KNOWN_RISK/);
assert.match(status, /OWNER_APPROVED_U1A_DETECT_ONLY_PR_FLOW/);
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
assert.match(spec, /DEFERRED_NOT_U1A/);
assert.match(visualSpec, /DEFERRED_NOT_U1A/);
assert.match(visualSpec, /LIGHT ONLY/);

assert.match(u1aMap, /CadShellTop\.tsx/);
assert.match(u1aMap, /CadShellCommandGroups\.tsx/);
assert.match(u1aMap, /App\.tsx/);
assert.match(u1aMap, /CadViewport\.tsx/);
assert.match(u1aMap, /OWNER_REQUIRED|owner.*acceptance/i);
assert.match(u1aMap, /DEFERRED_NOT_U1A/);
assert.match(u1aMap, /8704 bytes/);
assert.match(u1aMap, /menuItems/);
assert.match(u1aMap, /#menu/);
assert.match(u1aMap, /\.main-menu-items/);

for (const forbidden of policy.forbiddenPrototypeAuthorities) {
  assert.ok(forbidden.length > 0);
}

for (const workflowPath of integrationWorkflows) {
  const workflow = readFileSync(workflowPath, 'utf8');
  assert.match(
    workflow,
    /integration\/ui-core-unification/,
    `${workflowPath} must keep integration branch CI coverage`,
  );
}

for (const path of [
  '.github/workflows/ui-core-integration-guard.yml',
  '.github/workflows/ui-core-u1-visual.yml',
  'tests/visual/ui-core-u1-capture.mjs',
  'tests/process/ui-core-u1a-ready.mjs',
  'docs/UI_CORE_U1A_MAPPING.md',
]) {
  assert.ok(existsSync(path), `${path} must remain present`);
}

const guard = readFileSync('.github/workflows/ui-core-integration-guard.yml', 'utf8');
assert.match(guard, /integration\/ui-core-unification/);
assert.match(guard, /Direct\/unassociated push detected/);
assert.match(guard, /merged PR targeting integration\/ui-core-unification/);

const visualWorkflow = readFileSync('.github/workflows/ui-core-u1-visual.yml', 'utf8');
assert.match(visualWorkflow, /ui-reference-20261004/);
assert.match(visualWorkflow, /88c535c652dac8b04f0d68fa144cf8486afdc926/);
assert.match(visualWorkflow, /integration\/ui-core-unification/);
assert.match(visualWorkflow, /ui-core-u1-capture\.mjs/);

const visualCapture = readFileSync('tests/visual/ui-core-u1-capture.mjs', 'utf8');
assert.match(visualCapture, /DEFERRED_NOT_U1A/);
assert.match(visualCapture, /reference\/dark-solid-1600x900\.png/);
assert.match(visualCapture, /menuItems/);
assert.match(visualCapture, /candidate: '\.main-menu-items'/);

console.log('UI/core unification policy PASS');
