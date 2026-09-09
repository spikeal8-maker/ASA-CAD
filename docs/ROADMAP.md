# ASA-CAD implementation roadmap

This file defines the implementation order. `docs/SYSTEM_SPEC.md` defines the required end state.

## Status legend

- **DONE** — acceptance gate proven.
- **ACTIVE** — current implementation lane.
- **NEXT** — should start after the active gate.
- **BLOCKED** — must not start until its prerequisite is accepted.
- **ONGOING** — permanent maintenance lane.

## Program-level rules

1. Preserve the protected Part workflow through every milestone.
2. Once Assembly foundation exists, preserve the protected Assembly workflow too.
3. UI work must use ASA-owned APIs, never raw vendor internals.
4. Geometry and assembly calculations stay on the active client device.
5. ASA Lab remains identity/class/project/version/submission infrastructure, not a CAD compute server.
6. Saved `CadDocument` compatibility is a release boundary.
7. Upstream updates are intentional and pinned; never auto-merge upstream `main`.
8. ASA-CAD must remain independently runnable/testable in its own Docker image.

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

- Add ASA-owned protected Part workflow fixture:
  `Sketch 60x40 -> Extrude 10 -> centered diameter-12 cut -> Fillet -> edit 60 to 80 -> recompute -> save -> reopen`.
- Verify required upstream license/third-party notices remain present in the imported baseline.
- Make the protected Part workflow part of CI.

### Acceptance

M0 is DONE only when a clean checkout passes build/lint/regressions and the protected Part is reproducible in CI.

Tracking: #1.

---

## M0D — Standalone Docker execution surface

**Status: ACTIVE, initial container scaffold added**

### Goal

Make ASA-CAD independently launchable and inspectable without ASA Lab using the same frontend-container model planned for production.

### Already added

- root `Dockerfile`;
- `docker/Caddyfile`;
- `compose.yaml`;
- default standalone address `http://localhost:8088`;
- CAD-local COOP/COEP headers for the current imported runtime;
- Docker image build workflow in GitHub Actions.

### Remaining gate

- prove Docker image build in CI;
- start the image and verify `/health/live`;
- start a real browser against the container and verify the editor boots;
- make standalone persistence use a defined local/mock `CadProjectHost` boundary as M1 stabilizes;
- add browser smoke/E2E test entry point.

### Acceptance

`docker compose up --build` starts a usable ASA-CAD editor without ASA Lab, and CI proves the actual image boots in a browser-compatible configuration.

Tracking: #12.

See `docs/RUN_AND_DEPLOY.md`.

---

## M1 — ASA-owned CAD application/document boundary

**Status: NEXT**

### Goal

Stop future ASA product code from depending on Toubkal implementation details and define both Part and Assembly document families.

### Deliverables

- `CadDocument = CadPartDocument | CadAssemblyDocument`;
- `document.kind = part | assembly`;
- document `schemaVersion` + ASA-CAD `engineVersion`;
- stable ASA-owned feature/sketch/entity/occurrence IDs;
- explicit document migration contract;
- `CadApplication` typed command/state API;
- adapters around geometry, recompute, solver, picking and measurement;
- initial adapter boundary for assembly occurrences/mates even if M4A implements full assembly behavior later;
- undo/redo through ASA-owned commands;
- architecture checks forbidding product UI imports from vendor internals;
- deterministic rebuild of serialized documents.

### First required Part command surface

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

The protected Part is created, edited, serialized, destroyed, restored and recomputed **through `CadApplication` only**.

No acceptance test reaches `window.oc`, raw `TopoDS_Shape`, vendor Zustand internals, raw vendor events or Toubkal UI components.

Tracking: #2.

---

## M1B — Client runtime, container and ASA Lab host contract

**Status: BLOCKED by stable M1 public boundary; deployment design already defined**

### Goal

Prove that the same ASA-CAD release/container can run standalone and behind ASA Lab while all CAD mathematics remains on the learner device.

### Deliverables

- versioned `asa-cad-web` image/release artifact;
- public editor and read-only viewer routes;
- `CadProjectHost` persistence interface;
- same-origin production route under `/cad/*`;
- content-hashed CAD/WASM loading and caching;
- device capability probe before kernel start;
- local IndexedDB unsent-work recovery;
- isolated production handling for SharedArrayBuffer/COOP/COEP;
- standalone host and ASA Lab host using the same ASA-owned document/application APIs;
- network test proving no normal geometry/assembly compute RPC path.

