# M2O — Architecture Optimization Gate

This document is the **execution checklist before M3 Parametric Sketch**.

It exists to prevent ASA-CAD from entering M3 with known structural debt that would make every new sketch command expensive, duplicated or unsafe.

Current product status belongs to [`STATUS.md`](STATUS.md). Long-term architecture belongs to [`ARCHITECTURE.md`](ARCHITECTURE.md). This file answers only one question:

> **What must be fixed, in what order, before M3 may start?**

## Gate rule

**Do not add new CAD feature families while M2O is open.**

Allowed during M2O:
- refactoring without changing accepted behavior;
- registry/documentation corrections;
- persistence wiring;
- typing existing contracts;
- extracting controllers/components/handlers;
- strengthening tests/CI;
- M2A/M2V visual correction if it does not bypass this plan.

Not allowed during M2O:
- broad new Sketch command families;
- new Part feature families;
- Assembly implementation;
- direct UI calls into OpenCascade/vendor internals;
- new hard-coded desktop/mobile command duplication;
- increasing `App.tsx` or `CadApplicationImpl` instead of extracting ownership.

---

# Execution order

The order below is mandatory unless a discovered blocker requires a documented change.

## O1 — Fix mandatory architecture documentation — P0

### Problem

`SYSTEM_SPEC.md` and actual TypeScript support six document kinds, while `ARCHITECTURE.md` still describes only Part/Assembly as the public document union.

### Work

- update `docs/ARCHITECTURE.md` to the six-document model:
  - `part`;
  - `assembly`;
  - `drawing`;
  - `fragment`;
  - `specification`;
  - `text`;
- distinguish current runtime maturity from public document architecture;
- keep Part/Assembly-specific exact-geometry rules without implying the other four do not exist;
- ensure `SYSTEM_SPEC.md`, `ARCHITECTURE.md`, `STATUS.md` and `src/contracts/document.ts` use the same terminology.

### Acceptance

- [ ] no mandatory source-of-truth says there are only two document kinds;
- [ ] six kinds match `CadDocumentKind` in code;
- [ ] architecture still makes clear that current exact 3D runtime is intentionally Part-focused.

### Required checks

- `npm run typecheck:asa`
- documentation consistency test added or extended.

---

## O2 — Make command/layout registries internally consistent — P0

### Problem

`command-registry.v1.json` and `layout-registry.v2.json` contain divergent command IDs and stale implementation statuses.

Examples already observed include naming differences such as pattern/check/measurement command IDs.

### Work

Create one validator that checks both registries.

For every command ID referenced by layout:
- command must exist in command registry;
- command kind/workspace placement must be compatible;
- implemented commands must have valid backend/action mapping where applicable.

For production-visible commands:
- they must have a layout placement or an explicitly documented non-ribbon surface;
- they must not remain silently orphaned.

Normalize duplicate/divergent IDs instead of adding aliases indefinitely.

### Status vocabulary

Use only:

```text
planned
implemented
experimental
deferred
```

`implemented` means the accepted product path exists, not merely a backend method.

### Acceptance

- [ ] every layout command resolves to one command-registry entry;
- [ ] no duplicate semantic command uses multiple IDs without an explicit compatibility reason;
- [ ] currently accepted M2 commands have correct `implemented` status;
- [ ] CI fails on future registry drift.

### Required checks

Add a dedicated test, e.g.:

```text
tests/m2/registry-integrity.mjs
```

and include it in `test:m2:shell`.

---

## O3 — Route product persistence through `CadProjectSession` — P0

### Problem

M1B introduced `CadProjectHost`, recovery and session boundaries, but the M2 product shell still saves/opens directly through `localStorage`.

That bypass would force Save/Open to be rewritten again during ASA Lab integration.

### Work

- make `CadProjectSession` the editor persistence boundary;
- standalone mode uses the standalone/local host adapter;
- future ASA Lab mode uses `AsaLabCadProjectHost` without changing editor UI;
- preserve local recovery behavior;
- remove direct document persistence logic from `App.tsx`;
- keep localStorage only behind the standalone/recovery implementation if still appropriate.

