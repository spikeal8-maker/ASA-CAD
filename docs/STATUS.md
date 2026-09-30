# ASA-CAD — состояние и следующий видимый результат

Снимок 2026-09-30. Координатор #10, визуальная очередь #19.

## Текущий статус

- В1 / CAD-VIS-001 — DONE / MERGED / REGIONAL RESULT ACCEPTED.
- В2 / CAD-VIS-002 — DONE / MERGED / REGIONAL RESULT ACCEPTED.
- В3 / CAD-VIS-003 — DONE / MERGED / REGIONAL RESULT ACCEPTED / PARITY PARTIAL.
- В4 / CAD-VIS-004 — DONE / MERGED / REGIONAL RESULT ACCEPTED / PARITY PARTIAL.
- CAD-VIS-005 — INTEGRATION CHECKPOINT / ACCEPTED / PRODUCT_DELTA NONE.
- V6A / CAD-VIS-006A — DONE / MERGED / REGIONAL RESULT ACCEPTED / PARITY PARTIAL.
- V6B / CAD-VIS-006B — DONE / MERGED / REGIONAL RESULT ACCEPTED / PARITY PARTIAL.
- KOMPAS-SHELL-ADOPTION-001 — DONE / MERGED / REGIONAL RESULT ACCEPTED; accepted scope = PART TOP SHELL ONLY.
- V6C / CAD-VIS-006C — **DONE / MERGED / REGIONAL RESULT ACCEPTED**.
- Full Repository Health Audit #166 — **YELLOW_ACCEPTED / completed**; RED findings = **NONE**.
- CADENCE = **2/3**.
- FEATURE_FREEZE = **LIFTED**.
- FULL_AUDIT_REQUIRED_NOW = **NO**.
- FULL_AUDIT_REQUIRED_AFTER_NEXT_ACCEPTED_PERMANENT_SLICE = **YES**.
- FULL_TREE_PARITY = **NOT ACCEPTED**.
- FULL_M2V = **NOT ACCEPTED**.
- FULL_KOMPAS_PARITY = **NO**.
- 90_PERCENT_STATUS = **TARGET / NOT CURRENT ACCEPTANCE**.

M1 ASA-owned `CadDocument` preserves six first-class document kinds: Part, Assembly, Drawing, Fragment, Specification, Text. Canonical educational parity scope remains **Part / Assembly / Drawing**.

## V6C / CAD-VIS-006C — accepted closeout

**DONE / MERGED / REGIONAL RESULT ACCEPTED**.

Accepted evidence:
- PR #175;
- accepted HEAD `476d04c8917493adad995f8dca2a16b858927410`;
- merge `cda903d762b7e52e9345fe09e6dfa0be508a0d6a`;
- accepted scope = **Sketch hierarchy + dimension ownership presentation**.

Accepted result:
- Part disclosure — PRESERVED;
- Origin disclosure — PRESERVED;
- Sketch branches — ACCEPTED;
- independent Sketch disclosure — ACCEPTED;
- real entity rows come from `sketch.entities`;
- dimension ownership source = `CadSketch.dimensionIds`;
- owned dimension duplicates = **0**;
- orphan/multi-owner handling = **FAIL-HONEST / no guessed owner**;
- nested dimension edit — ACCEPTED;
- save/reopen ownership — ACCEPTED;
- edited value after reopen — ACCEPTED.

Accepted proof: `Ширина` 60 → 62; after save/reopen the same dimension id keeps the same Sketch ownership, value = 62, tree = `Ширина: 62 мм`.

Ownership boundaries:
- NEW_PERSISTENCE_MODEL_REQUIRED = **NO**;
- CONTRACTS_CHANGED = **NO**;
- APPLICATION_COMMANDS_CHANGED = **NO**;
- RUNTIME_CHANGED = **NO**;
- PERSISTENCE_SCHEMA_CHANGED = **NO**.

V6C does not accept Part completion, full Tree parity, full M2V, full KOMPAS parity, Assembly, Drawing, or the 90% target.

## Cadence

Machine policy: `spec/process/repository-health.v1.json`.

- Full Audit #166 → reset **0/3**.
- KOMPAS-SHELL-ADOPTION-001 / PR #173 → first accepted permanent product slice → **1/3**.
- V6C / PR #175 → second accepted permanent product slice → **2/3**.
- Governance/docs PRs do not count as permanent product slices.

NEXT_FULL_AUDIT_TRIGGER = **after the next accepted permanent product slice**. Its acceptance moves cadence **2/3 → 3/3**; before any later product slice, Full Repository Health Audit is required.

## NEXT — V7 / Resize

- NEXT = **V7 / Resize**.
- V7_STARTED = **NO**.
- V7_SCOPE_DEFINITION_REQUIRED = **YES**.
- The next implementation task must first perform fresh gap analysis and define a narrow V7 contract; Resize behavior is not defined by this closeout.
- V8 remains later.

PR #170 / `0d23bf19fbfcba7fbf4789afdd18f7d632adeb50` remains **REFERENCE / PROTOTYPE ONLY**, OPEN / NOT MERGED.

GitHub remains the primary source of truth and execution/test environment.