### Device rule

Supported desktop/tablet/phone devices execute the same `CadDocument` locally. Lower capability may reduce tessellation or impose safe complexity limits; it must not transparently move computation to the server.

### Acceptance

- standalone container and ASA Lab-routed container run the same released application;
- ordinary ASA Lab pages do not load CAD WASM;
- opening `/cad/*` loads the pinned CAD frontend/runtime;
- Part/Assembly calculations are observable on the active client;
- host traffic during modeling is persistence/education traffic, not geometry RPCs;
- same document opens on a second device;
- unsupported device fails safely.

Tracking: #4.

See `docs/RUN_AND_DEPLOY.md` and `docs/ASA_LAB_INTEGRATION.md`.

---

## M2 — ASA-owned KOMPAS-oriented application shell

**Status: BLOCKED by M1**

### Goal

Remove the visible Toubkal product shell and establish the final ASA-CAD interaction architecture for both Part and Assembly documents.

### Desktop reference shell

- document tabs/application top bar;
- new-document choice: **Деталь / Сборка**;
- KOMPAS-oriented top command/ribbon organization;
- Part model/history tree;
- Assembly component/mate tree;
- contextual parameters/task panel;
- central 3D viewport;
- command confirm/cancel controls;
- status bar;
- sketch/assembly constraint state feedback;
- Russian engineering terminology aligned to the KOMPAS teaching workflow;
- keyboard/mouse selection and camera behavior suitable for desktop CAD.

### Small screens

Use the same commands/document/runtime. Panels may collapse into drawers/tabs; do not create a different modeling model for mobile.

### Implementation rule

Every visible control dispatches ASA `CadApplication` commands. No new product component imports vendor UI/store/service internals.

### Acceptance

- old Toubkal shell is not required for protected workflows;
- protected Part workflow stays green;
- shell can switch Part/Assembly document command groups without vendor UI dependencies;
- visual regression fixtures cover the shell and first command states;
- UI can be changed without editing kernel/recompute implementation.

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

A learner can reproduce the first set of KOMPAS-oriented teaching sketches and those sketches remain parametric after reopen.

Tracking: #5.

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
- compatibility fixtures for earlier Part documents.

### Acceptance

Editing an early sketch/feature correctly updates downstream features or produces an explicit rebuild error. A changed topology never silently attaches a feature to a different face/edge.

Tracking: #6.

---

## M4A — Assembly foundation

**Status: BLOCKED by M1 + M2; implementation should start after Part/reference semantics are stable in M4**

### Goal

Make **Сборка** a real second CAD document mode before ASA-CAD is declared standalone beta or integrated into ASA Lab.

### Initial commands/behavior

- create Assembly document;
- insert Part;
- insert subassembly;
- multiple occurrences of same Part;
- fix/unfix component;
- move/rotate occurrence;
- replace component;
- explicitly update component version;
- hide/show/suppress occurrence;
- Assembly tree.

### Initial mates

- coincident/planar;
- concentric;
- parallel;
- perpendicular;
- distance;
- angle;
- fixed component.

### Cloud/version semantics

- Assembly occurrence references a known Part/subassembly project revision/version;
- newer source Part drafts do not silently mutate pinned Assembly versions;
- component update is explicit;
- submitted Assembly pins all required component versions;
- circular assembly references are rejected.

### Protected Assembly workflow

`create Parts -> create Assembly -> insert occurrences -> fix base -> add concentric + coincident/distance mates -> solve -> save -> reopen -> explicitly update/replace component -> recompute -> pin version -> reopen exact pinned version`

### Acceptance

Assembly reopens with the same component versions, occurrence identities and mate intent, and solves locally on the active device.

Tracking: #11.

See `docs/ASSEMBLIES.md`.

---

## M4B — Standalone product hardening and release packaging

**Status: BLOCKED by M4 + M4A**

### Goal

Turn the standalone repository into a release that ASA Lab can safely pin and consume.

### Deliverables

- versioned `asa-cad-web:<version>` image;
- documented public editor/viewer/document/application surface;
- document parser/migrations for Part + Assembly;
- runtime/kernel loader;
- content-hashed WASM/static assets;
- version metadata;
- Part + Assembly compatibility corpus;
- memory/runtime cleanup tests;
- representative desktop/tablet/phone capability matrix;
- startup and representative-operation performance measurements;
- crash/network recovery tests;
- real-browser E2E against the Docker image.

### Acceptance

