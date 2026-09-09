# ASA-CAD system specification

This document is the primary product and system contract for ASA-CAD. If another document, issue or implementation detail conflicts with this file, this file defines the intended end state until it is deliberately revised.

## 1. What ASA-CAD is

ASA-CAD is a new browser-native parametric engineering CAD module for ASA Lab.

It is a separate module. It does not replace the existing beginner `three-d` editor.

The product goal is to give learners a browser CAD environment whose desktop layout, command organization, terminology and modeling workflow are as close as practical to KOMPAS-3D, so that skills learned in ASA Lab transfer directly to KOMPAS-3D.

The interface is implemented by ASA-CAD. We do not depend on the visible ToubkalCAD interface and we do not ship proprietary KOMPAS binaries, source code, icons or other protected assets.

## 2. End-user experience

A learner opens ASA Lab and creates or receives a CAD project. ASA Lab opens the ASA-CAD editor inside the normal ASA Lab product flow.

The reference desktop interface contains:

- document tabs and application commands;
- a top KOMPAS-oriented command/ribbon area;
- model/history tree;
- contextual parameters/task panel;
- central 3D viewport;
- sketch mode with constraints and driving dimensions;
- in-command confirm/cancel lifecycle;
- status and constraint feedback;
- Russian engineering terminology aligned with the taught KOMPAS workflow;
- standard selection, camera, zoom and model-navigation behavior expected from desktop CAD.

Desktop is the reference interface. Tablet/phone use the same `CadDocument` and command model, but panels may collapse into drawers/tabs because the screen is smaller.

## 3. Core modeling behavior

ASA-CAD is a parametric CAD system, not a mesh-only 3D editor.

The minimum intended modeling model is:

`plane/face -> sketch -> geometry -> constraints -> driving dimensions -> finish sketch -> feature -> downstream features -> edit earlier feature -> deterministic recompute`

The first protected reference part is:

`Sketch 60x40 -> Extrude 10 -> centered diameter-12 cut -> Fillet -> edit 60 to 80 -> recompute -> save -> close -> reopen -> edit again`

The model/history tree is functional history, not decoration. Changing an upstream sketch or feature must recompute downstream operations or surface an explicit rebuild error.

Silent rebinding to a different face/edge after topology changes is forbidden.

## 4. CAD implementation base

ASA-CAD starts from a pinned ToubkalCAD source baseline already imported under `vendor/toubkal/`.

We reuse and harden useful implementation layers:

- OpenCascade WebAssembly geometry kernel;
- sketch constraint solving;
- feature/history and recompute behavior;
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
    +-- sketch solver
    +-- Three.js presentation
```

The product UI must not directly use:

- `window.oc`;
- raw `TopoDS_Shape` objects;
- upstream Zustand store internals;
- upstream `CustomEvent` names;
- concrete upstream `Occ*Service` classes;
- upstream component paths.

This boundary is what lets us replace the entire UI and still selectively import future upstream geometry/recompute fixes.

## 6. Project document

The server-side/cross-device source of truth is a serializable ASA-owned parametric document.

Conceptual structure:

```text
CadDocument
|- schemaVersion
|- engineVersion
|- units
|- variables
|- origin / datum geometry
|- sketches
|  |- geometry
|  |- constraints
|  `- dimensions
|- features
|- bodies
|- stable references
`- optional viewport/editor state
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
- feature construction;
- boolean operations;
- fillet/chamfer and other B-Rep operations;
- history recompute;
- tessellation;
- picking/measurement support;
- normal export generation where practical.

The GPU is primarily presentation/rendering. The geometry kernel is WebAssembly code instantiated in browser memory and consumes local device resources.

Unsupported devices must fail clearly or offer read-only access where possible. ASA-CAD must not silently fall back to server-side geometry calculation.

## 8. Runtime loading and performance

ASA Lab must not download the CAD engine for users who are not opening CAD.

Target loading path:

```text
ASA Lab normal boot
    |
    | user opens moduleKey = cad
    v
lazy-load ASA-CAD editor bundle
    v
capability probe
    v
lazy-load content-hashed CAD WASM/runtime assets
    v
instantiate kernel in browser memory
    v
open/recompute CadDocument locally
```

The CAD/WASM payload is cached by the browser using versioned/content-hashed immutable assets.

A normal ASA Lab page, electronics project, chess project or current beginner 3D project must not fetch OpenCascade WASM.

