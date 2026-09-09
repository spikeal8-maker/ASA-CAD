# ASA-CAD system specification

This document is the primary product and system contract for ASA-CAD. If another document, issue or implementation detail conflicts with this file, this file defines the intended end state until it is deliberately revised.

## 1. What ASA-CAD is

ASA-CAD is a browser-native parametric engineering CAD module for ASA Lab.

It is a separate engineering module and does not replace the existing beginner `three-d` editor.

The product goal is to give learners a browser CAD environment whose desktop information architecture, command organization, terminology and modeling workflow are as close as practical to KOMPAS-3D, so that skills learned in ASA Lab transfer to professional KOMPAS workflows.

The visible interface is ASA-owned. We do not ship proprietary KOMPAS binaries, source code, icons or protected artwork.

ASA-CAD end state includes six first-class document kinds:

- **Деталь / Part**;
- **Сборка / Assembly**;
- **Чертеж / Drawing**;
- **Фрагмент / Fragment**;
- **Спецификация / Specification**;
- **Текстовый документ / Text document**.

See `docs/DOCUMENT_TYPES.md` for the detailed document contract.

## 2. End-user experience

A learner opens ASA-CAD standalone during development/testing or opens a CAD project through ASA Lab.

The application-level `Новый документ` command eventually exposes:

```text
[ Деталь ]       [ Сборка ]
[ Чертеж ]       [ Фрагмент ]
[ Спецификация ] [ Текстовый документ ]
```

All document kinds use one ASA-CAD application shell with:

- document tabs and application commands;
- KOMPAS-oriented top command/ribbon organization;
- document-specific tree;
- contextual parameter/task panel;
- central working area/viewport/page canvas;
- confirm/cancel command lifecycle;
- status and diagnostics;
- Russian engineering terminology aligned with the taught KOMPAS workflow.

The active document kind changes tools and tree semantics:

- Part -> sketches/features/bodies;
- Assembly -> components/subassemblies/mates;
- Drawing -> sheets/views/annotations;
- Fragment -> reusable 2D geometry;
- Specification -> structured product table;
- Text -> pages/paragraphs/tables/document formatting.

Desktop is the reference interface. Smaller screens use the same document/application model but may collapse panels into drawers/tabs.

## 3. Part / Деталь

A Part is one component with its own parametric construction history:

`plane/face -> sketch -> constraints/dimensions -> feature -> downstream features -> recompute`

Protected Part regression:

`Sketch 60x40 -> Extrude 10 -> centered diameter-12 cut -> Fillet -> edit 60 to 80 -> recompute -> save -> close -> reopen -> edit again`

The model tree is functional history, not decoration. Changing an upstream sketch or feature must recompute downstream operations or show an explicit rebuild error.

Silent rebinding to a different face/edge after topology changes is forbidden.

## 4. Assembly / Сборка

An Assembly contains occurrences of Parts and/or subassemblies and stores their relative placement, component state and mates/constraints.

It supports both:

- bottom-up design: insert already created Parts/subassemblies;
- top-down design: create/edit a Part or subassembly in the context of the Assembly.

When context-editing a component:

- the active component uses the normal Part toolset;
- surrounding components remain visible/read-only;
- surrounding faces/edges/planes may be used as references;
- contextual dependencies are explicit and diagnosable;
- reference breakage must never silently rebind to unrelated geometry.

Initial Assembly behavior includes:

- create Assembly;
- insert existing Part/subassembly;
- create Part/subassembly in place;
- multiple occurrences;
- fix/unfix;
- move/rotate;
- coincident/planar, concentric, parallel, perpendicular, distance and angle mates;
- replace component;
- explicit component-version update;
- hide/show/suppress;
- Assembly tree;
- save/reopen preserving component versions and mate intent.

A submitted/published Assembly is reproducible: required referenced component revisions/versions are pinned.

See `docs/ASSEMBLIES.md`.

## 5. Drawing / Чертеж

Drawing is a sheet-based 2D engineering document. The primary teaching workflow is associative Drawing creation from a Part or Assembly.