A released ASA-CAD image can run standalone, opens supported Part/Assembly compatibility fixtures, and exposes no required direct `vendor/toubkal` dependency to its host.

Tracking: #7.

---

## M5 — ASA Lab integration using separate CAD frontend container

**Status: BLOCKED by M1B + M4B**

### Goal

Make ASA-CAD a first-class subject module inside ASA Lab while keeping the CAD frontend independently versioned/deployed.

### Module identity

```text
moduleKey: cad
projectType: cad-document
schemaVersion: 1
editorRoute: /cad/projects/:projectId
viewerRoute: /cad/view/:versionId
```

`CadDocument.kind` is `part` or `assembly`.

### ASA Lab deployment work

- add `asa-cad-web:<pinned version>` to production Compose/Coolify stack;
- route `/cad/*` to `asa-cad-web` before generic ASA Lab SPA handling;
- keep `/api/*` on existing ASA API;
- keep CAD frontend under same public origin/session;
- do not expose a second login;
- do not create a CAD compute backend.

### ASA Lab product work

- register `cad` in module registry;
- navigate CAD projects to `/cad/projects/:projectId`;
- implement ASA Lab `CadProjectHost` adapter using existing Project Core;
- autosave with `baseRevision` + `mutationId` protection;
- snapshot/project-card preview;
- versions/checkpoints/restore;
- assignment/course workflow with `moduleKey = cad`;
- Part/Assembly new-document/template selection;
- submission version pinning;
- Assembly component-version pinning/resolution;
- teacher viewer/review flow;
- permission/read-only handling;
- production headers/assets verified without breaking other modules.

### Acceptance

A learner can receive a Part or Assembly assignment, edit/save using local device compute, reopen on another supported device, submit a reproducible version and have the teacher open exactly that submitted version.

No unrelated ASA Lab page downloads the CAD kernel.

Tracking: #8.

---

## M6 — KOMPAS workflow parity expansion

**Status: BLOCKED by M5; iterative product lane**

### Goal

Expand from proven Part + Assembly foundations toward broader KOMPAS-oriented teaching coverage.

Possible later lanes:

- additional sketch/Part/Assembly commands;
- closer command grouping/shortcuts/selection behavior;
- component patterns/exploded views/interference;
- variables/expressions;
- measurements/analysis;
- technical drawing workflows;
- BOM-oriented data;
- import/export coverage;
- curriculum-specific templates/exercises.

Every new capability must use ASA APIs/documents and preserve compatibility.

Tracking: #9.

---

## M7 — Upstream update lane

**Status: ONGOING after M0**

Upstream is never a release dependency on `main`.

For every Toubkal update:

1. record baseline and target SHA;
2. inspect the diff by subsystem;
3. normally ignore vendor UI changes;
4. port useful kernel/solver/recompute/picking/assembly fixes through adapters;
5. run upstream baseline regressions;
6. run ASA protected Part workflow;
7. run protected Assembly workflow once M4A exists;
8. run saved-document compatibility corpus;
9. merge only after all gates pass.

See `docs/UPSTREAM.md`.

---

# Release gates

## Gate A — ASA CAD Core

Requires M0 + M0D + M1.

Result: reproducible standalone baseline, Docker execution surface and ASA-owned document/application boundary.

## Gate B — ASA CAD Editor Alpha

Requires M1B + M2 + M3.

Result: KOMPAS-oriented shell + real parametric sketching + client-side runtime/container contract.

## Gate C — ASA CAD Standalone Beta

Requires M4 + M4A + M4B.

Result: useful Part + Assembly CAD, stable references, compatibility and versioned standalone Docker release.

## Gate D — ASA Lab CAD Module

Requires M5.

Result: first-class ASA Lab CAD module using a pinned same-origin `asa-cad-web` container with classes/projects/versions/submissions and local device computation.

## Gate E — Broader KOMPAS Teaching Coverage

M6 iterative releases.

---

# Immediate next work

1. Finish M0 protected Part workflow CI fixture.
2. Finish M0D Docker build/boot/browser smoke gate.
3. Start M1: define `CadDocument` union (`part | assembly`) and `CadApplication` public contracts.
4. Implement protected Part workflow entirely through that API.
5. Prove M1B standalone + same-origin ASA Lab container/host contract.
6. Begin the KOMPAS-oriented visible shell in M2.
7. Complete sketcher (M3), Part Design (M4), then Assembly foundation (M4A) before standalone beta/integration.
