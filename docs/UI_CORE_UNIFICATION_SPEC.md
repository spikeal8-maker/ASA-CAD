# UI_CORE_UNIFICATION_SPEC

Status: **CANONICAL CONVERGENCE CONTRACT**.
Issue: **#184 / UI-CORE-UNIFICATION-001**.
Integration branch: **`integration/ui-core-unification`**.
Machine contract: **`spec/process/ui-core-unification.v1.json`**.

## 1. Цель

ASA-CAD должен перестать существовать как два расходящихся проекта:
- хороший интерфейс №170 со своей демонстрационной логикой;
- продуктовый ASA-CAD с настоящими document/application/solver/OpenCascade/persistence слоями.

Цель:
**один UI + один document model + одна application history + один solver path + один exact-geometry path**.

## 2. Frozen UI reference

Для U1 каноничный reference неизменяем:

- PR: #170;
- branch: `prototype/kompas-shell-reference`;
- tag: `ui-reference-20261004`;
- SHA: `88c535c652dac8b04f0d68fa144cf8486afdc926`.

Изменения ветки #170 после этого SHA **не становятся каноничными автоматически**.
Новый reference SHA требует отдельного owner decision + обновления machine contract.

## 3. Product authority

```text
Canonical UI/UX intent (#170 frozen SHA)
        ↓
existing/narrow product UI owners
        ↓
typed UI actions/controllers
        ↓
CadApplication
        ↓
CadDocument + history + persistence
        ↓
solver / profile validation / OpenCascade
        ↓
render adapters
        ↓
Three.js display
```

Source of truth:
- document intent = `CadDocument`;
- command/history = `CadApplication`;
- persistence = product host/session/storage;
- constraints/dimensions = supported product solver;
- exact Part geometry = OpenCascade/B-Rep.

Не source of truth:
- prototype `doc`;
- prototype `history/future`;
- prototype `sketcher`;
- heuristic prototype snap как constraint solver;
- `THREE.ExtrudeGeometry` как product feature.

## 4. Reuse map

### #170 — REFERENCE_ONLY
SHA `88c535c652dac8b04f0d68fa144cf8486afdc926`.

Использовать:
- layout/hierarchy;
- menus/toolsets;
- tree/parameters/status UX;
- keyboard/pointer flows;
- numeric entry;
- ghost/preview expectations.

Не использовать как runtime:
- prototype state/math/history/persistence.

### #177 — REUSE_AFTER_EXACT_REVIEW
SHA `44d87bef78fd66aa0e85fa1fa7ba9dc58e280a65`.

Кандидаты reuse:
- Rectangle relations;
- solved Sketch -> validated profile;
- profile failure boundaries;
- camera preservation;
- Cut/Fillet regressions;
- save/open parametric intent.

Перед переносом каждого owner/path: exact-SHA review + REUSE/ADAPT decision.

### Archived #182 — EXTRACT_AFTER_EXACT_REVIEW
SHA `27c55222331681d23ba101bd4992c9dc24a0ac42`.

Кандидаты extract:
- empty Part WorkArea;
- base-plane scene selection;
- scene/tree plane selection sync;
- navigation/view candidate.

Не брать ветку как integration base.

### #179 — HOLD_NOT_INTEGRATION_BASE
SHA `034d0fc4d51606425794fc76508f61600a41d0cb`.

Drawing/schema работа остаётся отдельным кандидатом и не определяет текущую интеграцию.

## 5. U0 preflight

U1 запрещено начинать, пока не выполнены все условия:

1. этот governance contract находится в `main`;
2. #181 MERGED;
3. #183 MERGED;
4. integration fast-forward/merge содержит новый main;
5. required CI запускается для PR base = `integration/ui-core-unification`;
6. tag `ui-reference-20261004` указывает на frozen SHA;
7. `npm run test:process:ui-core-unification` PASS.

Если хотя бы один пункт не выполнен:
`U1_START_ALLOWED = NO`.

## 6. Git topology

```text
main
  |
  +-- integration/ui-core-unification
         |
         +-- ui-core/u1a-shell
         +-- ui-core/u1b-tree-parameters
         +-- ui-core/u1c-viewport-selection
         |
         +-- U1 acceptance
         +-- Full Repository Health Audit
         |
         +-- ui-core/u2-sketch
         +-- ui-core/u3-constraints-dimensions
         +-- ui-core/u4-extrude
         +-- ui-core/u5-protected-part
```