Required direction:

- one or more sheets;
- standard/custom formats and orientation;
- frame/title block/template profile;
- base/projected/isometric views;
- cuts/sections;
- 2D drafting geometry;
- dimensions;
- hatching;
- center marks/lines;
- leaders/text/annotations;
- layers;
- explicit update/rebuild from referenced model versions;
- PDF/SVG/DXF output.

Drawing must not be implemented as a screenshot of the 3D viewport. It stores structured 2D objects, associative view definitions and explicit model references.

## 6. Fragment / Фрагмент

Fragment is a reusable 2D graphic document without required sheet frame/title block.

It is used for:

- rough/draft 2D work;
- reusable typical geometry;
- educational 2D exercises;
- insertion/reuse in supported 2D contexts.

Drawing and Fragment reuse one ASA-owned 2D drafting engine rather than duplicating geometry implementations.

## 7. Specification / Спецификация

Specification is a structured product-composition/BOM document, normally linked to an Assembly and optionally its Drawing.

It stores:

- source document references/versions;
- sections;
- component rows;
- designation/name/quantity/properties;
- position numbers;
- grouping/sorting rules;
- controlled user notes/overrides.

Generation/update from Assembly must be explicit and diagnosable. Specification is not just a manually typed disconnected table.

Outputs include PDF/XLSX/CSV while the structured ASA document remains authoritative.

## 8. Text document / Текстовый документ

Text document is a page-based engineering documentation document for explanatory notes, requirements, instructions and related project text.

It supports structured text, tables, engineering symbols, pages, headers/footers, title-block/profile data and links to other CAD documents. Normal text editing does not require OpenCascade.

## 9. Cross-document model

The engineering workflow is a graph of linked documents, not six isolated editors.

```text
Part ---------------------> Drawing
  \                           |
   \                          v
    +-----> Assembly ------> Specification
              |               ^
              +----> Drawing -+

Fragment ----> Drawing / reusable 2D content

Text document <---- links to any engineering document
```

Cross-document references use ASA project/document identity plus explicit revision/version semantics.

A submitted learning result must reopen reproducibly, including linked component/model documents required by that submission.

## 10. CAD implementation base

ASA-CAD starts from a pinned ToubkalCAD source baseline imported under `vendor/toubkal/`.

We reuse/harden implementation layers that prove suitable:

- OpenCascade WebAssembly geometry;
- sketch constraint solving;
- feature/history/recompute behavior;
- assembly solver/occurrence behavior;
- exact B-Rep operations;
- tessellation/Three.js rendering;
- picking/measurement;
- import/export capabilities.

Toubkal is implementation source, not the ASA product architecture or visible product UI.

Drawing/Fragment/Specification/Text are ASA product layers and are not required to inherit the vendor UI architecture.

## 11. Mandatory application boundary

All product UI talks to ASA-owned application/document APIs.

```text
ASA CAD UI
    |
    v
CadApplication / CadDocument
    |
    v
ASA document/runtime adapters
    |
    +-- Part/Assembly runtime
    |    `-- OpenCascade + solvers + Three.js
    |
    +-- shared 2D drafting runtime
    |
    +-- Specification document logic
    `-- Text document logic
```

Product UI must not directly use:

- `window.oc`;
- raw `TopoDS_Shape` objects;
- vendor Zustand internals;
- vendor `CustomEvent` names;
- concrete vendor `Occ*Service` classes;
- vendor component paths.

## 12. Public document union

ASA-CAD defines one public serializable union:

```ts
type CadDocument =
  | CadPartDocument
  | CadAssemblyDocument
  | CadDrawingDocument
  | CadFragmentDocument
  | CadSpecificationDocument
  | CadTextDocument;

type CadDocumentKind =
  | 'part'
  | 'assembly'
  | 'drawing'
  | 'fragment'
  | 'specification'
  | 'text';
```

The union and document routing exist before every editor is complete so future document kinds do not require a destructive persistence/application rewrite.

