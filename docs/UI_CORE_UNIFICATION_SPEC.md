# UI_CORE_UNIFICATION_SPEC

Статус: **CANONICAL CONVERGENCE CONTRACT**.
Дата принятия направления: 2026-10-04.
Central issue: **#184 / UI-CORE-UNIFICATION-001**.
Integration branch: **`integration/ui-core-unification`**.

## 1. Причина документа

ASA-CAD получил два расходящихся результата:

- продуктовый ASA-CAD: настоящие document/application/solver/OpenCascade/persistence контракты, но неудовлетворительный пользовательский интерфейс;
- PR #170: значительно лучший KOMPAS-oriented UI/UX, но самостоятельный prototype runtime с собственными `doc`, `history`, `sketcher`, snap-логикой и Three.js extrusion.

Оба результата полезны, но два независимых CAD runtime недопустимы.

Цель инициативы — собрать **один ASA-CAD**, не переписывая уже проверенную математику и не теряя хороший UX.

## 2. Неподвижный архитектурный контракт

```text
Canonical UI / UX (#170)
        |
        v
typed UI actions / controllers
        |
        v
CadApplication
        |
        v
CadDocument + history + persistence
        |
        +---- Sketch solver / PlaneGCS
        |
        +---- Part profile validation
        |
        +---- OpenCascade / B-Rep
        |
        v
render adapters -> Three.js display
```

### Единственный source of truth
- document intent: `CadDocument`;
- command/history: `CadApplication`;
- persistence: product host/session/storage contracts;
- constraints/dimensions: supported solver path;
- exact Part geometry: OpenCascade/B-Rep path.

### Не source of truth
Всё самостоятельное runtime-состояние прототипа #170:
- `doc={sketches,features,...}`;
- `history[]/future[]`;
- sketch entity mutation as independent product model;
- heuristic snap as replacement for constraints;
- `THREE.ExtrudeGeometry` as product feature geometry.

Это может служить только UX/evidence reference до переноса соответствующего состояния.

## 3. Роль PR #170

#170 = **CANONICAL UI/UX REFERENCE / NOT PRODUCT RUNTIME**.

Сохраняем:
- layout;
- visual hierarchy;
- toolset organization;
- tree and parameter UX;
- menu/dropdown/dialog behavior;
- keyboard interaction;
- command feedback;
- numeric-entry workflow;
- ghost/preview expectations.

Не продолжаем там:
- solver;
- exact geometry;
- persistence;
- schema;
- independent application history.

После принятого U5 prototype должен стать только reference/evidence и может быть архивирован.

## 4. Роль существующей математики

Не переписывать с нуля существующие:
- Sketch geometry commands;
- constraints/dimensions;
- solve session / DoF / diagnostics;
- validated profile path;
- OpenCascade Part runtime;
- stable-reference behavior;
- Cut/Fillet regressions;
- persistence, migrations, Undo/Redo.

Допустимо извлекать проверенные решения из #177 и архивного #182 при независимой проверке exact SHA.

## 5. Git topology

```text
main
  |
  +-- integration/ui-core-unification
         |
         +-- ui-core/u1-shell
         +-- ui-core/u2-sketch
         +-- ui-core/u3-constraints-dimensions
         +-- ui-core/u4-extrude
         +-- ui-core/u5-protected-part
```

Каждый slice:
- создаётся от текущего exact HEAD integration branch;
- один writer на затрагиваемый owner/path;
- отдельный Draft PR **в integration branch**, не сразу в main;
- независимый review;
- exact-head CI;
- owner-visible result;
- после acceptance merge в integration branch;
- следующий slice только от нового integration HEAD.

Integration branch не является разрешением копить хаотичный код: один slice = один законченный пользовательский шаг.

## 6. Slice contracts

### U1 — Shell
Canonical shell №170 поверх real product state.
Acceptance:
- ordinary route;
- Part opens in canonical shell;
- XY/XZ/YZ scene/tree selection is one application selection;
- no prototype document/state authority.

### U2 — Sketch
Real Line/Rectangle/Circle/Arc inside canonical shell.
UX числового ввода из #170 сохраняется, но mutations идут через typed product commands.

Acceptance:
`XY -> Sketch -> Rectangle 60x40 -> Undo/Redo -> Save/Open -> same intent/IDs`.

### U3 — Constraints / dimensions
Real supported constraints/dimensions through solver.
Snap may assist pointer placement but does not create fake parametric behavior.

Acceptance:
governing dimension edit -> solver recompute -> reopen preserves intent.

### U4 — Extrude
No product use of Three.ExtrudeGeometry.
Acceptance:
`solved sketch -> validated profile -> OpenCascade -> B-Rep -> render`.

### U5 — Protected Part
Canonical UI throughout:
`60x40 -> Extrude 10 -> Ø12 Cut -> Fillet R1 -> 60->80 -> rebuild -> save/reopen -> edit again`.

## 7. Presentation and command honesty

A UI command can have three independent facts:
1. command exists in product registry;
2. backend/product implementation exists;
3. current canonical UI is actually bound to it.

Do not show fact 1 or 2 as evidence of fact 3.

Normal product:
- bound + supported command -> usable;
- not-yet-bound command -> hidden or explicitly unavailable according to visibility contract;
- prototype-only interaction -> never marked as product implementation.

## 8. Decomposition rule

The 2500-line prototype HTML is not a component blueprint.

Do not first refactor it into another standalone app.
During U1–U5, port only the needed visual/interaction zones into existing/narrow product owners:
- shell;
- command groups;
- tree;
- parameters;
- viewport;
- sketch interaction surfaces.

Prototype code should shrink in architectural importance, not become a dependency.

## 9. Acceptance evidence

Every slice must include:
- ordinary user route, no fixture-only proof;
- visible screenshot/video evidence for affected states;
- focused deterministic regression;
- affected browser tests;
- persistence/Undo/Redo proof where applicable;
- Docker/release-like smoke when required;
- provenance exact SHA.

No acceptance from:
- screenshots alone;
- GREEN CI alone;
- DOM-only fake control;
- localStorage substitution;
- hidden `app.execute` bypass;
- force-click.

## 10. Stop conditions

STOP and report if:
- expected integration HEAD changed;
- another writer touches same owner/path;
- implementation requires a second document/state manager;
- proposed code duplicates existing solver/OpenCascade/application behavior;
- migration/schema change is needed but not explicit;
- product behavior cannot be proven on ordinary route.

## 11. End condition

Initiative completes only when U5 is accepted and required repository audit/gates pass.

Then:
- integration branch may be merged to `main`;
- #170 stops being an active implementation branch and remains visual/UX evidence;
- all future ASA-CAD development continues in one product runtime.

`ONE_UI = YES`
`ONE_DOCUMENT_MODEL = YES`
`ONE_APPLICATION_HISTORY = YES`
`ONE_SOLVER_PATH = YES`
`ONE_EXACT_GEOMETRY_PATH = YES`
`SECOND_CAD_ENGINE = FORBIDDEN`