Каждый checkpoint/срез:
- branch from exact current integration HEAD;
- один writer на owner/path;
- Draft PR в integration branch;
- independent review;
- exact-head CI;
- visible owner result;
- merge обратно только после acceptance.

## 7. U1 = один permanent product slice

U1 нельзя превращать в один огромный PR.
Он имеет три checkpoints, но cadence они отдельно не увеличивают.

### U1A — Shell
Scope:
- main menu;
- document tab;
- toolsets/ribbon;
- composition/layout.

Не трогать:
- product math;
- solver;
- persistence model;
- prototype state.

### U1B — Tree / Parameters / Status
Scope:
- tree layout and interaction surface;
- parameters;
- status;
- typed existing bindings.

### U1C — Viewport / Selection
Scope:
- real empty Part WorkArea;
- XY/XZ/YZ;
- scene/tree/parameters share one real application selection;
- ordinary product route.

U1 acceptance:
`open Part -> canonical shell -> select XY/XZ/YZ -> one application selection state`.

## 8. Cadence gate

До U1 cadence = **2/3**.

Принятый U1 = один permanent product slice:
`2/3 -> 3/3`.

Следовательно сразу после U1 acceptance:
**Full Repository Health Audit REQUIRED**.

До audit outcome GREEN или explicitly accepted YELLOW:
**U2 = BLOCKED**.

U1A/U1B/U1C не считаются тремя permanent slices.

## 9. U2–U5

### U2 — Real Sketch
Line/Rectangle/Circle/Arc + numeric-entry UX №170, но mutations только через real product commands/CadDocument.

Acceptance:
`XY -> Sketch -> Rectangle 60x40 -> Undo/Redo -> Save/Open -> same intent/IDs`.

### U3 — Constraints / Dimensions
Real product solver + persistent constraints/dimensions + DoF/diagnostics.

Acceptance:
governing dimension edit -> solver recompute -> reopen preserves intent.

### U4 — Extrude
No product use of `THREE.ExtrudeGeometry`.

Acceptance:
`solved Sketch -> validated profile -> OpenCascade -> B-Rep -> render`.

### U5 — Protected Part
Canonical UI throughout:
`60x40 -> Extrude 10 -> Ø12 Cut -> Fillet R1 -> 60->80 -> rebuild -> save/reopen -> edit again`.

## 10. Command honesty

Три независимых факта:
1. command id существует;
2. product implementation существует;
3. canonical UI реально подключён к implementation.

Нельзя выдавать 1 или 2 за 3.

Prototype-only behavior не помечается как product-connected.

## 11. Decomposition

2500-line prototype HTML = executable UX specification, а не component blueprint.

Не рефакторить его сначала в отдельное приложение.
Переносить по зонам в существующие/narrow product owners.

Следить за repository policy:
- target handwritten files = 12;
- architecture review above 20 files;
- target changed lines = 800;
- architecture review above 1500 lines;
- frozen owners may not grow.

## 12. Evidence

Каждый checkpoint/slice:
- ordinary route;
- deterministic focused regression;
- affected browser CI;
- visible screenshots/video;
- exact SHA;
- persistence/history proof where applicable.

Не acceptance:
- screenshot alone;
- GREEN CI alone;
- fake DOM control;
- localStorage substitution;
- hidden app.execute bypass;
- force-click.

## 13. STOP

STOP if:
- integration HEAD moved;
- same owner/path has another writer;
- second document/state manager required;
- duplicate solver/OpenCascade/application logic proposed;
- implicit schema migration required;
- ordinary route cannot prove behavior.

## 14. End state

После U5 + required audits/gates + owner acceptance integration может быть слита в `main`.

После этого #170 остаётся reference/evidence и больше не является active implementation path.

`ONE_UI = YES`
`ONE_DOCUMENT_MODEL = YES`
`ONE_APPLICATION_HISTORY = YES`
`ONE_SOLVER_PATH = YES`
`ONE_EXACT_GEOMETRY_PATH = YES`
`SECOND_CAD_ENGINE = FORBIDDEN`