OpenCascade objects, WASM pointers, Three.js meshes and tessellations are runtime caches. They are never project authority.

Saved-document compatibility is a hard release boundary.

## 13. Where calculation runs

Interactive CAD calculation runs on the active user's device.

Local browser/client work includes where applicable:

- sketch solving;
- Part features and booleans;
- assembly mate solving/placement;
- component geometry rebuild;
- stable-reference resolution;
- tessellation;
- picking/measurement;
- 2D projection generation from models;
- normal export generation where practical.

The server is not a normal geometry-compute service.

Unsupported devices fail clearly or offer read-only behavior where possible; they do not silently fall back to server-side CAD compute.

## 14. Native saving, files and export

Inside ASA Lab, authoritative state is the structured `CadDocument` saved through Project Core revisions/versions.

Standalone native exchange starts with versioned ASA JSON such as `*.asacad.json`.

Derived/export formats include, according to document kind:

- Part/Assembly: STEP, IGES, STL and other proven exchange formats;
- Drawing/Fragment: PDF, SVG, DXF and raster previews;
- Specification: PDF, XLSX, CSV;
- Text: PDF and other deliberately supported document outputs.

Export files never replace native project authority.

See `docs/FILES_SETTINGS_AND_EXPORT.md`.

## 15. Settings and appearance

Settings are separated into:

- user/application settings;
- engineering document settings;
- optional session/view settings.

ASA-owned UI uses shared design tokens for typography, density, panels, command states, selection, sketch status, tree rows, viewport/page backgrounds and diagnostics.

This lets visual/layout changes be made independently from kernel algorithms.

## 16. Standalone development and Docker

ASA-CAD must remain independently runnable throughout development.

### Fast development

```bash
npm run install:vendor
npm run dev
```

Current imported baseline dev address:

```text
http://localhost:8080
```

This is the fast hot-reload loop for UI work.

### Production-like standalone Docker

```bash
npm run docker:up
```

or:

```bash
docker compose up --build
```

Default address:

```text
http://localhost:8088
```

Stop with:

```bash
npm run docker:down
```

Docker serves HTML/JS/CSS/WASM/static assets. It has no CAD compute backend and no own database.

Stable development fixtures/routes are required as the ASA-owned UI appears so the owner can open exact Part/Assembly/Drawing/etc. states and give precise visual correction tasks.

See `docs/DEVELOPMENT_WORKFLOW.md` and `docs/RUN_AND_DEPLOY.md`.

## 17. Production ASA Lab integration

ASA-CAD remains separately versioned/containerized in production but behaves as a first-class ASA Lab module under one public origin/session.

Recommended routing:

```text
public ASA Lab origin
        |
        +---- /api/* -----> asa-api
        +---- /cad/* -----> asa-cad-web
        `---- other UI ---> asa-web
