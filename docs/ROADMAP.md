# ASA-CAD — UI/core convergence roadmap

Редакция: 2026-10-04.
Central issue: **#184**.
Integration branch: **`integration/ui-core-unification`**.
Frozen UI reference: **`ui-reference-20261004` -> `88c535c652dac8b04f0d68fa144cf8486afdc926`**.

## Цель

Один ASA-CAD:
`canonical UI/UX -> typed product actions -> CadApplication -> CadDocument/history/persistence -> solver -> OpenCascade/B-Rep -> render`.

№170 задаёт внешний вид и interaction intent, но не становится вторым runtime.

## PRE-U1 / U0-FIX

До начала U1 обязательно:
- U0 docs/policy в main;
- #181 merged;
- #183 merged;
- integration обновлена от fresh main;
- CI работает для PR base = `integration/ui-core-unification`;
- frozen reference tag подтверждён;
- machine convergence test PASS.

## U1A pre-start gate

Перед первой строкой U1A-кода обязательно:
- GitHub admin protection на `integration/ui-core-unification` = ENFORCED;
- `npm run test:process:ui-core-u1a-ready` = PASS;
- mapping-contract `docs/UI_CORE_U1A_MAPPING.md` прочитан исполнителем;
- visual evidence workflow доступен для PR -> integration.

Пока protection не включена, **U1A CODE = BLOCKED**. `UI_CORE_INTEGRATION_GUARD` — только detector, не server-side enforcement.

## U1 — CANONICAL SHELL ADOPTION

**U1 = один permanent product slice.**

### U1A — Shell checkpoint
Переносим только:
- меню;
- document tab;
- toolsets/ribbon;
- базовую композицию;
- light-theme visual parity.

Dark theme frozen №170 = **DEFERRED_NOT_U1A**. Не фейкать её в U1A; сохранить reference evidence и реализовать отдельным UI-parity решением до общего заявления visual parity.

Geometry compare = semantic-region contract из `UI_CORE_U1A_MAPPING.md`, а не произвольные selector pairs.

### U1B — Tree/Parameters/Status checkpoint
Подключаем:
- настоящее дерево;
- параметры;
- status;
- existing typed bindings.

### U1C — Viewport/Selection checkpoint
Подключаем:
- empty Part WorkArea;
- XY/XZ/YZ;
- одну selection model между scene/tree/parameters.

Acceptance U1:
обычный Part route показывает каноничную оболочку и один настоящий application state без prototype `doc/history`.

### Обязательный gate после U1

U1 переводит cadence **2/3 -> 3/3**.

Поэтому:
```text
U1 ACCEPTED
   ↓
FULL REPOSITORY HEALTH AUDIT
   ↓
audit accepted / yellow accepted
   ↓
U2 UNBLOCKED
```

Не переносить аудит на конец U5.

## U2 — REAL SKETCH

После аудита:
- Line;
- Rectangle;
- Circle;
- Arc;
- UX числового ввода из #170;
- mutations только через product commands/CadDocument;
- Undo/Redo + Save/Open.

Acceptance:
`Part -> XY -> Sketch -> Rectangle 60x40 -> Undo/Redo -> Save/Open -> same intent/IDs`.

## U3 — REAL CONSTRAINTS + DIMENSIONS

Подключить product solver:
- Coincident/H/V/Parallel/Perpendicular/Tangent/Concentric/Equal/Symmetric/Fixed/Point-on-curve;
- Linear/H/V/Angular/Radius/Diameter;
- DoF/diagnostics.

Prototype snap = UX aid only, не solver.

## U4 — REAL EXTRUDE

`solved Sketch -> validated profile -> OpenCascade -> B-Rep -> render`.

Three.js только отображает.

Acceptance:
`Rectangle 60x40 -> Extrude 10 -> edit 60->80 -> recompute -> Save/Open`.

## U5 — PROTECTED PART ROUTE

Сохранить существующие:
- Cut Ø12;
- Fillet R1;
- topology/stable references;
- protected regression.

Acceptance:
`60x40 -> Extrude 10 -> Ø12 Cut -> Fillet R1 -> 60->80 -> rebuild -> save/reopen -> edit again`.

## Reuse decisions

Полный machine-readable reuse-map:
`spec/process/ui-core-unification.v1.json`.

Коротко:
- #170 / 88c535c — REFERENCE_ONLY;
- #177 / 44d87b — REUSE_AFTER_EXACT_REVIEW;
- archived #182 / 27c552 — EXTRACT_AFTER_EXACT_REVIEW;
- #179 / 034d0f — HOLD_NOT_INTEGRATION_BASE.

## Запрещено

- второй document/state manager;
- prototype math как product authority;
- localStorage/demo persistence вместо product persistence;
- `THREE.ExtrudeGeometry` как exact product geometry;
- copy/paste 2500 строк prototype в один owner;
- один U1 PR выше repository footprint без architecture review;
- начинать U2 до обязательного аудита после U1.
