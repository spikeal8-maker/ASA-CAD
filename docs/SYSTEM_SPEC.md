# ASA-CAD system specification

This document is the primary product and system contract for ASA-CAD. If another document, issue or implementation detail conflicts with this file, this file defines the intended end state until it is deliberately revised.

## 1. What ASA-CAD is

ASA-CAD is a new browser-native parametric engineering CAD module for ASA Lab.

It is a separate module. It does not replace the existing beginner `three-d` editor.

The product goal is to give learners a browser CAD environment whose desktop layout, command organization, terminology and modeling workflow are as close as practical to KOMPAS-3D, so that skills learned in ASA Lab transfer directly to KOMPAS-3D.

The interface is implemented by ASA-CAD. We do not depend on the visible ToubkalCAD interface and we do not ship proprietary KOMPAS binaries, source code, icons or other protected assets.

ASA-CAD must support two first-class engineering document modes:

- **Деталь / Part**;
- **Сборка / Assembly**.

## 2. End-user experience

A learner opens ASA Lab and creates or receives a CAD project. When creating a new CAD document, the learner can choose **Деталь** or **Сборка**.

The reference desktop interface contains:

- document tabs and application commands;
- a top KOMPAS-oriented command/ribbon area;
- model/history or assembly tree;
- contextual parameters/task panel;
- central 3D viewport;
- sketch mode with constraints and driving dimensions;
- assembly mode with components and mates;
- in-command confirm/cancel lifecycle;
- status and constraint feedback;
- Russian engineering terminology aligned with the taught KOMPAS workflow;
- standard selection, camera, zoom and model-navigation behavior expected from desktop CAD.

Desktop is the reference interface. Tablet/phone use the same document and command model, but panels may collapse into drawers/tabs because the screen is smaller.

## 3. Part versus Assembly

### Part / Деталь

A Part is one component with its own parametric construction history:

`plane/face -> sketch -> constraints/dimensions -> feature -> downstream features -> recompute`

The first protected Part regression is:

`Sketch 60x40 -> Extrude 10 -> centered diameter-12 cut -> Fillet -> edit 60 to 80 -> recompute -> save -> close -> reopen -> edit again`

The model/history tree is functional history, not decoration. Changing an upstream sketch or feature must recompute downstream operations or surface an explicit rebuild error.

Silent rebinding to a different face/edge after topology changes is forbidden.

### Assembly / Сборка

An Assembly contains occurrences of Parts and/or subassemblies. It positions them and constrains their relative movement using assembly mates/constraints. It does not normally merge all components into one Part.

Example:

```text
Part: bracket
Part: bolt
Part: washer
Part: nut
        |
        v
Assembly: bracket + bolt + washer + nut
```

Initial assembly behavior must include:

- create assembly;
- insert Part;
- insert subassembly;
- multiple occurrences of the same component;
- fix/unfix component;
- move/rotate occurrence;
- coincident/planar mate;
- concentric mate;
- parallel/perpendicular mate;
- distance mate;
- angle mate;
- replace component;
- explicit component-version update;
- assembly tree;
- save/reopen with the same component versions and mate intent.

A submitted/published assembly must be reproducible: referenced component revisions/versions are pinned, not silently replaced by newer drafts.

See `docs/ASSEMBLIES.md`.

## 4. CAD implementation base

ASA-CAD starts from a pinned ToubkalCAD source baseline already imported under `vendor/toubkal/`.

We reuse and harden useful implementation layers:

- OpenCascade WebAssembly geometry kernel;
- sketch constraint solving;
- feature/history and recompute behavior;
- assembly implementation/solver behavior that proves reliable;
- exact B-Rep operations;
- tessellation and Three.js rendering;
- picking/measurement;
- STEP/IGES/import/export capabilities that prove reliable.

ToubkalCAD is an implementation source, not the ASA-CAD public architecture and not the ASA-CAD product UI.

The visible product must be able to evolve independently from upstream ToubkalCAD.

## 5. Mandatory architecture boundary

All ASA product code talks to an ASA-owned application API.

```text
ASA CAD UI
    |
    v
CadApplication / CadDocument
    |
    v
ASA runtime adapters
    |
    v
Toubkal-derived runtime
    |
    +-- OpenCascade WASM
    +-- sketch / assembly solvers
    +-- Three.js presentation
```

The product UI must not directly use:

- `window.oc`;
- raw `TopoDS_Shape` objects;
- upstream Zustand store internals;
- upstream `CustomEvent` names;
- concrete upstream `Occ*Service` classes;
- upstream component paths.

This boundary is what lets us replace the entire UI and still selectively import future upstream geometry/recompute/assembly fixes.

## 6. Project document model

ASA-CAD has one public document union:

```ts
type CadDocument = CadPartDocument | CadAssemblyDocument;
type CadDocumentKind = 'part' | 'assembly';
```

Conceptually:

```text
CadPartDocument
|- kind: part
|- schemaVersion / engineVersion
|- units / variables
|- origin / datum geometry
|- sketches / constraints / dimensions
|- features / bodies
|- stable references
`- optional editor state

CadAssemblyDocument
|- kind: assembly
|- schemaVersion / engineVersion
|- units
|- component occurrences
|  |- component source project/version
|  |- occurrence transform
|  `- instance metadata
|- subassemblies
|- mates / assembly constraints
|- assembly references
`- optional editor state
```

OpenCascade native objects, WASM pointers, Three.js meshes and tessellations are runtime caches. They are never the authoritative saved project.

Saved-document compatibility is a hard product boundary. New ASA-CAD releases must explicitly migrate or continue to open documents created by previous released versions.

## 7. Where calculations run

Interactive CAD computation must run on the active user's device.

```text
Desktop/laptop -> that computer CPU/RAM/GPU
Tablet         -> that tablet CPU/RAM/GPU
Phone          -> that phone CPU/RAM/GPU, if supported
```

Normal modeling must not use a server geometry service.

The following execute locally in the browser:

- sketch solving;
- Part feature construction;
- assembly mate solving/placement;
- component geometry loading/rebuild;
- boolean operations;
- fillet/chamfer and other B-Rep operations;
- history recompute;
- tessellation;
- picking/measurement support;
- normal export generation where practical.

The GPU is primarily presentation/rendering. The geometry kernel is WebAssembly code instantiated in browser memory and consumes local device resources.

Unsupported devices must fail clearly or offer read-only access where possible. ASA-CAD must not silently fall back to server-side geometry calculation.

## 8. Standalone product and Docker

ASA-CAD must run independently of ASA Lab throughout development and testing.

The repository produces a standalone frontend Docker image:

```text
asa-cad-web
|- static web server
|- ASA-CAD HTML/JS/CSS
|- OpenCascade WASM
`- static runtime assets

NO own database
NO CAD compute backend
NO geometry RPC service
```

Developer/test launch:

```bash
docker compose up --build
```

Default local address:

```text
http://localhost:8088
```

The standalone host uses fixtures/local storage/IndexedDB through the same ASA-owned project-host boundary that production later maps to ASA Lab.

The same Docker image form must be usable for browser E2E tests and later ASA Lab deployment.

See `docs/RUN_AND_DEPLOY.md`.

## 9. Runtime loading and performance

ASA Lab must not download the CAD engine for users who are not opening CAD.

In standalone mode the browser downloads runtime assets from the standalone ASA-CAD container. In ASA Lab mode the browser downloads them only after entering `/cad/*`.

Target runtime path:

```text
user opens CAD document
    v
device capability probe
    v
load content-hashed CAD JS/WASM
    v
instantiate kernel in browser memory
    v
open/recompute CadDocument locally
```

The CAD/WASM payload is cached by the browser using versioned/content-hashed immutable assets.

A normal ASA Lab page, electronics project, chess project or current beginner 3D project must not fetch OpenCascade WASM.

Current upstream SharedArrayBuffer/cross-origin-isolation requirements are isolated to the CAD frontend/runtime. They must not accidentally become a global requirement of every ASA Lab page.

## 10. ASA Lab deployment/integration

ASA-CAD remains a separate repository and separate versioned frontend Docker image in production.

It is still a first-class ASA Lab module: there is one ASA Lab domain/session, one project system and one classroom flow. ASA-CAD is **not an iframe and not a second login/application account**.

Recommended deployment:

```text
public ASA Lab origin
        |
        v
ASA Lab web/reverse proxy
        |
        +---- /api/* -----> asa-api
        |
        +---- /cad/* -----> asa-cad-web
        |
        `---- other UI ---> asa-web
