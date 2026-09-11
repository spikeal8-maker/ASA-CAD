# ASA-CAD roadmap

This file defines **implementation order and acceptance boundaries only**.

Current implementation state and immediate work: [`STATUS.md`](STATUS.md).  
Product/end-state contract: [`SYSTEM_SPEC.md`](SYSTEM_SPEC.md).

Do not turn this file into a commit diary. Milestone progress belongs in GitHub issues and `STATUS.md`.

## Program invariants

Every milestone preserves:
- client-side CAD computation;
- ASA-owned `CadDocument` / `CadApplication` boundary;
- standalone browser/Docker operation;
- saved-document compatibility or explicit migrations;
- protected Part workflow;
- protected Assembly workflow after M4A;
- intentional/pinned vendor updates only.

Permanent UI is ASA-owned. Toubkal visible UI is diagnostic/reference only.

---

## Gate A — ASA CAD Core

### M0 — Imported CAD baseline — #1
Pin/reproduce upstream runtime, licenses and protected geometry baseline.

Acceptance: clean checkout reproduces protected Part kernel workflow.

### M0D — Standalone release surface — #12
Standalone Docker/browser surface, `/cad/*` deep mounting, COOP/COEP and browser E2E.

Acceptance: release image runs protected Part locally without ASA Lab or CAD backend compute.

### M1 — ASA application/document boundary — #2
Six document kinds, stable IDs, commands, migrations, undo/redo, runtime/solver/reference/render/measurement boundaries.

Acceptance: product UI never requires raw OCC/Toubkal/store objects.

### M1U — KOMPAS v25 inventory — #16
Maintain the classified KOMPAS command/reference inventory.

Acceptance: every adopted/omitted command family has an explicit classification.

### M1B — Client runtime + host contract — #4
Lazy runtime, capability probe, recovery, standalone/ASA Lab `CadProjectHost`, `/cad/*` mount contract.

Acceptance: CAD loads only when needed and calculations stay on the client.

**Gate A acceptance:** M0 + M0D + M1 + M1U baseline + M1B.

---

## Gate B — ASA CAD Editor Alpha

### M2 — Permanent KOMPAS-oriented shell — #3
Build the ASA-owned product shell and keep the protected Part vertical slice working through it.

Required shell owners:
- application/document tabs;
- workspace/command presentation;
- Tree/Parameters surfaces;
- WorkArea/viewport;
- quick access/status/search;
- desktop/mobile composition.

Do not keep growing a single `App.tsx`; responsibilities must move to focused controllers/components before M3 expands the command surface.

### M2A — Deterministic visual fixtures — #15
Stable `/dev/...` states for owner review and browser/screenshot regression.

Part baseline:
- `/dev/part/empty`;
- `/dev/part/sketch`;
- `/dev/part/extrude`;
- `/dev/part/reference`;
- `/dev/part/rebuild-error`.

Acceptance: visual correction never requires manually recreating the model or starting ASA Lab.

### M2I — Workspace/input/mobile — #17
One interaction model for desktop, touch and hybrid devices:
- selection/preselection;
- Tree↔Viewport sync;
- typed face/edge/subshape picking;
- orbit/pan/zoom/views;
- central shortcuts;
- touch gestures;
- mobile Tree/Parameters/Tools surfaces;
- command preview/phantom;
- ambiguity/context handling.

Acceptance: desktop and supported touch device operate the same native Part document and command IDs without DOM delegation between presentations.

### M2R — Display/DPI/zoom/UI Scale — #18
Effective viewport layout, HD→4K/ultrawide, DPR, browser zoom, phone/tablet and UI Scale.

Acceptance: matrix/picking/readability gates pass together. Exact current status is in `STATUS.md`/issue #18.

### M2V — KOMPAS visual acceptance — #19
Map deterministic ASA states to approved KOMPAS references; tune hierarchy/proportions/spacing and ASA-owned vector icons.

Acceptance: baseline and responsive visual review passes with deliberate differences recorded.

### M2O — Architecture optimization gate — #21
Stabilize the product architecture before M3 expands the command/data surface.

