# ASA-CAD roadmap

## M0 — Upstream baseline

**Goal:** reproduce ToubkalCAD in ASA-CAD without product redesign.

Tasks:
- import a pinned ToubkalCAD baseline with source attribution;
- preserve the upstream license and third-party notices;
- make `npm ci`, `npm run build`, `npm test`, and `npm run lint` pass;
- record upstream commit SHA and dependency lock state;
- add an ASA-specific smoke workflow that verifies application boot;
- freeze a reference parametric part regression.

Acceptance:
- imported baseline builds from a clean checkout;
- supported upstream regression suite is green;
- reference part can be built, edited upstream, recomputed, saved and reopened;
- no ASA UI changes yet.

## M1 — Extract ASA CAD boundary

**Goal:** stop product code from depending directly on Toubkal internals.

Tasks:
- introduce `src/asa/application` public API;
- introduce product-level command IDs and DTOs;
- wrap geometry/recompute/solver/picking behind adapters;
- define `CadDocument` v1 and migration contract;
- add architecture tests that forbid UI imports from upstream service/store internals;
- add deterministic recompute tests for the reference part.

Acceptance:
- a headless test creates/edits the reference part through the ASA API only;
- no test needs to reach `window.oc`, raw OCC services, or Toubkal UI components;
- serialized `CadDocument` can recreate the model.

## M2 — KOMPAS-oriented application shell

**Goal:** replace the visible Toubkal shell while retaining the CAD runtime.

Tasks:
- document tabs and application top bar;
- command/ribbon area;
- model/history tree;
- parameter/task panel;
- central 3D viewport;
- status bar;
- confirm/cancel command lifecycle;
- Russian terminology for the selected learning scope.

Acceptance:
- the old Toubkal shell is not required for the reference workflow;
- all UI actions call the ASA application API only;
- the reference part workflow stays green.

## M3 — Sketcher parity foundation

**Goal:** make the first-class sketch workflow suitable for teaching KOMPAS-like modeling.

Initial commands:
- line;
- circle;
- arc;
- rectangle;
- trim;
- construction geometry;
- coincidence;
- horizontal;
- vertical;
- parallel;
- perpendicular;
- tangent;
- concentric;
- equal;
- fixed;
- point-on-curve;
- linear/horizontal/vertical/angular/radius/diameter dimensions.

Acceptance:
- under/fully-constrained state is visible;
- redundant/conflicting constraints are reported;
- drag and dimension editing keep solver state valid;
- save/reopen retains sketch intent.

## M4 — Part modeling core

**Goal:** cover the main school-level solid modeling workflow.

Initial features:
- extrusion;
- cut extrusion;
- revolution;
- cut revolution;
- hole;
- fillet;
- chamfer;
- linear pattern;
- circular pattern;
- mirror.

Later features:
- sweep;
- loft;
- shell;
- rib;
- draft;
- datum planes/axes/points.

Acceptance:
- editing an early sketch recomputes downstream features;
- broken references surface as explicit feature errors;
- no silent face/edge rebinding.

## M5 — ASA Lab integration

**Goal:** attach the stable standalone CAD module to ASA Lab.

Tasks:
- register new module key, e.g. `cad` / project type `cad-part`;
- map ASA Lab project ID to ASA-CAD document;
- use ASA Lab draft revision/mutation conflict handling;
- autosave through existing project APIs;
- generate project-card snapshots;
- versions/checkpoints and restore;
- assignment/submission flow;
- viewer/read-only mode.

Acceptance:
- learner creates a CAD project in ASA Lab;
- model computes on learner machine;
- work is saved to the learner project;
- the same project opens on another computer;
- teacher can open the pinned submitted version.

## M6 — Upstream update lane

**Goal:** safely consume selected upstream improvements after the product diverges visually.

For every upstream update:
1. record upstream base and target SHA;
2. inspect upstream changes by subsystem;
3. port geometry/solver/recompute fixes through adapters;
4. run M0/M1 regression gates;
5. run saved-document compatibility fixtures;
6. merge only after all gates pass.

Never auto-merge upstream `main` into a release branch.

## First executable milestone

The first implementation milestone is not UI parity. It is a protected reference workflow:

`Sketch 60×40 → Extrude 10 → Ø12 cut → Fillet → edit 60→80 → recompute → save → reopen`.

Everything else is built without breaking this gate.
