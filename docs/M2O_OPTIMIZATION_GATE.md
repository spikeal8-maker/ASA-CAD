# M2O — Architecture Optimization Gate

This document is the **execution checklist before M3 Parametric Sketch**.

It exists to prevent ASA-CAD from entering M3 with known structural debt that would make every new sketch command expensive, duplicated or unsafe.

Current product status belongs to [`STATUS.md`](STATUS.md). Long-term architecture belongs to [`ARCHITECTURE.md`](ARCHITECTURE.md). This file answers only one question:

> **What must be fixed, in what order, before M3 may start?**

## Gate rule

**Do not add new CAD feature families while the blocking M2O steps are open.**

Allowed during M2O:
- refactoring without changing accepted behavior;
- registry/documentation corrections;
- persistence wiring;
- typing existing contracts;
- extracting controllers/components/handlers;
- strengthening tests/CI;
- M2A/M2V visual correction if it does not bypass this plan.

Not allowed during blocking M2O work:
- broad new Sketch command families;
- new Part feature families;
- Assembly implementation;
- direct UI calls into OpenCascade/vendor internals;
- new hard-coded desktop/mobile command duplication;
- increasing `App.tsx` or `CadApplicationImpl` instead of extracting ownership.

## Scope-control rule — do not turn M2O into a rewrite

M2O exists to make **M3 cheaper and safer**, not to perfect every future architecture before new product work can continue.

For every step:
- stop when the written acceptance criteria are satisfied;
- preserve accepted Part/runtime/browser behavior;
- prefer extraction and adapters over rewrites;
- do not redesign OpenCascade, PlaneGCS, StableRef or the saved-document model unless the step proves it is required;
- do not type or redesign Drawing/Specification/Text merely because they will exist later;
- do not migrate all dependencies/tooling merely to make the repository look cleaner;
- do not finish pixel-perfect visual polish that M3 will immediately change;
- do not add speculative abstraction for M4/M5/M6 unless a current M2O boundary requires it.

### Blocking classification

**Hard blockers before M3:** O1, O2, O3, O4.

**Minimum structural blockers before M3:** O5, O6, O7, O8. These steps are complete for M3 when the specific M3 growth path is modular and tested; they do not require a repository-wide rewrite.

**Non-blocking follow-up lanes:** O9, O10, O11. They remain important, but M3 must not wait for a full toolchain migration, GitHub administration that permissions may block, or final KOMPAS visual polish.

## Current execution state

- [x] O1 — six-document architecture/document consistency; CI protected.
- [x] O2 — canonical command/layout IDs and truthful accepted M2 statuses; CI protected.
- [x] O3 — editor persistence routed through `CadEditorPersistence -> CadProjectSession -> CadProjectHost`; standalone/ASA Lab host seams preserved; protected browser/Docker save-reopen green.
- [ ] O4 — **ACTIVE**. Typed `CadUiAction` model + builder/search/enablement/execution contract and regression exist; permanent desktop/mobile/search/shortcut presentation still needs to consume the shared action objects before this step closes.
- [ ] O5 — pending.
- [ ] O6 — pending.
- [ ] O7 — pending.
- [ ] O8 — pending.

---

# Execution order

The blocking order below is mandatory unless a discovered blocker requires a documented change.

## O1 — Fix mandatory architecture documentation — P0 — DONE

### Result

`ARCHITECTURE.md`, `SYSTEM_SPEC.md`, `STATUS.md` and `CadDocumentKind` now agree on six first-class document kinds:
- `part`;
- `assembly`;
- `drawing`;
- `fragment`;
- `specification`;
- `text`.

The architecture separately records current runtime maturity: the accepted exact B-Rep vertical slice is Part-focused; that limitation does not shrink the public document model.

### Permanent protection

`tests/m2o/document-kinds.mjs` runs in the M2 shell gate and rejects a regression back to a two-document public architecture.

---

## O2 — Make command/layout registries internally consistent — P0 — DONE

### Result

- command/layout IDs are cross-validated;
- missing layout command IDs were normalized against the maintained KOMPAS inventory;
- stale aliases are rejected;
- accepted M2 commands are explicitly `implemented`;
- status vocabulary is limited to `planned | implemented | experimental | deferred`.

### Permanent protection

`tests/m2o/registry-integrity.mjs` runs in the M2 shell gate and rejects unknown layout IDs, stale aliases, duplicate IDs and status regression for the accepted M2 command set.

---

## O3 — Route product persistence through `CadProjectSession` — P0 — DONE

### Result

Permanent editor persistence now follows:

```text
App / UI command
  -> CadEditorPersistence
  -> CadProjectSession
  -> CadProjectHost
      -> LocalStorageCadProjectHost (standalone)
      -> AsaLabCadProjectHost (ASA Lab)
```

The UI no longer serializes/parses/saves directly to `localStorage`. Standalone localStorage remains an implementation detail of `LocalStorageCadProjectHost`; the legacy raw JSON key is only a compatibility mirror.

