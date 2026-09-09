# ASA-CAD implementation roadmap

This file defines implementation order and acceptance gates. `docs/SYSTEM_SPEC.md` defines the required end state.

## Status legend

- **DONE** — acceptance gate proven.
- **ACTIVE** — current implementation lane.
- **NEXT** — should start after the active gate.
- **BLOCKED** — must not start until prerequisites are accepted.
- **ONGOING** — permanent maintenance lane.

## Program-level rules

1. Preserve the protected Part workflow through every milestone.
2. Once Assembly exists, preserve the protected Assembly workflow too.
3. UI work uses ASA-owned APIs, never raw vendor UI/store internals.
4. CAD/assembly/2D projection calculations run on the active client where applicable.
5. ASA Lab remains identity/class/project/version/submission infrastructure, not a CAD compute server.
6. Saved `CadDocument` compatibility is a release boundary.
7. Upstream updates are pinned and intentional; never auto-merge upstream `main`.
8. ASA-CAD remains independently runnable/testable in its own frontend Docker image.
9. The end-state document union is known from M1 even though document editors are implemented incrementally.
10. Drawing is not a screenshot, Specification is not a disconnected table, Assembly is not a flattened mesh.

---

## M0 — Reproducible imported CAD baseline

**Status: ACTIVE, foundation mostly complete**

### Goal

Own a pinned, reproducible browser CAD baseline before major product divergence.

### Done

- ToubkalCAD imported under `vendor/toubkal/` as a pinned subtree.
- Exact upstream commit recorded in `UPSTREAM_BASELINE`.
- Root developer commands exist.
- GitHub Actions baseline gate exists.
- Clean install/build/typecheck/lint is supported.
- Imported CAD regression suite passes in GitHub Actions.
- Architecture/integration/upstream contracts exist.

### Remaining gate

- add ASA-owned protected Part fixture:
  `Sketch 60x40 -> Extrude 10 -> centered diameter-12 cut -> Fillet -> edit 60 to 80 -> recompute -> save -> reopen`;
- verify required upstream/third-party notices;
- make protected Part workflow part of CI.

### Acceptance

Clean checkout passes build/lint/regressions and reproduces the protected Part in CI.

Tracking: #1.

---

## M0D — Standalone Docker and boot/test surface

**Status: ACTIVE; image build/boot/static-header smoke is already green**

### Goal

Make ASA-CAD independently launchable and inspectable without ASA Lab using the same frontend-container model planned for production.

### Done

- root `Dockerfile`;
- `docker/Caddyfile`;
- `compose.yaml`;
- default standalone address `http://localhost:8088`;
- CAD-local COOP/COEP headers for current imported runtime;
- Docker GitHub Actions workflow;
- Docker image builds successfully in CI;
- container starts successfully in CI;
- `/health/live` passes;
- root app document is served;
- COOP/COEP headers are verified in CI;
- helper scripts `npm run docker:build`, `npm run docker:up`, `npm run docker:down`.

### Remaining gate

- real-browser boot smoke against Docker image;
- standalone local/mock `CadProjectHost` once M1 stabilizes;
- browser E2E entry point;
- protected Part browser workflow;
- later protected Assembly browser workflow.

### Acceptance

`docker compose up --build` opens a usable editor, and CI proves actual browser initialization plus protected browser workflow(s), not only static HTTP health.

Tracking: #12.

See `docs/RUN_AND_DEPLOY.md` and `docs/DEVELOPMENT_WORKFLOW.md`.

---

## M1 — ASA-owned CadDocument and CadApplication boundary

**Status: NEXT**

### Goal

Stop future ASA product code from depending on Toubkal internals and reserve the complete engineering document system before UI expansion.

### Document contract

Define from the start:

```ts
type CadDocument =
  | CadPartDocument
  | CadAssemblyDocument
  | CadDrawingDocument
  | CadFragmentDocument
  | CadSpecificationDocument
  | CadTextDocument;
```

Document routing/schema support for all six kinds is established even though only Part is fully operational in this milestone.

### Deliverables

- document `kind`, `schemaVersion`, `engineVersion`;
- parser/serializer/migration contract;
- stable ASA IDs;
- `CadApplication` typed command/state API;
- Part geometry/recompute/solver/picking/measurement adapters;
- initial Assembly occurrence/reference adapter boundary;
- linked-document reference type used later by Drawing/Specification/Text;
- undo/redo via ASA commands;
- deterministic serialize/destroy/restore/recompute;
- architecture checks forbidding product UI imports from vendor internals.

