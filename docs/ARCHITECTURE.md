# ASA-CAD architecture

## Goal

Build an ASA-owned browser CAD application with six first-class engineering document kinds — **Part, Assembly, Drawing, Fragment, Specification and Text** — a replaceable KOMPAS-oriented product UI, local browser computation where CAD math is required, and an independently deployable frontend container that integrates with ASA Lab through the same public origin and Project Core APIs.

## Internal layer model

```text
┌──────────────────────────────────────────────┐
│ ASA CAD UI                                  │
│ KOMPAS-oriented multi-document shell        │
└──────────────────────┬───────────────────────┘
                       │ typed presentation/actions
┌──────────────────────▼───────────────────────┐
│ ASA CAD Application API                     │
│ commands, selection, document, undo, status │
└──────────────────────┬───────────────────────┘
                       │ adapters
┌──────────────────────▼───────────────────────┐
│ ASA CAD domain/runtime services             │
│ sketch, part, assembly, 2D/docs, persistence│
└──────────────────────┬───────────────────────┘
                       │ implementation boundary
┌──────────────────────▼───────────────────────┐
│ Runtime implementations                     │
│ OpenCascade + PlaneGCS + Three + isolated   │
│ vendor-derived services where appropriate   │
└──────────────────────────────────────────────┘
```

Not every document kind needs OpenCascade. Drawing/Fragment use the shared ASA 2D drafting layer; Specification/Text use document-specific ASA layers. OpenCascade is loaded only for operations that require the exact 3D kernel.

## Deployment boundary

ASA-CAD is a separate frontend application/container even when integrated into ASA Lab.

```text
browser
  |
  v
ASA Lab public origin
  |
  +---- /api/* -----> asa-api
  +---- /cad/* -----> asa-cad-web
  `---- other UI ---> asa-web
```

`asa-cad-web` serves HTML/JS/WASM/static assets only. It has no CAD compute backend and no database.

Sketch solving, Part recompute, Assembly mate solving, B-Rep operations and tessellation execute locally on the supported client device. Drawing/Fragment/Specification/Text editing also stays client-side except for persistence/collaboration APIs owned by ASA Lab.

## Public document model

The code-level public family is the six-kind union in `src/contracts/document.ts`:

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

### Part

Owns origin/datum geometry, sketches, constraints/dimensions, feature history, bodies and persistent topology references.

### Assembly

Owns component occurrences, references to pinned component versions, occurrence transforms, mates, subassembly hierarchy and assembly-level state. See `docs/ASSEMBLIES.md`.

### Drawing

Owns sheets, associative model-view definitions, 2D drafting/annotation state and explicit references to Part/Assembly versions. It is not a screenshot of the 3D viewport.

### Fragment

Owns reusable/free 2D geometry and layers using the same 2D drafting primitives as Drawing, without requiring sheet/title-block semantics.

### Specification

Owns structured product-composition/BOM state and explicit source document references/versions.

### Text

Owns engineering-document pages/content/formatting and explicit links to other engineering documents. Normal Text editing has no OpenCascade dependency.

Detailed semantics live in `docs/DOCUMENT_TYPES.md`.

## Mandatory dependency boundaries

### UI may depend on

- `CadApplication`;
- ASA-owned document/view DTOs;
- ASA command IDs and typed `CadUiAction`/presentation view models;
- machine UI registries.

### UI must not depend on

- `window.oc`;
- raw `TopoDS_Shape`;
- vendor Zustand shape;
- vendor `CustomEvent` names;
- concrete vendor `Occ*Service` classes;
- `CADGeometryRegistry` singleton;
- vendor component file paths.

### ASA Lab may depend on

- ASA-CAD route/release metadata;
- `CadDocument` schema/version;
- documented Project Core/host API contract;
- ASA-CAD image/release version.

### ASA Lab must not depend on

- Toubkal stores/components/services;
- OpenCascade types;
- PlaneGCS types;
- WASM pointers;
- feature/assembly solver implementation.

## Public application API direction

Exact signatures can evolve, but the dependency direction is fixed:

```ts
interface CadApplication {
  getDocument(): CadDocument;
  getState(): CadApplicationState;
  execute(command: CadCommand): Promise<CadCommandResult>;
  undo(): Promise<void>;
  redo(): Promise<void>;
  subscribe(listener: (state: CadApplicationState) => void): () => void;
}
```

Command families include `sketch.*`, `constraint.*`, `dimension.*`, `feature.*`, `assembly.*`, `drawing.*`, `fragment.*`, `spec.*`, `text.*`, `document.*` and `view.*` as those document lanes are implemented.

The UI never invokes OpenCascade or vendor services directly.

## UI presentation boundary

Desktop, tablet and phone are presentations of one application/command model.

```text
command-registry + layout-registry
             |
             v
      CadUiAction/ViewModel
        /            \
DesktopShell       MobileShell
        \            /
             v
        CadApplication
