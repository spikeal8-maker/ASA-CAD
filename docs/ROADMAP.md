# ASA-CAD — воспроизведение КОМПАСа с видимыми поставками

Редакция 2026-09-25. План, не готовность. STATUS/#10 — текущее состояние; #19 — визуальная очередь.

## Цель

Воспроизвести согласованную конфигурацию КОМПАС-3D v25 в браузере. FULL_M2V = **NOT ACCEPTED**. FULL_KOMPAS_PARITY = **NO**.

## Принятые поставки

- В1 / CAD-VIS-001 — DONE / regional accepted.
- В2 / CAD-VIS-002 — DONE / regional accepted.
- В3 / CAD-VIS-003 — DONE / regional accepted / PARITY PARTIAL.
- В4 / CAD-VIS-004 — DONE / regional accepted / PARITY PARTIAL.
- CAD-VIS-005 — accepted integration checkpoint / PRODUCT_DELTA NONE.
- V6A / CAD-VIS-006A — DONE / MERGED / regional accepted / PARITY PARTIAL.
- V6B / CAD-VIS-006B — **DONE / MERGED / regional accepted / PARITY PARTIAL**.

## V6B / CAD-VIS-006B

Accepted candidate:
`b1254352ca93f2a22c11cdae457139d29f3f68d3`

Product merge:
`cb6ffbc59e1e07bf1dad8372a49aef36d71618e7` through PR #164.

Accepted:
- Part root is a real branch;
- Origin is a real branch;
- XY/XZ/YZ are leaf nodes without fake disclosure;
- Part and Origin have real expand/collapse;
- disclosure is transient presentation state and does not mutate the document;
- protected Part remains green.

Artifact:
`asa-cad-vis-006b`, id `10848472873`, retention 30 days, oldArtifactDependency=false.

V6B closes only the first Part/Origin hierarchy slice. FULL_TREE_PARITY = **NOT ACCEPTED**.

## Preserved V6A YELLOW

`CutExtrudeParameterPanel` currently receives `profileId/profileName` through `ExtrudeOperationController`.

Severity = **YELLOW / non-blocking / non-growing**.

Do not extend this coupling to multi-profile selection, edit-existing feature or generalized feature selection. Separate profile ownership when that scope begins.

## Cadence gate

Full Repository Health Audit #158 is the last accepted Full Audit.

Machine registry requires a Full Audit every three accepted permanent slices:

1. CAD-VIS-005
2. CAD-VIS-006A
3. CAD-VIS-006B

Current cadence = **3/3**.

**FEATURE_FREEZE = ACTIVE.**

**NEXT = mandatory Full Repository Health Audit after CAD-VIS-006B.**

All feature work is blocked until that audit is accepted. In particular:
- V6C = BLOCKED_BY_AUDIT;
- V7 = BLOCKED_BY_AUDIT;
- Sketch hierarchy = BLOCKED_BY_AUDIT;
- dimension ownership = BLOCKED_BY_AUDIT;
- tree search/context menu = BLOCKED_BY_AUDIT.

No V6C branch or implementation is started by this closeout.

## After the audit

Only an accepted Full Audit may lift the feature freeze and establish the next product slice. Acceptance of V6B does not imply full Tree parity or overall M2V acceptance.

Gate B before broad M4 remains OPEN: M2V, M3 exit, M3X, M3M-009, performance baselines, and the currently required Full Repository Health Audit.

GitHub repository/PR/Issues/Actions/artifacts remain the execution environment. No deploy is part of this closeout.
