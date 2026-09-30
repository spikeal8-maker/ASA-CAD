# ASA-CAD — воспроизведение КОМПАСа с видимыми поставками

Редакция 2026-09-30. STATUS/#10 — текущее состояние; #19 — визуальная очередь.

## Цель

Каноническая цель: ~90% визуального + функционального/workflow соответствия разделам КОМПАС-3D v25 **Деталь / Part, Сборка / Assembly, Чертеж / Drawing** ради минимального переобучения. Это цель, не текущая приёмка.

FULL_TREE_PARITY = **NOT ACCEPTED**. FULL_M2V = **NOT ACCEPTED**. FULL_KOMPAS_PARITY = **NO**. 90_PERCENT_STATUS = **TARGET / NOT CURRENT ACCEPTANCE**.

## Принятые поставки

- В1 / CAD-VIS-001 — DONE / regional accepted.
- В2 / CAD-VIS-002 — DONE / regional accepted.
- В3 / CAD-VIS-003 — DONE / regional accepted / PARITY PARTIAL.
- В4 / CAD-VIS-004 — DONE / regional accepted / PARITY PARTIAL.
- CAD-VIS-005 — accepted integration checkpoint / PRODUCT_DELTA NONE.
- V6A / CAD-VIS-006A — DONE / MERGED / regional accepted / PARITY PARTIAL.
- V6B / CAD-VIS-006B — DONE / MERGED / regional accepted / PARITY PARTIAL.
- KOMPAS-SHELL-ADOPTION-001 — DONE / MERGED / REGIONAL RESULT ACCEPTED; PR #173; accepted HEAD `5719a8a8b3f357d1448ea68f7d30b41ef586bb35`; merge `027d4ea6a5b2549609b0b3a9cfdefd397fe8559b`; scope = **PART TOP SHELL ONLY**.
- V6C / CAD-VIS-006C — **DONE / MERGED / REGIONAL RESULT ACCEPTED**; PR #175; accepted HEAD `476d04c8917493adad995f8dca2a16b858927410`; merge `cda903d762b7e52e9345fe09e6dfa0be508a0d6a`; scope = **Sketch hierarchy + dimension ownership presentation**.

PR #170 remains **REFERENCE / PROTOTYPE ONLY**, OPEN / NOT MERGED.

## V6C / CAD-VIS-006C — accepted result

Accepted presentation/result:
- Part and Origin disclosures preserved;
- Sketch branches and independent Sketch disclosure accepted;
- entity rows are the real `sketch.entities`;
- dimension ownership source = `CadSketch.dimensionIds`;
- owned dimension duplicates = 0;
- orphan/multi-owner handling is fail-honest with no guessed owner;
- nested dimension edit accepted;
- save/reopen preserves ownership;
- edited value after reopen accepted.

Accepted proof: `Ширина` 60 → 62; save/reopen preserves the same dimension id, the same Sketch ownership, value 62 and tree label `Ширина: 62 мм`.

Ownership boundaries:
- NEW_PERSISTENCE_MODEL_REQUIRED = **NO**;
- CONTRACTS_CHANGED = **NO**;
- APPLICATION_COMMANDS_CHANGED = **NO**;
- RUNTIME_CHANGED = **NO**;
- PERSISTENCE_SCHEMA_CHANGED = **NO**.

This acceptance is regional only. It does not accept Part completion, full Tree parity, full M2V, full KOMPAS parity, Assembly, Drawing, or the 90% target.

## Full Repository Health Audit #166 and cadence

#166 = **YELLOW_ACCEPTED / completed**; RED findings = **NONE**.

Cadence history for the current cycle:
- Full Audit #166 → reset **0/3**;
- accepted permanent product slice PR #173 → **1/3**;
- accepted permanent product slice PR #175 → **2/3**.

**CADENCE = 2/3**. **FEATURE_FREEZE = LIFTED**.

Governance/docs PRs do not count as permanent product slices. Machine policy remains `fullAuditEveryAcceptedSlices = 3` and `sliceGate = after-every-permanent-vertical-slice`.

FULL_AUDIT_REQUIRED_NOW = **NO**.

Acceptance of the next permanent product slice moves cadence **2/3 → 3/3**, therefore FULL_AUDIT_REQUIRED_AFTER_NEXT_ACCEPTED_PERMANENT_SLICE = **YES**. A later product slice must not start until that Full Repository Health Audit is completed/accepted.

## NEXT — V7 / Resize

- NEXT = **V7 / Resize**.
- V7_STARTED = **NO**.
- V7_SCOPE_DEFINITION_REQUIRED = **YES**.
- V7 implementation is not part of this closeout.
- The next separate task must perform fresh gap analysis and define a narrow V7 contract before product changes.
- V8 remains later.

## Gates

Gate A/M2O and M3 core remain in force.

Gate B before broad M4 remains OPEN on:
- M2V KOMPAS visual acceptance;
- M3 functional exit contract;
- M3X shared ASA-CAD/ASA-Lab golden contract;
- M3M-009;
- pre-M4 performance baselines.

GitHub repository/PR/Issues/Actions/artifacts remain the execution environment.