Execution source of truth: [`M2O_OPTIMIZATION_GATE.md`](M2O_OPTIMIZATION_GATE.md).

Required outcomes include:
- mandatory docs agree on the six-document architecture;
- command/layout registries are cross-validated and statuses are truthful;
- editor persistence uses the `CadProjectSession` / host boundary;
- desktop/mobile consume one typed command/action model;
- `App.tsx`, `CadApplicationImpl` and viewport responsibilities are decomposed enough for M3 growth;
- M3 sketch entities/constraints/dimensions have strong typed contracts;
- ASA dependency/toolchain ownership has a reproducible direction;
- safer branch/CI workflow is established where repository permissions allow.

Acceptance: every checkbox in `M2O_OPTIMIZATION_GATE.md` required to start M3 is satisfied while existing Part/browser/Docker regressions remain green.

### M3 — Parametric Sketch — #5
**Blocked by M2O.**

First complete sketcher foundation:
- line/circle/arc/rectangle and required construction geometry;
- constraints;
- driving dimensions;
- PlaneGCS solve cycle;
- under/fully/over-constrained diagnostics and DOF feedback;
- direct canvas editing;
- save/reopen/migrations;
- desktop/mobile command presentation.

Acceptance: a real constrained sketch remains editable/recomputable after save/reopen and drives Part features.

**Gate B acceptance:** accepted M2 program + M2O + M3.

---

## Gate C — Standalone CAD Beta

### M4 — Part Design + topology robustness — #6
Expand exact B-Rep Part features and persistent reference behavior.

Priority families include extrude/cut/revolve/hole/fillet/chamfer/shell/rib/draft/patterns/sweep/loft as deliberately promoted from the registry.

Acceptance includes a broad StableRef/topology-change corpus, rebuild diagnostics and compatible save/reopen.

### M4A — Assembly — #11
Bottom-up and top-down Assembly:
- Part/subassembly occurrences;
- pinned versions;
- positioning/mates;
- base fixation;
- context Part editing;
- explicit component update/replace;
- protected Assembly regression.

Acceptance: submitted/reopened Assembly resolves the exact pinned component versions and mates without server CAD computation.

### M4B — Standalone beta hardening — #7
Versioned `asa-cad-web` image, compatibility corpus, recovery, cleanup, browser/device performance/capability matrix.

**Gate C acceptance:** M4 + M4A + M4B.

---

## Gate D — ASA Lab CAD Module

### M5 — ASA Lab integration — #8
Deploy pinned `asa-cad-web` behind `/cad/*` and connect existing ASA Lab Project Core/classes/assignments/versions/submission/teacher review.

Acceptance:
- no duplicate CAD persistence service;
- unrelated ASA pages do not fetch CAD/WASM;
- same native document opens across supported devices;
- geometry computation remains client-side.

---

## Gate E — Engineering documentation suite

### M6 — Drawing + Fragment — #13
Shared 2D drafting engine, sheets/views/sections/dimensions/annotations and reusable Fragment workflow.

### M6A — Specification + Text — #14
Structured BOM/specification and linked engineering text documents.

**Gate E acceptance:** model-derived documentation remains version-aware and exportable without becoming screenshot-only data.

---

## Gate F — Broader KOMPAS parity

### M7+ — Advanced functions — #9
Promote advanced commands deliberately from the maintained KOMPAS inventory: surfaces, sheet metal, advanced mates/drawing symbols, variables/templates/exchange and other approved workflows.

No automatic parity chase. Each promotion is a normal vertical slice with contract, UI metadata, fixture and regression.

---

## Definition of a completed feature

A feature is not done because a button is visible.

```text
ASA command/API
-> parameter/selection contract
-> document/runtime behavior
-> registry/layout metadata
-> desktop/mobile presentation
-> deterministic fixture
-> affected browser/kernel regression
-> save/reopen compatibility where applicable
-> issue/STATUS update
```

## Current work

Do not infer current work from milestone order. Read [`STATUS.md`](STATUS.md), [`M2O_OPTIMIZATION_GATE.md`](M2O_OPTIMIZATION_GATE.md) and the active GitHub issue.
