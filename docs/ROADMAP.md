# ASA-CAD — воспроизведение КОМПАСа с видимыми поставками

Редакция 2026-09-25. План, не готовность. STATUS/#10 — текущее состояние; #19 — визуальная исполнительная очередь.

## Цель

Воспроизвести согласованную конфигурацию КОМПАС-3D v25 в браузере: интерфейс, структуру, панели, состояния, команды и поведение.

FULL_M2V = **NOT ACCEPTED**. FULL_KOMPAS_PARITY = **NO**.

## Принятые поставки

**В1 / CAD-VIS-001 — DONE / accepted regional result.**
Верхняя область Детали и responsive repair.

**В2 / CAD-VIS-002 — DONE / accepted regional result.**
Single-Sketch finish/select/re-edit/reopen с сохранением identity.

**В3 / CAD-VIS-003 — DONE / accepted regional result.**
Рабочее меню «Файл», shared New/Open/Save, dirty replacement guard, keyboard/focus. PARITY = PARTIAL.

**В4 / CAD-VIS-004 — DONE / accepted regional result.**
Поддерживаемая панель Extrude: section/profile, «На расстояние», distance/reverse/symmetric, no-mutation, real B-Rep, Save/Open, XZ/YZ fail-closed. PARITY = PARTIAL.

**CAD-VIS-005 — INTEGRATION CHECKPOINT / ACCEPTED.**
End-to-end Part verification В1–В4. PRODUCT_DELTA = NONE.

**V6A / CAD-VIS-006A — DONE / MERGED / REGIONAL RESULT ACCEPTED.**

Accepted candidate:
`ff57cec29d20f36b8c39ea038ad53c42ff26b55d`

Product merge:
`1aed43cb483098aa8d474d9c83623c70aa7cdede` through PR #162.

Accepted V6A behavior:
- real section/profile = «Эскиз 2»;
- guide = «Нормаль к плоскости эскиза»;
- method = «Сквозь всё»;
- begin/cancel no mutation;
- real through-all cut;
- Save/Open identity;
- protected Part regression;
- self-contained visual evidence.

Artifact:
`asa-cad-vis-006a`, id `10832000991`, retention 30 days.

PARITY = **PARTIAL**.

### V6A YELLOW ownership note

`CutExtrudeParameterPanel` currently receives `profileId/profileName` through `ExtrudeOperationController`.

Severity = **YELLOW / non-blocking** for the accepted single-profile V6A path.

Do not extend this coupling to multi-profile selection, edit-existing feature or generalized feature selection. When that scope begins, profile ownership must be separated from `ExtrudeOperationController`.

## NEXT — V6B / CAD-VIS-006B

**V6B — Дерево построения: hierarchy/disclosure.**

V6B is the next visible product slice. This closeout does not create a V6B branch and does not start its implementation.

V6B will be scoped separately before code. It must not inherit acceptance from V6A automatically.

## Queue

| Package | Status |
|---|---|
| В1 / CAD-VIS-001 | DONE / regional accepted |
| В2 / CAD-VIS-002 | DONE / regional accepted |
| В3 / CAD-VIS-003 | DONE / regional accepted / PARITY PARTIAL |
| В4 / CAD-VIS-004 | DONE / regional accepted / PARITY PARTIAL |
| CAD-VIS-005 | ACCEPTED integration checkpoint / PRODUCT_DELTA NONE |
| V6A / CAD-VIS-006A | DONE / MERGED / regional accepted / PARITY PARTIAL |
| V6B / CAD-VIS-006B | **NEXT — Дерево построения** |
| V6C+ | later, separate visible slices |
| V7 | resize/state matrix later |
| V8 | closed Part/Sketch acceptance later |

## Gates

Full Repository Health Audit #158 remains YELLOW_ACCEPTED with no RED findings.

Machine registry `spec/process/repository-health.v1.json` counts every accepted permanent slice:
- CAD-VIS-005 → cadence 1/3;
- V6A → cadence **2/3**.

The next Full Repository Health Audit is required at 3/3 or at a milestone boundary.

Gate B before broad M4 remains OPEN: M2V, M3 exit, M3X, M3M-009 and performance baselines.

GitHub repository/branches/PRs/Issues/Actions/artifacts remain the execution environment for this queue. No local computer or deployment is part of this closeout.