```

Rules:
- no mobile-to-desktop DOM delegation;
- command labels/identity/placement come from machine registries where defined;
- one visible command ID maps to one typed action lifecycle;
- responsive presentation may change grouping/drawers but not command/document semantics.

## Host/persistence boundary

ASA-CAD does not import ASA Lab networking/database code.

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

`CadProjectSession` owns the editor persistence/recovery lifecycle above this host contract. Product UI must not bypass it with ad-hoc localStorage/network persistence. Standalone provides a local host; production provides the ASA Lab adapter.

Additional Assembly host capability resolves referenced/pinned component project versions without exposing ASA Lab persistence internals to geometry code.

## Document authority

The authoritative state is serialized ASA-owned intent. Runtime OpenCascade B-Rep and rendered Three.js geometry are derived caches.

Rules:
1. every Part feature has stable ASA-owned identity;
2. every Assembly occurrence/mate has stable ASA-owned identity;
3. 2D/document objects receive stable ASA-owned identities as their lanes mature;
4. Part topology references fail explicitly if no longer resolvable;
5. Assembly component updates are explicit, never silent;
6. submitted Assembly versions pin component versions;
7. identical document + compatible engine version must rebuild deterministically;
8. failed recompute/solve/update must not corrupt the last valid saved document.

## Runtime principles

1. OpenCascade provides exact 3D geometry where required.
2. PlaneGCS or its replacement sits behind an ASA sketch-solver adapter.
3. Three.js is presentation/picking support, not project authority.
4. sketch/assembly solver state is represented in ASA documents, not hidden only in WASM memory.
5. normal CAD computation executes on the active supported client device.
6. Drawing/Fragment/Specification/Text do not load OpenCascade unless a concrete operation requires it.
7. ASA Lab is persistence/education infrastructure, not a CAD compute service.
8. CAD runtime assets load only on CAD routes and heavy kernel assets load lazily.
9. standalone and production use the same release/container form.

## Standalone runtime

Primary ASA development:

```bash
npm run install:vendor
npm run dev
```

Default dev address: `http://localhost:8090`.

Vendor diagnostic surface is explicit: `npm run dev:vendor`.

Container run:

```bash
docker compose up --build
```

Default Docker address: `http://localhost:8088`.

See `docs/RUN_AND_DEPLOY.md`.

## Production runtime delivery

1. ASA Lab resolves a `cad` project/document.
2. Browser navigates to same-origin `/cad/projects/:projectId` or the appropriate viewer route.
3. ASA Lab front door proxies `/cad/*` to pinned `asa-cad-web`.
4. ASA-CAD performs capability checks for the active document/runtime need.
5. Heavy OpenCascade WASM is loaded only if the operation/document requires it.
6. ASA-CAD loads `CadDocument` through `CadProjectSession`/`CadProjectHost`.
7. Document-specific computation/update runs locally.
8. Saves send serialized document revisions back through Project Core.

Opening unrelated ASA Lab modules never downloads the CAD kernel.

## Threading and browser isolation

The imported OpenCascade baseline currently runs on the main thread and requires SharedArrayBuffer/cross-origin isolation.

The separate `/cad/*` frontend/container allows current COOP/COEP requirements to remain local to CAD instead of becoming global ASA Lab requirements.

Future worker/single-thread/custom-WASM changes are independent regression-tested runtime migrations. Client-side execution is mandatory; exact threading is not a public document contract.

## Device model

The same `CadDocument` is portable across supported devices.

- desktop/laptop: reference full UI;
- tablet/phone: same document/commands/local computation with responsive presentation and safe complexity limits;
- unsupported device: explicit failure/read-only where possible.

No unsupported device silently switches to server CAD computation.

## ASA Lab module identity

```text
moduleKey: cad
projectType: cad-document
schemaVersion: 1
editorRoute: /cad/projects/:projectId
viewerRoute: /cad/view/:versionId
```

`CadDocument.kind` selects the document-specific editor/workspace.

ASA Lab owns session/identity, projects/permissions, classes/assignments/courses, versions/checkpoints, submissions/review and resolution of linked/pinned document versions.

ASA-CAD owns the editor/viewer, all six document semantics, CAD/document commands, local runtime adapters and presentation.

## Compatibility policy

Saved project compatibility is a hard release boundary.

- new releases open documents from their declared supported schema range;
- migrations are explicit/tested;
- read does not silently rewrite stored documents;
- every document records schema + engine version;
- compatibility fixtures expand with every implemented document lane;
- ASA Lab pins an explicit ASA-CAD image/version, never `main` or `latest`.

## Upstream isolation

Toubkal is imported implementation source, not product architecture.

Useful geometry/solver/recompute/picking/assembly behavior is wrapped behind ASA adapters. Drawing/Fragment/Specification/Text are ASA-owned product layers and need not inherit vendor UI/runtime structure.

Upstream updates happen only through the controlled lane in `docs/UPSTREAM.md`.