```

No iframe. No second login. No CAD compute backend.

Target identity:

```text
moduleKey: cad
projectType: cad-document
schemaVersion: 1
editorRoute: /cad/projects/:projectId
viewerRoute: /cad/view/:versionId
```

ASA Lab pins an explicit `asa-cad-web:<version>` release.

## 18. ASA Lab host/persistence boundary

ASA-CAD does not know ASA tenant/classroom/database internals.

The host supplies project persistence and linked-document resolution through ASA-owned interfaces, including load/save/snapshot/version operations and resolution of pinned external documents required by Assembly/Drawing/Specification.

ASA Lab remains responsible for:

- identity;
- classes;
- assignments/courses;
- project ownership/permissions;
- draft saving;
- versions/checkpoints;
- linked document/component resolution;
- submissions;
- teacher review;
- snapshots/previews;
- imported attachment persistence when required.

## 19. Save/recovery/cross-device rules

1. User command changes in-memory document state.
2. Local calculation/recompute runs where required.
3. Native serializable document is saved after safe boundaries/debounce.
4. ASA Lab uses `baseRevision` + `mutationId` conflict protection.
5. UI reports `Сохранено` only after host acknowledgement.
6. IndexedDB may hold unsent crash/network recovery state.
7. Server remains cross-device authority.
8. Linked external documents required by pinned versions are resolved explicitly.
9. Opening on another supported device reconstructs the editable document, not only a screenshot/mesh.

## 20. Classroom behavior

All CAD document kinds participate in the normal learning workflow where appropriate:

`class -> assignment -> learner CAD document/project -> autosave -> pinned submission -> teacher review`

Assignments may eventually start from templates such as:

- Part template;
- Assembly template;
- A4 Drawing template;
- provided Fragment;
- partially completed Specification;
- technical note template.

ASA-CAD does not implement a second classroom/user system.

## 21. Upstream policy

Toubkal baseline is pinned. We never automatically merge upstream `main` into release code.

For upstream changes:

1. identify exact source/target SHA;
2. classify by subsystem;
3. normally ignore vendor UI changes;
4. port useful kernel/solver/recompute/assembly fixes through adapters;
5. run imported regressions;
6. run ASA protected workflows and saved-document compatibility;
7. accept only after gates pass.

## 22. Required implementation order

The end-state contains all six document kinds, but implementation follows risk/dependency order:

1. reproducible CAD/runtime baseline + Docker boot;
2. ASA `CadDocument`/`CadApplication` boundary with all document-kind routing reserved;
3. KOMPAS-oriented application shell and deterministic review fixtures;
4. parametric sketcher;
5. Part Design + stable references;
6. Assembly + contextual component editing + pinned component semantics;
7. standalone release hardening + native ASA Lab integration;
8. shared 2D drafting engine + Drawing + Fragment;
9. Specification + Text document;
10. broader KOMPAS parity/templates/standards.

See `docs/ROADMAP.md` for milestone gates.

## 23. Definition of product success

The complete product is successful when a learner can:

1. run/review ASA-CAD standalone;
2. create/edit a parametric Part;
3. create/edit an Assembly from Parts/subassemblies, including in-context component creation/editing;
4. create an associative Drawing from Part/Assembly;
5. use Fragment for reusable/draft 2D work;
6. generate/edit a structured Specification;
7. create linked engineering Text documentation;
8. save/reopen all implemented document kinds without losing design intent;
9. open them through ASA Lab on another supported device;
10. submit a reproducible version and have the teacher open exactly that submitted engineering state.

## 24. Non-negotiable rules

- Do not rewrite the geometry kernel from scratch.
- Do not build product UI directly on vendor UI/store internals.
- Do not save only STL/mesh/screenshot as authority.
- Do not flatten Assembly as the only native representation.
- Do not implement Drawing as only an image export.
- Do not implement Specification as only a disconnected table.
- Do not duplicate separate 2D geometry engines for Drawing and Fragment.
- Do not introduce normal server geometry RPCs.
- Do not auto-update upstream.
- Do not silently break/migrate saved documents.
- Do not require ASA Lab to inspect/test core ASA-CAD.
- Keep production CAD frontend independently versioned/containerized.
- Keep visual/UI work independently editable from kernel algorithms.

## 25. Source-of-truth documents

- `docs/SYSTEM_SPEC.md` — complete system/end-state contract.
- `docs/DOCUMENT_TYPES.md` — all six document kinds, tools and cross-document relationships.
- `docs/ASSEMBLIES.md` — Assembly semantics and component-version rules.
- `docs/FILES_SETTINGS_AND_EXPORT.md` — native saving, formats, settings and appearance contract.
- `docs/DEVELOPMENT_WORKFLOW.md` — standalone visual editing/review workflow.
- `docs/ARCHITECTURE.md` — technical boundaries/runtime architecture.
- `docs/RUN_AND_DEPLOY.md` — standalone/Docker/production deployment.
- `docs/ASA_LAB_INTEGRATION.md` — ASA Lab host/persistence/classroom integration.
- `docs/ROADMAP.md` — implementation order and acceptance gates.
- `docs/UPSTREAM.md` — upstream import/update procedure.
- `AGENTS.md` — coding-agent rules.
