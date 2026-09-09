# ASA-CAD implementation roadmap

This file defines the implementation order. `docs/SYSTEM_SPEC.md` defines the required end state.

## Status legend

- **DONE** — acceptance gate proven.
- **ACTIVE** — current implementation lane.
- **NEXT** — should start after the active gate.
- **BLOCKED** — must not start until its prerequisite is accepted.
- **ONGOING** — permanent maintenance lane.

## Program-level rules

1. Preserve the protected reference part through every milestone.
2. UI work must use ASA-owned APIs, never raw vendor internals.
3. Geometry computation stays on the active client device.
4. ASA Lab remains identity/class/project/version/submission infrastructure, not a CAD compute server.
5. Saved `CadDocument` compatibility is a release boundary.
6. Upstream updates are intentional and pinned; never auto-merge upstream `main`.

---

## M0 — Reproducible upstream baseline

**Status: ACTIVE, foundation mostly complete**

### Goal

Own a pinned, reproducible browser CAD baseline before product divergence.

### Completed

- ToubkalCAD imported under `vendor/toubkal/` as a pinned subtree.
- Exact upstream commit recorded in `UPSTREAM_BASELINE`.
- Root developer commands added.
- GitHub Actions baseline gate added.
- Clean install/build/typecheck/lint supported.
- Imported upstream CAD regression suite passes in GitHub Actions.
- Architecture, integration and upstream-update contracts documented.

### Remaining gate

- Add ASA-owned protected reference workflow fixture:
  `Sketch 60x40 -> Extrude 10 -> centered diameter-12 cut -> Fillet -> edit 60 to 80 -> recompute -> save -> reopen`.
- Verify required upstream license/third-party notices remain present in the imported baseline.
- Make the protected workflow part of CI.

### Acceptance

M0 is DONE only when a clean checkout passes build/lint/regressions and the protected reference part is reproducible in CI.

Tracking: #1.

---

## M1 — ASA-owned CAD application/document boundary

**Status: NEXT**

### Goal

Stop future ASA product code from depending on Toubkal implementation details.

### Deliverables

- `CadDocument` v1 schema, parser and serializer.
- document `schemaVersion` + ASA-CAD `engineVersion`.
- stable ASA-owned feature/sketch/entity IDs.
- explicit document migration contract.
- `CadApplication` typed command/state API.
- adapters around geometry, recompute, solver, picking and measurement.
- undo/redo through ASA-owned commands.
- architecture checks forbidding product UI imports from vendor internals.
- deterministic rebuild of a document from serialized data.

### First required command surface

- create sketch on origin plane;
- rectangle;
- dimensional constraints;
- finish sketch;
- extrude;
- create sketch on face;
- circle + diameter;
- cut extrusion;
- fillet;
- edit upstream dimension;
- recompute;
- undo/redo;
- serialize/restore.

### Acceptance

The protected reference part is created, edited, serialized, destroyed, restored and recomputed **through `CadApplication` only**.

No acceptance test reaches `window.oc`, raw `TopoDS_Shape`, vendor Zustand internals, raw vendor events or Toubkal UI components.

Tracking: #2.

---

## M1B — Client runtime and ASA Lab host contract

**Status: BLOCKED by the stable M1 document/application boundary; design already defined**

### Goal

Prove that ASA-CAD can be loaded by ASA Lab while all interactive CAD mathematics remains on the learner device.

### Deliverables

- versioned ASA-CAD release artifact;
- public editor and read-only viewer entry points;
- `CadProjectHost` persistence interface;
- lazy editor loading for `moduleKey = cad`;
- lazy content-hashed CAD/WASM loading;
- browser cache policy for runtime assets;
- capability probe before kernel start;
- local IndexedDB unsent-work recovery;
- explicit production strategy for current SharedArrayBuffer/COOP/COEP requirements;
- standalone host fixture and ASA Lab-like host fixture using the same public API;
- network test proving no normal geometry RPC/server compute path.

### Device rule

Supported desktop/tablet/phone devices execute the same `CadDocument` locally. Lower capability may reduce tessellation or impose safe complexity limits; it must not transparently move geometry computation to the server.

### Acceptance

- ordinary ASA Lab boot does not load CAD WASM;
- opening CAD lazy-loads editor + kernel;
- geometry/recompute/solver work is observable on the active client;
- host traffic during modeling is persistence/education traffic, not geometry RPCs;
- same document opens on a second device;
- unsupported device fails safely.

Tracking: #4.

---

## M2 — ASA-owned KOMPAS-oriented application shell

**Status: BLOCKED by M1**

### Goal

Remove the visible Toubkal product shell and establish the final ASA-CAD interaction architecture.

### Desktop reference shell

- document tabs/application top bar;
- KOMPAS-oriented top command/ribbon organization;
- model/history tree;
- contextual parameters/task panel;
- central 3D viewport;
- command confirm/cancel controls;
- status bar;
- sketch constraint state/DOF feedback;
- Russian engineering terminology aligned to the KOMPAS teaching workflow;
- keyboard/mouse selection and camera behavior suitable for desktop CAD.

### Small screens

Use the same commands/document/runtime. Panels may collapse into drawers/tabs; do not create a different modeling model for mobile.

### Implementation rule

Every visible control dispatches ASA `CadApplication` commands. No new product component imports vendor UI/store/service internals.

### Acceptance

- old Toubkal shell is not required for the protected workflow;
- protected workflow stays green;
- visual regression fixtures cover the shell and first command states;
- UI can be changed without editing the kernel/recompute implementation.

Tracking: #3.

---

## M3 — KOMPAS-oriented sketcher foundation

**Status: BLOCKED by M1 + M2**

### Goal

Make sketching suitable for actual parametric CAD teaching rather than demo geometry creation.

### Geometry tools