### Acceptance

- [ ] UI does not serialize/save project documents directly;
- [ ] Save/Open use `CadProjectSession`/`CadProjectHost`;
- [ ] revision + `mutationId` semantics remain tested;
- [ ] protected Part save/reopen browser test remains green;
- [ ] ASA Lab adapter can be substituted without changing command UI.

### Required checks

- existing M1B host/recovery tests;
- protected Part browser E2E;
- new editor-session persistence regression.

---

## O4 — Introduce the shared typed UI action model — P0/P1

### Problem

Desktop controls are still primarily hand-wired React elements. Mobile must not discover or click desktop DOM controls. Registry metadata is not yet an executable presentation layer.

### Work

Introduce a typed model, for example:

```ts
interface CadUiAction {
  id: string;
  label: string;
  enabled: boolean;
  disabledReason?: string;
  checked?: boolean;
  groupId: string;
  presentation: 'button' | 'split-button' | 'dropdown' | 'toggle';
  execute(): void | Promise<void>;
}
```

Exact shape may evolve, but requirements are fixed:
- command identity comes from ASA command IDs;
- enablement is derived from editor/application state;
- desktop and mobile consume the same action objects;
- action execution must not depend on locating another presentation's DOM node.

### Acceptance

- [ ] desktop and mobile can render the same command from one action definition;
- [ ] no mobile→desktop DOM delegation;
- [ ] command search can consume the same model;
- [ ] shortcut dispatch and visual command dispatch resolve to the same underlying action/application behavior where appropriate.

---

## O5 — Start real decomposition of `App.tsx` — P1

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
5. Desktop shell composition;
6. Mobile shell composition;
7. remaining editor controller state.

Do **not** rewrite everything in one commit.

### Acceptance

- [ ] `App.tsx` materially decreases in size instead of only staying under the old ceiling;
- [ ] extracted modules have narrow responsibilities;
- [ ] protected Part E2E remains unchanged from the user's perspective;
- [ ] no component imports vendor/OpenCascade internals.

### Guard evolution

After each extraction, lower the `MAX_APP_BYTES` architecture limit so code cannot grow back.

---

## O6 — Replace the large application command switch with handlers — P1

### Problem

`CadApplicationImpl` will become the next god-object when M3 adds many sketch/constraint/dimension commands.

### Work

Introduce command dispatch by focused handlers, for example:

```text
src/application/commands/
  sketch/
  constraint/
  dimension/
  part/
  document/
```

The application remains the owner of:
- document state;
- history/undo/redo;
- command transaction boundaries;
- subscriptions;
- runtime coordination.

Individual command semantics move to handlers.

### Acceptance

- [ ] new M3 commands no longer require growing one central switch substantially;
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

Do not prematurely redesign Drawing/Specification/Text schemas during this gate.

### Acceptance

- [ ] invalid M3 entity shapes fail TypeScript or validation;
- [ ] existing schemaVersion remains compatible or migration is explicit;
- [ ] parse/serialize round-trip tests cover typed sketch entities;
- [ ] PlaneGCS adapter consumes typed ASA DTOs, not ad-hoc records.

---

## O8 — Decompose viewport interaction before adding more tools — P1

### Problem

`CadViewport.tsx` already owns rendering, camera, navigation, raycasting, selection, touch and view commands. Future rectangle selection, ambiguity chooser and previews would make it another god-object.

### Work

Extract controller-level responsibilities such as:

```text
CameraController
SelectionController
PointerController
TouchController
PreviewLayer / PreviewController
```

React remains responsible for lifecycle/composition, not all interaction algorithms.

### Acceptance

- [ ] mouse navigation tests remain green;
- [ ] touch gesture tests remain green;
- [ ] body/face/edge picking remains green;
- [ ] view/camera persistence remains green;
- [ ] future selection rectangle/preview can be added without expanding one monolithic viewport component.

---

