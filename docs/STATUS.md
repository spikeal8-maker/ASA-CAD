# ASA-CAD — состояние и следующий gate

Снимок 2026-09-25. Координатор #10, визуальная очередь #19.

## Текущий статус

- В1 / CAD-VIS-001 — DONE / MERGED / REGIONAL RESULT ACCEPTED.
- В2 / CAD-VIS-002 — DONE / MERGED / REGIONAL RESULT ACCEPTED.
- В3 / CAD-VIS-003 — DONE / MERGED / REGIONAL RESULT ACCEPTED / PARITY PARTIAL.
- В4 / CAD-VIS-004 — DONE / MERGED / REGIONAL RESULT ACCEPTED / PARITY PARTIAL.
- CAD-VIS-005 — INTEGRATION CHECKPOINT / ACCEPTED / PRODUCT_DELTA NONE.
- V6A / CAD-VIS-006A — DONE / MERGED / REGIONAL RESULT ACCEPTED / PARITY PARTIAL.
- V6B / CAD-VIS-006B — **DONE / MERGED / REGIONAL RESULT ACCEPTED / PARITY PARTIAL**.
- FULL_TREE_PARITY = **NOT ACCEPTED**.
- FULL_M2V = **NOT ACCEPTED**.
- FULL_KOMPAS_PARITY = **NO**.
- CADENCE = **3/3**.
- FULL_REPOSITORY_HEALTH_AUDIT_REQUIRED = **YES**.
- FEATURE_FREEZE = **ACTIVE**.

## V6B / CAD-VIS-006B

Accepted candidate:
`b1254352ca93f2a22c11cdae457139d29f3f68d3`

Product merge:
`cb6ffbc59e1e07bf1dad8372a49aef36d71618e7` through PR #164.

Accepted scope only:
- real Part disclosure;
- real Origin disclosure;
- XY/XZ/YZ are leaf rows;
- Part/Origin expand-collapse is real UI state;
- disclosure does not mutate serialized CadDocument, dirty state, counts or observable undo state;
- protected Part regression preserved.

Pre-merge exact-head:
- M2 shell `36100313454` — SUCCESS
- M2 browser `36100313416` — SUCCESS
- M3 browser `36100313400` — SUCCESS
- Docker `36100313414` — SUCCESS
- baseline `36100313607` — SUCCESS
- OWNER_SCREENSHOT_CAPTURE `36100313402` — SUCCESS
- artifact `asa-cad-vis-006b`, id `10848472873`, retention 30 days, oldArtifactDependency=false

Post-product-merge on `cb6ffbc…`:
- M2 shell `36120390088` — SUCCESS
- M2 browser `36120390207` — SUCCESS
- M3 browser `36120390240` — SUCCESS
- Docker `36120390117` — SUCCESS
- baseline `36120390225` — SUCCESS

This acceptance does **not** mean full Tree parity. Sketch hierarchy, dimension ownership, search, context menu and later tree work remain outside V6B.

## Preserved V6A YELLOW

**Cut profile ownership — YELLOW / non-blocking / non-growing.**

`CutExtrudeParameterPanel` receives `profileId/profileName` through `ExtrudeOperationController`.

The accepted V6A single-profile path is valid. Do not extend this coupling to multi-profile selection, edit-existing feature or generalized feature selection. When that scope begins, profile ownership must be separated from `ExtrudeOperationController`.

## Mandatory next gate

Machine registry `spec/process/repository-health.v1.json` requires a Full Repository Health Audit every three accepted permanent slices.

Accepted permanent slices since Full Audit #158:
1. CAD-VIS-005
2. CAD-VIS-006A
3. CAD-VIS-006B

Therefore:

- CADENCE = **3/3**
- FEATURE_FREEZE = **ACTIVE**
- NEXT = **Full Repository Health Audit after V6B**
- NEXT_FEATURE = **BLOCKED**
- V6C = **BLOCKED_BY_AUDIT**

Do not start V6C, V7, Sketch hierarchy, dimension ownership, tree search or context menu until the Full Audit is accepted.

Gate A/M2O and M3 core remain in force. M1 ASA-owned `CadDocument` preserves six first-class document kinds: Part, Assembly, Drawing, Fragment, Specification, Text.

GitHub is the execution/test environment for this queue. No local computer, local Docker or deploy was used.