- line;
- circle;
- arc;
- rectangle;
- polygon;
- trim;
- extend;
- construction/centerline geometry;
- projected/reference geometry where reliable.

### Constraints

- coincident;
- horizontal;
- vertical;
- parallel;
- perpendicular;
- tangent;
- concentric;
- equal;
- symmetric;
- fixed;
- point on curve.

### Driving dimensions

- linear;
- horizontal;
- vertical;
- angular;
- radius;
- diameter.

### Required behavior

- under/fully-constrained state visible;
- redundant/conflicting constraints diagnosed;
- drag interaction preserves solver consistency;
- driving-dimension edit updates geometry;
- sketch state survives save/reopen exactly.

### Acceptance

A learner can reproduce the first set of teaching sketches using the same conceptual workflow expected in KOMPAS-3D, and those sketches remain parametric after reopen.

---

## M4 — Part Design feature core and stable references

**Status: BLOCKED by M3**

### Goal

Provide the main school-level parametric solid-modeling workflow with reliable downstream recompute.

### First feature wave

- extrusion;
- cut extrusion;
- revolution;
- cut revolution;
- hole;
- fillet;
- chamfer;
- mirror;
- linear pattern;
- circular pattern.

### Second feature wave

- sweep;
- loft;
- shell;
- rib;
- draft;
- datum planes/axes/points.

### Critical engineering work

- feature dependency graph;
- deterministic dirty propagation/recompute;
- persistent/stable logical references to faces/edges;
- explicit unresolved-reference state;
- no silent topology rebinding;
- compatibility fixtures for documents created by earlier engine releases.

### Acceptance

Editing an early sketch/feature correctly updates downstream features or produces an explicit rebuild error. A changed topology never silently attaches a feature to a different face/edge.

---

## M4B — Standalone product hardening and release packaging

**Status: BLOCKED by M4**

### Goal

Turn the standalone repository into a release that ASA Lab can safely pin and consume.

### Deliverables

- documented public package/release surface;
- editor entry point;
- viewer entry point;
- document parser/migrations;
- runtime/kernel loader;
- content-hashed WASM/static assets;
- version metadata;
- compatibility test corpus;
- memory/runtime cleanup tests;
- representative desktop/tablet/phone capability matrix;
- startup and representative-operation performance measurements;
- crash/network recovery tests.

### Acceptance

A released ASA-CAD version can be consumed without importing `vendor/toubkal` paths directly and can open all compatibility fixtures for its supported document schema range.

---

## M5 — Native ASA Lab integration

**Status: BLOCKED by M1B + M4B**

### Goal

Make ASA-CAD a normal first-class subject module inside ASA Lab.

### Module identity

```text
moduleKey: cad
projectType: cad-part
schemaVersion: 1
editorRoute: /projects/:projectId/cad
viewerRoute: /view/projects/:versionId/cad
```

### ASA Lab work

- register CAD in module registry;
- lazy-load pinned ASA-CAD editor in `ModuleEditorHost`;
- implement ASA Lab `CadProjectHost` adapter;
- map project open/save to existing Project Core;
- autosave with `baseRevision` + `mutationId` protection;
- snapshot/project-card preview;
- versions/checkpoints/restore;
- assignment/course workflow with `moduleKey = cad`;
- submission version pinning;
- teacher viewer/review flow;
- permission/read-only handling;
- production runtime headers/assets verified without breaking other modules.

### Acceptance

A learner can receive a CAD assignment, create/edit/save the model locally, reopen it on another supported device, submit a specific version and have the teacher open exactly that submitted version.

No unrelated ASA Lab page downloads the CAD kernel.

---

## M6 — KOMPAS workflow parity expansion

**Status: BLOCKED by M5; iterative product lane**

### Goal

Expand from the proven Part Design foundation toward broader KOMPAS-oriented teaching coverage.

Possible later lanes:

- additional sketch/feature commands;
- more precise command grouping/shortcuts/selection behavior;
- technical drawing workflows;
- assemblies and mates;
- variables/expressions;
- measurements/analysis;
- import/export coverage;
- curriculum-specific templates/exercises.

Every new capability must use ASA APIs/documents and preserve compatibility.

---

## M7 — Upstream update lane

**Status: ONGOING after M0**

Upstream is never a release dependency on `main`.

For every Toubkal update:

1. record baseline and target SHA;
2. inspect the diff by subsystem;
3. normally ignore vendor UI changes;
4. port useful kernel/solver/recompute/picking fixes through adapters;
5. run upstream baseline regressions;
6. run ASA protected reference part;
7. run saved-document compatibility corpus;
8. merge only after all gates pass.

See `docs/UPSTREAM.md`.

---

# Release gates

## Gate A — ASA CAD Core

Requires M0 + M1.

Result: we own the document/application boundary and can rebuild the protected part without vendor UI.

## Gate B — ASA CAD Editor Alpha

Requires M1B + M2 + M3.

Result: KOMPAS-oriented shell + real parametric sketching + client-side runtime delivery.

## Gate C — ASA CAD Standalone Beta

Requires M4 + M4B.

Result: useful Part Design CAD, stable references, compatibility and release packaging.

## Gate D — ASA Lab CAD Module

Requires M5.

Result: native ASA Lab module with classes/projects/versions/submission and local device computation.

## Gate E — Broader KOMPAS Teaching Coverage

M6 iterative releases.

---

# Immediate next work

1. Finish M0 by adding the ASA-owned protected reference workflow to CI.
2. Start M1: define `CadDocument` v1 and `CadApplication` public contracts before touching the product UI.
3. Implement the first reference workflow entirely through that API.
4. In parallel after the document boundary stabilizes, prove the M1B lazy client-runtime/host contract.
5. Only then begin the KOMPAS-oriented visible shell in M2.
