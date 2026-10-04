# ASA-CAD — roadmap после решения UI-CORE-UNIFICATION

Редакция: 2026-10-04.
Центральная задача: **#184**.
Каноничная integration-ветка: **`integration/ui-core-unification`**.

## Цель

Каноническая цель остаётся прежней: примерно 90% learner-facing visual + functional/workflow identity с КОМПАС-3D для **Деталь / Сборка / Чертёж** при ASA-owned реализации.

Изменён не end-state, а путь к нему: хороший интерфейс и существующая математика больше не развиваются как два независимых проекта.

## Каноничные источники

### UI/UX
PR #170 / `prototype/kompas-shell-reference` — исполняемый визуальный и interaction reference.

Из него переносим:
- shell geometry;
- меню и toolsets;
- дерево/панели/parameters/status;
- keyboard and pointer flows;
- feedback, themes, dialogs;
- UX числового ввода и command lifecycle.

Не переносим как product authority:
- prototype `doc`;
- prototype `history/future`;
- prototype `sketcher`;
- prototype snap как solver substitute;
- `THREE.ExtrudeGeometry` как exact geometry.

### Product core
Только `src/**`:
- CadDocument;
- CadApplication;
- typed commands;
- persistence/migrations/history;
- solver / PlaneGCS;
- OpenCascade / B-Rep;
- stable references;
- runtime/render adapters.

## Convergence queue

### U0 — CONTRACT SYNC — NOW
- синхронизировать документы и задачи;
- #180 закрыть как superseded;
- #170 пометить canonical UI reference / not product runtime;
- product code не менять.

### U1 — SHELL ADOPTION
Обычный product route использует композицию №170 поверх настоящего application/document state.

Scope:
- top shell;
- tree/parameters/status layout;
- empty Part viewport;
- XY/XZ/YZ selection;
- real selection owner.

Не входит:
- перенос prototype math;
- ограничения;
- exact extrusion.

### U2 — REAL SKETCH
В canonical shell подключить настоящие Line/Rectangle/Circle/Arc и существующую историю/сохранение.

Acceptance:
`Part -> XY -> Sketch -> Rectangle 60x40 -> Undo/Redo -> Save/Open -> same intent/IDs`.

### U3 — REAL CONSTRAINTS + DIMENSIONS
Подключить существующие ограничения/размеры через solver:
- Coincident/H/V/Parallel/Perpendicular/Tangent/Concentric/Equal/Symmetric/Fixed/Point-on-curve;
- Linear/H/V/Angular/Radius/Diameter;
- DoF/diagnostics.

Prototype snap остаётся UX reference, но не заменяет constraints.

### U4 — REAL EXTRUDE
`solved Sketch -> validated profile -> OpenCascade -> B-Rep -> render model`.

Three.js только отображает.
Acceptance:
`Rectangle 60x40 -> Extrude 10 -> edit 60->80 -> recompute -> Save/Open`.

### U5 — PROTECTED PART ROUTE
Подключить/сохранить existing:
- Cut Ø12;
- Fillet R1;
- topology/stable references;
- protected regression.

Acceptance:
`60x40 -> Extrude 10 -> Ø12 Cut -> Fillet R1 -> 60->80 -> rebuild -> save/reopen -> edit again`.

После U5:
- full convergence review;
- required Full Repository Health Audit по cadence/policy;
- owner acceptance;
- только затем integration -> main.

## После объединения

Только после U1–U5:
1. расширение Part;
2. Drawing;
3. Assembly;
4. дальнейшая parity tuning.

#179 остаётся HOLD до отдельного решения; не использовать его как обход текущего объединения.

## Правило видимого результата

Каждый U-slice обязан давать законченный обычный пользовательский маршрут.
GREEN CI, красивая оболочка или отдельная математическая функция сами по себе не считаются поставкой.

## Запрещено

- второй document/state manager;
- новая CAD-математика внутри prototype HTML;
- localStorage/demo persistence вместо product persistence;
- copy/paste 2500 строк prototype в один product owner;
- новый независимый UI рядом с canonical shell;
- объявлять команду подключённой только потому, что registry status = implemented.