```

The browser sees the same public origin. The CAD container only serves frontend/runtime assets. It does not calculate geometry for users.

Target module identity:

```text
moduleKey: cad
projectType: cad-document
schemaVersion: 1
editorRoute: /cad/projects/:projectId
viewerRoute: /cad/view/:versionId
```

This separate frontend route is deliberate because it provides:

- independent CAD deployment/rollback;
- no CAD payload in normal ASA Lab web bundle;
- CAD-specific runtime headers without changing every ASA Lab page;
- the exact same image for standalone and integrated testing.

ASA Lab pins an explicit ASA-CAD image/release version. It never consumes `main` or `latest` automatically.

## 11. ASA Lab persistence boundary

ASA-CAD must not know ASA Lab tenant tables, classroom tables, authentication internals or database implementation.

The ASA Lab host maps the ASA-owned persistence contract to existing Project Core APIs:

```ts
interface CadProjectHost {
  load(): Promise<{ document: CadDocument; revision: number }>;
  save(input: {
    document: CadDocument;
    baseRevision: number;
    mutationId: string;
  }): Promise<{ revision: number }>;
  saveSnapshot(imageDataUrl: string, sourceRevision: number): Promise<void>;
}
```

For assemblies the host also resolves pinned component project versions required by `CadAssemblyDocument`.

## 12. ASA Lab responsibilities

ASA Lab remains responsible for:

- account/session identity;
- learner identity;
- classes;
- assignments/courses;
- project ownership and permissions;
- Part/Assembly component project/version resolution;
- draft saving;
- version/checkpoint history;
- submissions;
- teacher review;
- gallery/project previews if enabled;
- storage of imported CAD attachments when required.

ASA Lab stores `CadDocument` and project metadata. It does not become a CAD compute server.

## 13. Save, recovery and cross-device behavior

1. A command changes the in-memory `CadDocument`.
2. ASA-CAD recomputes locally.
3. After a safe command boundary/debounce, the document is sent to ASA Lab.
4. ASA Lab saves it using existing `baseRevision` + `mutationId` conflict protection.
5. The editor reports saved state only after server acknowledgement.
6. Local IndexedDB may hold unsent recovery state after crash/network loss.
7. IndexedDB is recovery only; ASA Lab remains the cross-device authority.
8. Opening the project on another device downloads the same `CadDocument` and rebuilds geometry locally there.
9. An Assembly loads the exact pinned component versions needed to reproduce it.

## 14. Classroom behavior

A teacher creates an assignment whose module is `cad` and whose initial document may be a Part or Assembly.

The normal ASA Lab learning workflow remains unchanged:

`class -> assignment -> learner CAD project -> edit/autosave -> submit pinned version -> teacher review`

ASA-CAD does not implement a second user system, classroom system, assignment system or database.

## 15. Upstream update policy

The imported Toubkal baseline is pinned to a known commit.

We never automatically merge upstream `main` into ASA-CAD release code.

For an upstream update:

1. identify the exact upstream range;
2. classify changes by UI/runtime/geometry/solver/recompute/assembly;
3. ignore upstream UI changes unless deliberately useful;
4. port useful runtime fixes through ASA adapters;
5. run baseline CAD regressions;
6. run ASA Part and Assembly compatibility fixtures;
7. run protected Part/Assembly workflows;
8. accept only after all gates pass.

The long-term product belongs to ASA-CAD. Upstream is a source of selected implementation improvements.

## 16. Initial command scope

### Sketch

- line;
- circle;
- arc;
- rectangle;
- polygon;
- trim/extend;
- construction/centerline geometry;
- projected geometry where supported.

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

### Dimensions

- linear;
- horizontal;
- vertical;
- angular;
- radius;
- diameter.

### Part features

First wave:

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

Later:

- sweep;
- loft;
- shell;
- rib;
- draft;
- datum planes/axes/points.

### Assembly features

Required assembly foundation:

- insert Part/subassembly;
- occurrence transforms;
- fixed component;
- coincident/planar;
- concentric;
- parallel/perpendicular;
- distance;
- angle;
- replace/update component;
- assembly tree;
- deterministic save/reopen using pinned component versions.

## 17. Definition of product success

ASA-CAD is successful when a learner can:

1. open/run ASA-CAD standalone for development/testing without ASA Lab;
2. create and edit a parametric Part;
3. change an early dimension and correctly recompute downstream features;
4. create an Assembly from Parts/subassemblies and constrain component placement;
5. save, close and reopen both Part and Assembly documents without losing intent;
6. open ASA Lab in a supported browser;
7. create or receive a CAD Part/Assembly project;
8. enter the KOMPAS-oriented engineering interface without installing desktop CAD;
9. save work into ASA Lab;
10. reopen the same project on another supported device;
11. submit a specific reproducible version to a teacher;
12. have the teacher open exactly that submitted version and, for assemblies, the exact referenced component versions.

During modeling, the active learner device performs the CAD mathematics.

## 18. Non-negotiable project rules

- Do not rewrite the geometry kernel from scratch.
- Do not build the new product UI directly on vendor UI/store internals.
- Do not save only mesh/STL as project authority.
- Do not introduce normal server-side geometry RPCs.
- Do not auto-update upstream.
- Do not break saved-document compatibility silently.
- Do not treat Assembly as an optional afterthought; it has its own document semantics and regression lane.
- Do not require ASA Lab in order to run/test core ASA-CAD.
- Keep the production CAD frontend independently containerized/versioned.
- Every milestone must preserve protected Part regressions; assembly milestones add protected Assembly regressions.

## 19. Source-of-truth documents

- `docs/SYSTEM_SPEC.md` — what the complete system is and what must remain true.
- `docs/ARCHITECTURE.md` — technical boundaries and runtime architecture.
- `docs/ASSEMBLIES.md` — Part versus Assembly semantics and component-version rules.
- `docs/RUN_AND_DEPLOY.md` — standalone run/test/Docker and ASA Lab deployment model.
- `docs/ASA_LAB_INTEGRATION.md` — host/persistence/classroom integration contract.
- `docs/ROADMAP.md` — implementation order and acceptance gates.
- `docs/UPSTREAM.md` — upstream import/update procedure.
- `AGENTS.md` — coding-agent rules.
