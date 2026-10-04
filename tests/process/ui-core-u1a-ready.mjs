import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const policy = JSON.parse(readFileSync('spec/process/ui-core-unification.v1.json', 'utf8'));
const protection = policy.integrationProtection?.current;

assert.ok(protection, 'integrationProtection.current must exist');
assert.equal(
  protection.mode,
  'ENFORCED',
  'U1A BLOCKED: integration branch protection is not enforced by GitHub admin settings',
);
assert.equal(
  protection.adminProtectionVerified,
  true,
  'U1A BLOCKED: integration branch protection has not been verified',
);
assert.equal(
  protection.u1aStartAllowed,
  true,
  'U1A BLOCKED by machine preflight',
);

console.log('UI/core U1A readiness PASS');
