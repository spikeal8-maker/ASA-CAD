# ASA-CAD — воспроизведение КОМПАСа с видимыми поставками

Редакция 2026-09-30. STATUS/#10 — текущее состояние; #19 — визуальная очередь.

## Цель

Каноническая цель: ~90% визуального + функционального/workflow соответствия разделам КОМПАС-3D v25 **Деталь / Сборка / Чертеж** ради минимального переобучения; полный контракт — `SYSTEM_SPEC.md`. FULL_M2V = **NOT ACCEPTED**. FULL_KOMPAS_PARITY = **NO**.

## Принятые поставки

- В1 / CAD-VIS-001 — DONE / regional accepted.
- В2 / CAD-VIS-002 — DONE / regional accepted.
- В3 / CAD-VIS-003 — DONE / regional accepted / PARITY PARTIAL.
- В4 / CAD-VIS-004 — DONE / regional accepted / PARITY PARTIAL.
- CAD-VIS-005 — accepted integration checkpoint / PRODUCT_DELTA NONE.
- V6A / CAD-VIS-006A — DONE / MERGED / regional accepted / PARITY PARTIAL.
- V6B / CAD-VIS-006B — DONE / MERGED / regional accepted / PARITY PARTIAL.
- KOMPAS-SHELL-ADOPTION-001 — **DONE / MERGED / REGIONAL RESULT ACCEPTED**; PR #173; accepted HEAD `5719a8a8b3f357d1448ea68f7d30b41ef586bb35`; merge `027d4ea6a5b2549609b0b3a9cfdefd397fe8559b`; accepted scope = **PART TOP SHELL ONLY**.

FULL_TREE_PARITY = **NOT ACCEPTED**.

## Full Repository Health Audit #166

#166 = **YELLOW_ACCEPTED / completed**.

Accepted final main:
`fa13134bf7397a20a9b02790a6644e9084e943e0`

RED findings:
**NONE**

Resolved in audit maintenance:
- `Y-AUD-166-M2-ARCH` — permanent M2 shell executes `npm run test:m2:architecture`; post-repair CI PASS.

Remaining accepted YELLOW:
- `Y-AUD-166-BUDGETS` — target pressure only; hard/frozen gates PASS; no growth.
- `Y-AUD-166-THIRD-TOUCH` — focused owner review completed in #166; repeat before the next qualifying third touch.
- `Y-AUD-166-STALE-PRS` — #143/#146 are stale/historical and must not merge as-is.
- `Y-AUD-166-V6A-OWNERSHIP` — CutExtrude profile ownership coupling is non-growing; separate before broader profile/edit-existing/generalized-selection scope.

Audit #158 is now historical. #166 is the latest accepted Full Repository Health Audit.

## Cadence

Accepted Full Audit #166 reset cadence to **0/3**.

After accepted permanent product slice #173:

**CADENCE = 1/3**

**FEATURE_FREEZE = LIFTED**

Governance/docs PRs #168/#171/#172 do not count as permanent product slices.

Every permanent slice still receives a Slice Quality Gate. The next Full Repository Health Audit is required again at 3 accepted permanent slices or another machine-policy trigger.

## Accepted — KOMPAS-SHELL-ADOPTION-001

KOMPAS-SHELL-ADOPTION-001 = **DONE / MERGED / REGIONAL RESULT ACCEPTED**.

Accepted implementation:
- PR #173;
- accepted HEAD `5719a8a8b3f357d1448ea68f7d30b41ef586bb35`;
- merge `027d4ea6a5b2549609b0b3a9cfdefd397fe8559b`;
- scope = **PART TOP SHELL ONLY**.

Accepted regional delta includes the existing main-menu/document-tab owners, Part workspace/toolset selector, three Part toolsets, registry-backed command-group composition, preserved quick-access owner, and the production/dev roadmap-command visibility boundary.

**PRODUCTION_VISIBILITY_CONTRACT = ACCEPTED**:
- normal product hides planned/deferred commands;
- explicit `/dev/part/*` may show them disabled with roadmap markers.

PR #170 remains **REFERENCE / PROTOTYPE ONLY**, OPEN / NOT MERGED.

This does not accept full M2V, full KOMPAS parity, full Tree parity, Part completion, Assembly, Drawing, or the 90% target. Canonical educational parity scope remains **Деталь / Part, Сборка / Assembly, Чертеж / Drawing**.

## NEXT — V6C / CAD-VIS-006C

**Sketch hierarchy + dimension ownership**.

V6C is the next separate product slice after accepted initial KOMPAS shell adoption. It owns Sketch hierarchy and dimension ownership; implementation has not started.

**V6C_STARTED = NO**.

Cadence after accepted #173 = **1/3**. FEATURE_FREEZE = **LIFTED**.

## Gates

Gate A/M2O and M3 core remain in force.

Gate B before broad M4 remains OPEN on:
- M2V KOMPAS visual acceptance;
- M3 functional exit contract;
- M3X shared ASA-CAD/ASA-Lab golden contract;
- M3M-009;
- pre-M4 performance baselines.

The Full Repository Health Audit requirement for this cadence cycle is satisfied by accepted #166.

GitHub repository/PR/Issues/Actions/artifacts remain the execution environment.