`CadProjectSession` owns optimistic revision, mutation-id idempotency and recovery coordination.

### Permanent protection

- `tests/m2o/persistence-session.ts`;
- `tests/m2o/persistence-boundary.mjs`;
- existing M1B host/recovery tests;
- full protected Part browser save/reopen regression;
- Docker `/cad/*` release regression.

---

## O4 — Introduce the shared typed UI action model — P0 — ACTIVE

### Problem

Desktop controls are still primarily hand-wired React elements. Mobile must not discover or click desktop DOM controls. Registry metadata is not yet an executable presentation layer.

### Foundation already landed

`src/web/CadUiAction.ts` now defines the shared typed runtime presentation model and helpers:
- stable registry-owned command identity/labels/status/presentation;
- editor-state enablement/disabled reason/checked state;
- typed execution callback;
- shared action indexing/search/execution;
- planned/deferred commands cannot execute merely because an accidental callback exists.

`tests/m2o/ui-actions.ts` protects the contract and proves that desktop/mobile can consume the same action object.

### Remaining work to close O4

- create the permanent action bindings for the accepted M2 command set;
- make desktop ribbon/global controls consume `CadUiAction` objects;
- make command search consume the same action collection rather than raw registry rows;
- route shortcut actions to the same underlying action execution where the command is shared;
- expose the same action objects to the mobile Tools presentation when that surface is mounted;
- keep interaction-only shortcuts (`Esc`, commit/cancel, camera motion where appropriate) in the central interaction layer rather than forcing them into product command IDs.

### Acceptance

- [ ] desktop and mobile can render the same command from one action definition;
- [ ] no mobile→desktop DOM delegation;
- [ ] command search consumes the shared action model;
- [ ] shortcut dispatch and visual command dispatch resolve to the same underlying action/application behavior where appropriate;
- [ ] protected browser workflow remains green.

---

## O5 — Decompose only the M3-critical responsibilities from `App.tsx` — P1

### Problem

The existing size guard prevents further growth but does not reduce current coupling.

### Target ownership

Move toward:

```text
src/editor/
  CadEditor.tsx
  CadEditorController.ts
  CadEditorState.ts
  commands/
  shell/
    DesktopShell.tsx
    MobileShell.tsx
  panels/
    DocumentTree.tsx
    ParameterPanel.tsx
  workspaces/
    PartWorkspace.tsx
    SketchWorkspace.tsx
```

Names can change; ownership must not.

### Extraction order

1. command/action presentation;
2. persistence/session orchestration;
3. DocumentTree;
4. ParameterPanel;
5. Sketch/Part workspace command presentation needed by M3;
6. only then additional shell/controller extraction when justified.

Do **not** rewrite the whole editor before M3.

### Acceptance for M3 entry

- [ ] `App.tsx` materially decreases in size;
- [ ] new M3 command families have a focused owner and do not require adding large command blocks to `App.tsx`;
- [ ] DocumentTree/ParameterPanel/persistence/action presentation have clear owners;
- [ ] protected Part E2E remains unchanged from the user's perspective;
- [ ] no extracted component imports vendor/OpenCascade internals.

### Guard evolution

After each extraction, lower the `MAX_APP_BYTES` architecture limit so code cannot grow back.

---

## O6 — Replace the M3 growth path in the application switch with handlers — P1

### Problem

`CadApplicationImpl` will become the next god-object when M3 adds many sketch/constraint/dimension commands.

### Work

Introduce focused command dispatch for the command families M3 will expand, for example:

```text
src/application/commands/
  sketch/
  constraint/
  dimension/
```

Part/document handlers may remain in the current implementation temporarily if they are stable and are not the M3 growth hotspot.

The application remains the owner of:
- document state;
- history/undo/redo;
- command transaction boundaries;
- subscriptions;
- runtime coordination.

### Acceptance for M3 entry

- [ ] adding a new Sketch/Constraint/Dimension command no longer requires substantially growing one central switch;
- [ ] handler failures remain atomic;
- [ ] undo/redo semantics remain centralized and tested;
- [ ] existing M1/M2 command tests stay green.

---

## O7 — Strongly type the M3 data surface — P1

### Problem

Current Part/Sketch contracts intentionally use broad fields such as `type: string` and `Record<string, unknown>`. That was sufficient for the vertical proof but is unsafe for a full sketcher.

### Scope

Type **only the data surface required by M3 now**.

Required first:
- sketch entities;
- constraints;
- dimensions.

Use discriminated unions, for example:

```ts
type CadSketchEntity =
  | CadLineEntity
  | CadCircleEntity
  | CadArcEntity
  | CadPointEntity;
```

Do not redesign Drawing/Specification/Text schemas during this gate.

### Acceptance