## O9 — Establish ASA-owned dependency/toolchain ownership — P1/P2

### Problem

Root scripts currently execute TypeScript/tsx/build dependencies from `vendor/toubkal/node_modules`. This couples ASA product tooling to vendor dependency ownership.

### Work

Move toward a root-owned dependency lock for ASA tooling and product libraries.

The root should own, as appropriate:
- TypeScript;
- tsx/test tooling;
- React/Three used by ASA UI;
- build tooling;
- future ASA-only packages.

Vendor must remain independently installable/reproducible for upstream comparison.

This migration may be incremental. Do not copy the entire vendor dependency tree blindly.

### Acceptance

- [ ] ASA-only dependencies no longer need edits to vendor package metadata;
- [ ] `npm ci`/equivalent at root is reproducible;
- [ ] vendor baseline remains independently reproducible;
- [ ] build/runtime versions are pinned intentionally.

---

## O10 — Harden repository change flow — P2

### Problem

`main` is currently unprotected. Direct write workflows can place a broken commit on `main` before CI finishes.

### Target flow

```text
feature branch
-> CI
-> PR
-> required green checks
-> main
```

### Work

- enable branch protection/ruleset when repository permissions allow;
- require baseline + ASA shell tests for structural changes;
- require browser/Docker checks for affected UI/runtime/release changes;
- agents should prefer short branches/PRs for M3 onward.

### Acceptance

- [ ] ordinary development no longer relies on repairing `main` after a failed push;
- [ ] required checks are documented and enforced where GitHub permissions permit.

---

## O11 — Finish M2 visual acceptance on the optimized shell — P2

Do M2V **after** the command/presentation architecture is stable enough that visual work will not immediately be discarded.

### Work

- capture approved deterministic fixture screenshots;
- compare against mapped KOMPAS references;
- tune hierarchy, spacing, panel dimensions and command grouping;
- replace temporary symbols with ASA-owned vector icons;
- document deliberate differences.

### Acceptance

- [ ] #15 deterministic review evidence is complete;
- [ ] #19 visual acceptance criteria are satisfied;
- [ ] owner review is recorded;
- [ ] desktop/tablet/phone visual baselines are stable.

---

# M2O completion gate

M3 may start only when all of the following are true:

- [ ] O1 architecture documentation corrected;
- [ ] O2 command/layout registries cross-validated and statuses truthful;
- [ ] O3 editor persistence goes through `CadProjectSession`/host boundary;
- [ ] O4 shared typed action model exists and is used by product presentations;
- [ ] O5 `App.tsx` is materially decomposed and size ceiling reduced;
- [ ] O6 application command handlers are modular enough for M3 growth;
- [ ] O7 Sketch entity/constraint/dimension contracts are strongly typed;
- [ ] O8 viewport responsibilities are split enough for M3 interaction growth;
- [ ] O9 ASA dependency ownership has an accepted/reproducible direction;
- [ ] O10 safer branch/CI workflow is established or explicitly blocked by permissions;
- [ ] O11 M2 visual acceptance is complete or separately accepted as the final M2 closeout;
- [ ] protected Part workflow is green;
- [ ] M1/M1B regressions are green;
- [ ] M2 shell/browser responsive/touch gates are green;
- [ ] Docker `/cad/*` release gate is green.

---

# Execution discipline for agents

For every O-step:

1. read `STATUS.md`, `ARCHITECTURE.md`, this file and the affected source/spec only;
2. change one ownership boundary at a time;
3. do not combine unrelated feature work with the optimization commit;
4. add/strengthen a regression before removing the old path when practical;
5. keep accepted browser behavior unchanged unless the O-step explicitly changes UI presentation;
6. update this checklist only after the corresponding tests are green;
7. update `STATUS.md` when an O-step materially changes the next action.

If an O-step reveals that this plan is wrong, update this file **before** implementing a different architecture so the plan and code do not diverge silently.

## Immediate next action

Start with **O1**, then **O2**. Do not begin M3 while any P0 item remains open.