### Protected Part command surface

- create sketch on origin plane;
- rectangle;
- dimensions/constraints;
- finish sketch;
- extrude;
- sketch on face;
- circle + diameter;
- cut extrusion;
- fillet;
- edit upstream dimension;
- recompute;
- undo/redo;
- serialize/restore.

### Acceptance

Protected Part runs through `CadApplication` only. No acceptance test reaches `window.oc`, raw `TopoDS_Shape`, vendor Zustand internals/events/UI components.

Tracking: #2.

---

## M1B — Client runtime, separate CAD container and ASA Lab host contract

**Status: BLOCKED by stable M1 boundary; deployment design defined**

### Goal

Prove the same ASA-CAD release/container runs standalone and behind ASA Lab while CAD computation stays on the learner device.

### Deliverables

- versioned `asa-cad-web` release image;
- editor/viewer routes;
- `CadProjectHost` persistence interface;
- same-origin `/cad/*` production route;
- content-hashed/cached WASM runtime;
- capability probe;
- local IndexedDB unsent-work recovery;
- isolated SharedArrayBuffer/COOP/COEP strategy;
- standalone and ASA Lab host fixtures using the same ASA-owned interfaces;
- network test proving no normal geometry/assembly compute RPC.

### Acceptance

- standalone and ASA Lab-routed app use the same released frontend;
- unrelated ASA Lab pages do not fetch CAD WASM;
- CAD compute is observable on active client;
- host traffic is persistence/education traffic, not compute RPC;
- cross-device save/reopen works;
- unsupported hardware fails safely.

Tracking: #4.

---

## M2 — ASA-owned KOMPAS-oriented application shell

**Status: BLOCKED by M1**

### Goal

Replace visible vendor shell with the stable ASA-CAD application shell.

### Shell scope

- application/document tabs;
- `Новый документ` dialog with six target kinds;
- top KOMPAS-oriented command/ribbon area;
- document-specific tree;
- contextual parameter/task panel;
- viewport/page/work area;
- confirm/cancel controls;
- status bar/diagnostics;
- Russian engineering terminology;
- responsive panel behavior.

### First operational modes

Part is fully active first. Assembly shell/navigation is present in preparation for M4A. Drawing/Fragment/Specification/Text may initially show explicit `planned/not implemented` states, but their document identities/routes are real and must not require a future application-shell rewrite.

### Architecture rule

Every product control dispatches ASA-owned commands. No product component imports raw vendor stores/services/events or OCC objects.

### Acceptance

Protected Part workflow no longer requires vendor shell. Document-kind routing/create dialog/tree switching is ASA-owned. UI can change without editing kernel algorithms.

Tracking: #3.

---

## M2A — Stable demo routes, visual fixtures and owner review loop

**Status: BLOCKED by first usable M2 shell; then ONGOING for every document kind**

### Goal

Make the product easy to inspect/correct separately from ASA Lab.

### Deliverables

- fast hot-reload development loop;
- deterministic development-only routes/fixtures;
- browser interaction tests;
- visual regression screenshots;
- Part fixtures first, Assembly next, then each later document kind;
- clear mapping from visual component to ASA-owned source/style tokens.

### Initial fixture targets

```text
/dev/part/empty
/dev/part/reference
/dev/part/rebuild-error
/dev/assembly/reference
/dev/assembly/context-edit
```

Later:

```text
/dev/drawing/reference
/dev/fragment/reference
/dev/specification/reference
/dev/text/reference
```

### Acceptance

The owner can open a deterministic URL, request a concrete UI correction, see it through hot reload, and use Docker/browser E2E for final verification without starting ASA Lab/PostgreSQL.

Tracking: #15.

See `docs/DEVELOPMENT_WORKFLOW.md`.

---

## M3 — KOMPAS-oriented parametric sketcher

**Status: BLOCKED by M1 + M2**

### Goal

Provide real parametric sketch teaching behavior.

### Geometry

- line/polyline;
- circle/arc;
- rectangle/polygon;
- trim/extend/offset;
- construction/centerline;
- projected/reference geometry.

### Constraints

- coincident;
- horizontal/vertical;
- parallel/perpendicular;
- tangent;
- concentric;
- equal;
- symmetric;
- fixed;
- point-on-curve.

### Dimensions

- linear/horizontal/vertical;
- angular;
- radius/diameter.

### Required behavior