Current upstream SharedArrayBuffer/cross-origin-isolation requirements are implementation details to isolate and prove before production integration. They must not accidentally become a global requirement of every ASA Lab page.

## 9. ASA Lab integration

ASA-CAD is developed in this repository, but the finished editor becomes a native ASA Lab subject module, not an iframe and not a separately hosted application that learners have to log into again.

Target module identity:

```text
moduleKey: cad
projectType: cad-part
schemaVersion: 1
editorRoute: /projects/:projectId/cad
viewerRoute: /view/projects/:versionId/cad
```

ASA Lab lazy-loads a pinned ASA-CAD release from its normal `ModuleEditorHost` path.

ASA-CAD receives project persistence through a small host interface such as:

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

ASA-CAD must not know ASA Lab tenant tables, classroom tables, authentication internals or database implementation.

## 10. ASA Lab responsibilities

ASA Lab remains responsible for:

- account/session identity;
- learner identity;
- classes;
- assignments/courses;
- project ownership and permissions;
- draft saving;
- version/checkpoint history;
- submissions;
- teacher review;
- gallery/project previews if enabled;
- storage of imported CAD attachments when required.

ASA Lab stores `CadDocument` and project metadata. It does not become a CAD compute server.

## 11. Save, recovery and cross-device behavior

1. A command changes the in-memory `CadDocument`.
2. ASA-CAD recomputes locally.
3. After a safe command boundary/debounce, the document is sent to ASA Lab.
4. ASA Lab saves it using existing `baseRevision` + `mutationId` conflict protection.
5. The editor reports saved state only after server acknowledgement.
6. Local IndexedDB may hold unsent recovery state after crash/network loss.
7. IndexedDB is recovery only; ASA Lab remains the cross-device authority.
8. Opening the project on another device downloads the same `CadDocument` and rebuilds geometry locally there.

## 12. Classroom behavior

A teacher creates an assignment whose module is `cad`.

The normal ASA Lab learning workflow remains unchanged:

`class -> assignment -> learner project -> edit/autosave -> submit pinned version -> teacher review`

ASA-CAD does not implement a second user system, classroom system, assignment system or database.

## 13. Upstream update policy

The imported Toubkal baseline is pinned to a known commit.

We never automatically merge upstream `main` into ASA-CAD release code.

For an upstream update:

1. identify the exact upstream range;
2. classify changes by UI/runtime/geometry/solver/recompute;
3. ignore upstream UI changes unless deliberately useful;
4. port useful runtime fixes through ASA adapters;
5. run baseline CAD regressions;
6. run ASA `CadDocument` compatibility fixtures;
7. run the protected parametric reference workflow;
8. accept only after all gates pass.

The long-term product belongs to ASA-CAD. Upstream is a source of selected implementation improvements.

## 14. Initial command scope

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
- datum planes/axes/points;
- additional assembly/drawing capabilities only after the part-modeling foundation is stable.

## 15. Definition of product success

ASA-CAD is successful when a learner can:

1. open ASA Lab in a supported browser;
2. create or receive a CAD project;
3. enter a KOMPAS-oriented engineering interface without installing desktop CAD;
4. create a constrained parametric part;
5. edit an early dimension and correctly recompute downstream features;
6. save work into ASA Lab;
7. reopen the same project on another supported device;
8. continue editing with the same parametric history;
9. submit a specific version to a teacher;
10. have the teacher open exactly that submitted version.

During modeling, the active learner device performs the CAD mathematics.

## 16. Non-negotiable project rules

- Do not rewrite the geometry kernel from scratch.
- Do not build the new product UI directly on vendor UI/store internals.
- Do not save only mesh/STL as project authority.
- Do not introduce normal server-side geometry RPCs.
- Do not auto-update upstream.
- Do not break saved-document compatibility silently.
- Do not start broad KOMPAS UI work before the ASA application/document boundary exists.
- Every milestone must preserve the protected reference part regression.

## 17. Source-of-truth documents

- `docs/SYSTEM_SPEC.md` — what the complete system is and what must remain true.
- `docs/ARCHITECTURE.md` — technical boundaries and runtime architecture.
- `docs/ASA_LAB_INTEGRATION.md` — host/persistence/classroom integration contract.
- `docs/ROADMAP.md` — implementation order and acceptance gates.
- `docs/UPSTREAM.md` — upstream import/update procedure.
- `AGENTS.md` — coding-agent rules.