- [ ] invalid M3 entity shapes fail TypeScript or validation;
- [ ] existing schemaVersion remains compatible or migration is explicit;
- [ ] parse/serialize round-trip tests cover typed sketch entities;
- [ ] PlaneGCS adapter consumes typed ASA DTOs, not ad-hoc records.

---

## O8 — Split only the viewport responsibilities M3 will extend — P1

### Problem

`CadViewport.tsx` already owns rendering, camera, navigation, raycasting, selection, touch and view commands. Future rectangle selection, ambiguity chooser and previews would make it another god-object.

### Work

Extract the responsibilities required for upcoming M3 interaction growth, primarily:

```text
SelectionController
Pointer/Touch interaction controller
Preview layer/controller
```

Camera/render code may remain where it is if stable and not blocking M3.

React remains responsible for lifecycle/composition, not all interaction algorithms.

### Acceptance for M3 entry

- [ ] future sketch selection/preview can be added without expanding one monolithic viewport event block;
- [ ] mouse navigation tests remain green;
- [ ] touch gesture tests remain green;
- [ ] body/face/edge picking remains green;
- [ ] view/camera persistence remains green.

---

# Non-blocking follow-up lanes

The following work is important but must not hold M3 hostage once O1–O8 meet their entry criteria.

## O9 — Establish ASA-owned dependency/toolchain direction — P2

### Goal

Stop creating new ASA-only dependencies inside vendor metadata.

### Minimum work before/alongside M3

- document which dependencies belong to ASA root versus vendor;
- ensure any **new** ASA-only package is root-owned;
- preserve independent vendor reproducibility.

A full migration of React/Three/Rspack/TypeScript out of the vendor dependency tree is **not required before M3** if current pinned tooling remains reproducible.

### Later acceptance

- root-owned dependency lock exists when needed for ASA-only dependencies;
- vendor baseline remains independently reproducible;
- build/runtime versions are pinned intentionally.

---

## O10 — Harden repository change flow — P2

### Goal

Prefer:

```text
feature branch -> CI -> PR -> green -> main
```

### Rule

If repository permissions allow branch protection/rulesets, enable them. If the available GitHub integration cannot administer them, record that limitation and still use short branches/PRs operationally for high-risk M3 changes.

**GitHub administration is not an M3 code blocker.**

---

## O11 — Complete M2 visual acceptance on the optimized shell — parallel M2V

M2V should start only after O4/O5 stabilize the command/presentation structure, but **pixel-perfect KOMPAS visual completion is not required before M3 begins**.

Reason: M3 introduces a real Sketch workspace and will change parts of the command surface. Finishing every Sketch visual detail before that would cause avoidable rework.

Before M3:
- baseline desktop shell hierarchy must be coherent;
- deterministic fixtures must remain available;
- no known visual defect may block use of the protected Part workflow.

During/after early M3:
- complete KOMPAS reference screenshot comparisons;
- tune Sketch-specific layout once the real Sketcher exists;
- finish ASA-owned vector icon set;
- record owner visual acceptance.

---

# M3 entry gate

M3 may start when **all blocking items below** are true:

- [x] O1 architecture documentation corrected;
- [x] O2 command/layout registries cross-validated and statuses truthful;
- [x] O3 editor persistence goes through `CadProjectSession`/host boundary;
- [ ] O4 shared typed action model exists and is consumed by permanent presentation paths;
- [ ] O5 M3-critical UI responsibilities are extracted and `App.tsx` is materially smaller;
- [ ] O6 Sketch/Constraint/Dimension command growth has focused handlers;
- [ ] O7 Sketch entity/constraint/dimension contracts are strongly typed;
- [ ] O8 Sketch selection/preview interaction can grow outside a monolithic viewport event block;
- [ ] protected Part workflow is green after the final blocking step;
- [ ] M1/M1B regressions are green after the final blocking step;
- [ ] M2 shell/browser responsive/touch gates are green after the final blocking step;
- [ ] Docker `/cad/*` release gate is green after the final blocking step.

The following do **not** block M3 once the gate above is green:
- full dependency/toolchain migration (O9);
- GitHub branch-protection administration (O10);
- final pixel-perfect KOMPAS/M2V closeout (O11).

---

# Execution discipline for agents

For every O-step:

1. read `STATUS.md`, `ARCHITECTURE.md`, this file and the affected source/spec only;
2. change one ownership boundary at a time;
3. do not combine unrelated feature work with the optimization commit;
4. add/strengthen a regression before removing the old path when practical;
5. keep accepted browser behavior unchanged unless the O-step explicitly changes UI presentation;
6. stop when the step's acceptance criteria are satisfied — do not continue refactoring merely because more cleanup is possible;
7. update this checklist only after the corresponding tests are green;
8. update `STATUS.md` when an O-step materially changes the next action.

If an O-step reveals that this plan is wrong, update this file **before** implementing a different architecture so the plan and code do not diverge silently.

## Immediate next action

Continue **O4** by wiring permanent presentation paths to the shared `CadUiAction` collection. Do not begin M3 while O4 remains open.