- under/fully constrained status;
- redundant/conflicting constraint diagnostics;
- consistent dragging;
- driving dimensions update geometry;
- exact save/reopen.

### Acceptance

Learner can build KOMPAS-oriented teaching sketches and retain parametric intent after reopen.

Tracking: #5.

---

## M4 — Part Design core and stable topology references

**Status: BLOCKED by M3**

### Goal

Deliver useful school-level parametric solid modeling with reliable downstream recompute.

### First wave

- extrusion/cut extrusion;
- revolution/cut revolution;
- hole;
- fillet/chamfer;
- mirror;
- linear/circular pattern.

### Second wave

- sweep;
- loft;
- shell;
- rib;
- draft;
- datum planes/axes/points.

### Critical engineering work

- feature dependency graph;
- deterministic dirty propagation;
- persistent logical face/edge references;
- explicit unresolved-reference state;
- no silent topology rebinding;
- compatibility fixtures.

### Acceptance

Early sketch/feature edits either correctly update downstream features or show explicit rebuild errors; never silently bind to a different face/edge.

Tracking: #6.

---

## M4A — Assembly, mates and in-context component design

**Status: BLOCKED by stable Part/reference semantics in M4**

### Goal

Make **Сборка** a real second 3D engineering document, including both bottom-up and top-down workflows.

### Components

- insert existing Part;
- insert subassembly;
- multiple occurrences;
- create Part in place;
- create subassembly in place;
- open/edit component;
- context-edit Part while surrounding Assembly remains visible/read-only;
- replace component;
- explicit update to another component version;
- duplicate occurrence;
- hide/show/suppress;
- fix/unfix;
- move/rotate.

### Mates

- coincident/planar;
- concentric;
- parallel;
- perpendicular;
- distance;
- angle;
- fixed component.

### Version/reference rules

- occurrences reference known Part/subassembly revisions/versions;
- newer source drafts do not silently mutate pinned Assembly versions;
- contextual external references are explicit;
- submitted Assembly pins required component versions;
- circular references are rejected.

### Protected Assembly workflow

`create Parts -> create Assembly -> insert/create components -> fix base -> add mates -> context-edit one Part using Assembly reference -> solve -> save -> reopen -> explicitly update/replace component -> recompute -> pin version -> reopen exact pinned version`

### Acceptance

Assembly reopens with the same component identities/versions/mates/context dependencies and solves/rebuilds locally.

Tracking: #11.

See `docs/ASSEMBLIES.md`.

---

## M4B — Standalone release hardening

**Status: BLOCKED by M4 + M4A**

### Goal

Produce a versioned standalone release ASA Lab can safely pin.

### Deliverables

- `asa-cad-web:<version>` image;
- public editor/viewer/document/application boundary;
- Part/Assembly parser/migrations;
- runtime loader/content-hashed assets;
- release metadata;
- Part + Assembly compatibility corpus;
- memory/runtime cleanup tests;
- crash/network recovery tests;
- capability/performance matrix;
- protected Part + Assembly real-browser E2E against Docker image.

### Acceptance

Released image runs standalone and opens all supported Part/Assembly fixtures without host access to vendor internals.

Tracking: #7.

---

## M5 — First-class ASA Lab integration

**Status: BLOCKED by M1B + M4B**

### Goal

Integrate the pinned CAD frontend under the existing ASA Lab origin/session.

### Deployment

- add pinned `asa-cad-web:<version>` to production stack;
- route `/cad/*` to it;
- keep `/api/*` on ASA API;
- no second domain/login;
- no CAD compute backend;
- CAD-specific runtime headers isolated to CAD routes.

### Product/persistence

- register `moduleKey: cad`, `projectType: cad-document`;
- Part/Assembly project creation/navigation;
- ASA `CadProjectHost` adapter;
- draft save with `baseRevision` + `mutationId`;
- snapshots/versions/checkpoints/restore;
- assignments/courses;
- pinned submissions;
- Assembly component-version resolution;
- teacher viewer/review;
- read-only/permission states.

### Acceptance

Learner can receive/create Part/Assembly projects, edit locally, save/reopen cross-device, submit a reproducible version and have teacher open exactly it.

Tracking: #8.

---

## M6 — Shared 2D engine, Drawing and Fragment

**Status: BLOCKED by stable Part/Assembly model references; can start after M5 or in a parallel isolated lane once the reference contract is stable**

### Goal

Add KOMPAS-oriented **Чертеж** and **Фрагмент** using one shared 2D drafting engine.

