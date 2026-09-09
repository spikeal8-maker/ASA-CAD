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

## M1B — Device runtime and ASA Lab host contract

**Goal:** make the standalone CAD explicitly embeddable in ASA Lab without moving geometry computation to the server.

Tasks:
- define versioned ASA-CAD release artifact and public editor/viewer entry points;
- define the `CadProjectHost` storage adapter;
- lazy-load the CAD bundle and OpenCascade WASM only when a CAD project opens;
- keep geometry/solver/recompute/tessellation/export execution on the active client device;
- add browser/device capability probing;
- add local IndexedDB crash/network recovery without making it project authority;
- isolate current Toubkal `SharedArrayBuffer`/cross-origin-isolation requirements behind the kernel loader and determine the production-safe runtime form;
- prove that ordinary ASA Lab modules do not download CAD WASM.

Acceptance:
- standalone host and an ASA Lab test host can open the same `CadDocument`;
- no normal CAD operation requires a geometry RPC/server compute endpoint;
- kernel/runtime is loaded on demand and cacheable;
- unsupported devices fail safely without document corruption;
- host API contains project persistence only, not Toubkal/OpenCascade internals.

See `docs/ASA_LAB_INTEGRATION.md`.

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
- Russian terminology for the selected learning scope;
- responsive panel presentation on smaller screens without changing the command/document model.

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

**Goal:** attach the stable standalone CAD module to ASA Lab using the already-defined M1B host contract.

Tasks:
- register module key `cad` / project type `cad-part`;
- lazy-load the released ASA-CAD editor from `ModuleEditorHost`;
- map ASA Lab project ID to ASA-CAD `CadDocument` through `CadProjectHost`;
- use ASA Lab draft revision/mutation conflict handling;
- autosave through existing project APIs;
- generate project-card snapshots;
- versions/checkpoints and restore;
- assignment/submission flow;
- viewer/read-only mode;
- validate client-side execution on representative desktop/tablet/phone devices.

Acceptance:
- learner creates or receives a CAD project in ASA Lab;
- model computes on learner device;
- work is saved to the learner project;
- the same project opens on another computer/device;
- teacher can open the pinned submitted version;
- no unrelated ASA Lab page downloads the CAD kernel.

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
