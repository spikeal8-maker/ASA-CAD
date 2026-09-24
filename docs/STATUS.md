# ASA-CAD — состояние и следующий видимый результат

Снимок 2026-09-25. Координатор #10, визуальная очередь #19.

## Текущий статус

- В1 / CAD-VIS-001 — DONE / MERGED / REGIONAL RESULT ACCEPTED.
- В2 / CAD-VIS-002 — DONE / MERGED / REGIONAL RESULT ACCEPTED.
- В3 / CAD-VIS-003 — DONE / MERGED / REGIONAL RESULT ACCEPTED / PARITY PARTIAL.
- В4 / CAD-VIS-004 — DONE / MERGED / REGIONAL RESULT ACCEPTED / PARITY PARTIAL.
- CAD-VIS-005 — INTEGRATION CHECKPOINT / ACCEPTED / PRODUCT_DELTA NONE.
- V6A / CAD-VIS-006A — **DONE / MERGED / REGIONAL RESULT ACCEPTED**.
- FULL_M2V = **NOT ACCEPTED**.
- FULL_KOMPAS_PARITY = **NO**.
- Full Repository Health Audit #158 = **YELLOW_ACCEPTED**; RED findings = NONE.
- Audit cadence = **2/3**.

## V6A / CAD-VIS-006A

Accepted candidate:
`ff57cec29d20f36b8c39ea038ad53c42ff26b55d`

Product merge:
`1aed43cb483098aa8d474d9c83623c70aa7cdede` through PR #162.

Accepted:
- real profile **Эскиз 2**;
- «Направляющий объект» = **Нормаль к плоскости эскиза**;
- method = **Сквозь всё**;
- begin does not mutate CadDocument;
- Cancel does not mutate CadDocument;
- Apply creates a real through-all `cut-extrude`;
- Save/Open preserves Sketch / cut Feature / Body identity;
- protected Part regression remains PASS;
- visual delta evidence = PASS.

Pre-merge exact-head CI:
- M2 shell `36054101423` — SUCCESS
- M2 browser `36054101434` — SUCCESS
- M3 browser `36054101379` — SUCCESS
- Docker `36054101378` — SUCCESS
- baseline `36054101436` — SUCCESS
- OWNER_SCREENSHOT_CAPTURE `36054101394` — SUCCESS
- artifact `asa-cad-vis-006a`, id `10832000991`, retention 30 days

Post-product-merge CI on `1aed43cb…`:
- M2 shell `36069527024` — SUCCESS
- M2 browser `36069527195` — SUCCESS
- M3 browser `36069527197` — SUCCESS
- Docker `36069527175` — SUCCESS
- baseline `36069527121` — SUCCESS

PARITY = **PARTIAL**.

## V6A YELLOW

**Cut profile ownership — YELLOW / non-blocking.**

`CutExtrudeParameterPanel` currently receives `profileId/profileName` through `ExtrudeOperationController`.

The accepted V6A path is single-profile and tested. Do not extend this coupling to:
- multi-profile selection;
- edit-existing feature;
- generalized feature selection.

When that scope begins, profile ownership must be separated from `ExtrudeOperationController`.

This YELLOW does not block accepted V6A.

## NEXT

**V6B / CAD-VIS-006B — Дерево построения.**

Next scope is hierarchy/disclosure of the construction tree. V6B implementation is **not started** by this closeout.

## Gates

Gate A/M2O and M3 core remain in force. M1 ASA-owned `CadDocument` preserves six first-class document kinds: Part, Assembly, Drawing, Fragment, Specification, Text.

Gate B remains OPEN on M2V, M3 exit, M3X, M3M-009 and performance baselines.

Machine registry `spec/process/repository-health.v1.json` counts every accepted permanent slice. After accepted CAD-VIS-005 and V6A, cadence = **2/3**. Full Repository Health Audit is required at 3/3 or at a milestone boundary.

GitHub is the test environment for this queue. Ali_Robs, Desktop Commander, Remote Desktop, local Docker and local browser tests were not used.