### Drawing

- multi-sheet documents;
- A4/A3/A2/A1/A0/custom;
- orientation/scale;
- frame/title block/profile;
- layers;
- associative base/projected/isometric views from Part/Assembly;
- section/cut views;
- 2D drafting;
- hatching;
- dimensions/center lines/leaders/text;
- explicit source-model update/rebuild;
- PDF/SVG/DXF output.

### Fragment

- reusable/draft 2D document without required sheet frame/title block;
- same geometry tools as Drawing where applicable;
- constraints/dimensions where useful;
- reuse/insertion in supported 2D contexts;
- SVG/DXF/native ASA exchange.

### Acceptance

Drawing remains structured/associative after save/reopen and explicit source-model update. Fragment is independently reusable. No screenshot-only Drawing and no duplicated 2D engines.

Tracking: #13.

---

## M6A — Specification and Text documents

**Status: BLOCKED by document-link infrastructure; Specification also depends on useful Assembly data**

### Specification

- manual or Assembly-generated creation;
- exact Assembly/Drawing source refs;
- sections/rows;
- designation/name/quantity/properties;
- position numbers;
- grouping/sorting;
- controlled overrides/notes;
- visible regeneration diff/diagnostics;
- PDF/XLSX/CSV output.

### Text document

- pages;
- paragraphs/headings/lists;
- rich text and engineering symbols;
- tables;
- page breaks;
- headers/footers;
- frame/title-block profile;
- links to engineering documents;
- PDF export.

### Acceptance

Assembly can generate/reopen a structured Specification and learner can create/reopen linked engineering Text documents as normal ASA-CAD projects.

Tracking: #14.

---

## M7 — Broader KOMPAS teaching parity, settings and exchange

**Status: iterative after foundations**

### Candidate lanes

- additional Part/Assembly/2D commands;
- closer command grouping/lifecycle/shortcuts/navigation;
- variables/expressions;
- advanced component patterns/exploded/interference;
- drawing standards/symbols/tolerances;
- templates;
- specification styles;
- more import/export formats;
- curriculum examples/exercises;
- application/document settings and appearance refinements.

See `docs/FILES_SETTINGS_AND_EXPORT.md`.

Existing parity tracking: #9.

---

## M8 — Upstream update lane

**Status: ONGOING after M0**

For every Toubkal update:

1. record exact baseline/target SHA;
2. classify diff by subsystem;
3. normally ignore vendor UI changes;
4. selectively port useful runtime fixes through adapters;
5. run imported regressions;
6. run ASA protected Part workflow;
7. run protected Assembly workflow once available;
8. run saved-document compatibility corpus;
9. merge only after gates pass.

See `docs/UPSTREAM.md`.

---

# Release gates

## Gate A — ASA CAD Core

Requires M0 + core M0D + M1.

Result: reproducible runtime, standalone container and ASA-owned document/application boundary.

## Gate B — ASA CAD Editor Alpha

Requires M1B + M2 + M2A initial fixtures + M3.

Result: ASA/KOMPAS-oriented shell, real sketching, deterministic owner review workflow and client-side runtime delivery.

## Gate C — ASA CAD Standalone Beta

Requires M4 + M4A + M4B.

Result: useful Part + Assembly CAD with stable references, in-context assembly design, compatibility and versioned Docker release.

## Gate D — ASA Lab CAD Module

Requires M5.

Result: first-class ASA Lab Part/Assembly module with projects/classes/versions/submissions and local compute.

## Gate E — Engineering Documentation Suite

Requires M6 + M6A.

Result: Drawing + Fragment + Specification + Text document integrated into the same CAD document/project system.

## Gate F — Broader Teaching Parity

M7 iterative releases.

---

# Immediate next work

1. Finish M0 protected Part CI fixture.
2. Finish M0D real-browser Docker boot/protected workflow.
3. Start M1 with the six-kind `CadDocument` union and stable `CadApplication` boundary.
4. Implement protected Part through ASA APIs only.
5. Prove M1B standalone/ASA Lab host-container contract.
6. Build M2 ASA-owned shell plus `Новый документ` six-kind routing.
7. Establish M2A deterministic visual fixtures so the owner can inspect/correct exact pages/states.
8. Complete M3 -> M4 Part -> M4A Assembly -> M4B standalone beta.
9. Integrate Part/Assembly into ASA Lab in M5.
10. Build M6 Drawing/Fragment and M6A Specification/Text without changing the core application/persistence architecture.
