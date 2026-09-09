# ASA-CAD architecture

## Goal

Build an ASA-owned browser CAD application with **Part** and **Assembly** documents, a replaceable KOMPAS-oriented product UI, local browser computation, and an independently deployable frontend container that integrates with ASA Lab through the same public origin and Project Core APIs.

## Internal layer model

```text
┌──────────────────────────────────────────────┐
│ ASA CAD UI                                  │
│ KOMPAS-oriented Part/Assembly shell         │
└──────────────────────┬───────────────────────┘
                       │ stable typed API
┌──────────────────────▼───────────────────────┐
│ ASA CAD Application API                     │
│ commands, selection, document, undo, status │
└──────────────────────┬───────────────────────┘
                       │ adapters
┌──────────────────────▼───────────────────────┐
│ ASA CAD Runtime                             │
│ sketch, features, assembly, recompute       │
└──────────────────────┬───────────────────────┘
                       │ implementation boundary
┌──────────────────────▼───────────────────────┐
│ Upstream-derived implementation             │
│ Toubkal + OpenCascade + solver(s) + Three   │
└──────────────────────────────────────────────┘
```

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

The browser performs sketch solving, Part recompute, Assembly mate solving, B-Rep operations and tessellation locally.

## Public document model

```ts
type CadDocument = CadPartDocument | CadAssemblyDocument;
type CadDocumentKind = 'part' | 'assembly';
```

### Part

Owns:

- origin/datum geometry;
- sketches;
- constraints/dimensions;
- feature history;
- bodies;
- persistent/stable topology references.

### Assembly

Owns:

- component occurrences;
- references to pinned component project versions;
- occurrence transforms;
- mates/assembly constraints;
- subassembly hierarchy;
- assembly-level state.

See `docs/ASSEMBLIES.md`.

## Mandatory dependency boundaries

### UI may depend on

- `CadApplication`;
- ASA-owned document/view DTOs;
- ASA command IDs;
- ASA view models.

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

Exact M1 signatures can evolve, but the dependency direction is fixed:

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

Command families include:

```text
sketch.*
constraint.*
dimension.*
feature.*
assembly.*
document.*
view.*
```

The UI never invokes OpenCascade or vendor services directly.

## Host/persistence boundary

ASA-CAD does not import ASA Lab networking/database code.

Conceptual host contract:

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

Additional Assembly host capability resolves referenced/pinned component project versions without exposing ASA Lab persistence internals to geometry code.

Standalone mode provides a local/mock host. Production provides an ASA Lab adapter.

## Document authority

The authoritative state is serialized ASA-owned intent.

Runtime OpenCascade B-Rep and rendered Three.js geometry are derived caches.

Rules:

1. every Part feature has stable ASA-owned identity;
2. every Assembly occurrence/mate has stable ASA-owned identity;
3. Part topology references fail explicitly if no longer resolvable;
4. Assembly component updates are explicit, never silent;
5. submitted Assembly versions pin component versions;
6. identical document + compatible engine version must rebuild deterministically;
7. failed recompute/assembly solve must not corrupt the last valid saved document.

## Runtime principles

1. OpenCascade provides exact geometry.
2. Three.js is presentation/picking support, not project authority.
3. sketch solver state is represented in ASA documents, not hidden only in WASM memory.
4. normal Part/Assembly computation executes on the active client device.
5. ASA Lab is persistence/education infrastructure, not a CAD compute service.
6. CAD runtime assets are loaded only on CAD routes.
7. standalone and production use the same release/container form.

## Standalone runtime

Development can run without Docker using root scripts.

Container run:

```bash
docker compose up --build
```

Default:

```text
http://localhost:8088
```

See `docs/RUN_AND_DEPLOY.md`.

## Production runtime delivery

Target sequence:

1. ASA Lab resolves a `cad` project/document.
2. Browser navigates to same-origin `/cad/projects/:projectId`.
3. ASA Lab front door proxies the request to pinned `asa-cad-web`.
4. ASA-CAD performs capability checks.
5. Browser loads content-hashed OpenCascade WASM/runtime assets.
6. WASM is instantiated in browser memory.
7. ASA-CAD loads `CadDocument` through ASA Lab APIs.
8. Part/Assembly geometry is rebuilt/solved locally.
9. Autosave sends serialized document revisions back to Project Core.

Opening other ASA Lab modules never downloads the CAD kernel.

## Threading and browser isolation

The imported baseline currently uses OpenCascade on the main thread and requires SharedArrayBuffer/cross-origin isolation.

Do not redesign threading during baseline import.

The separate `/cad/*` document/container allows current COOP/COEP requirements to remain local to CAD instead of becoming global ASA Lab requirements.

Future worker/single-thread/custom-WASM changes are independent regression-tested runtime migrations. Client-side execution is mandatory; the exact threading implementation is not part of the public contract.

## Device model

The same `CadDocument` is portable across supported devices.

- desktop/laptop: reference full UI;
- tablet/phone: same document/commands/local compute, responsive panel presentation and safe complexity/rendering limits;
- unsupported device: explicit failure/read-only where possible.

No unsupported device silently switches to server compute.

## ASA Lab module identity

```text
moduleKey: cad
projectType: cad-document
schemaVersion: 1
editorRoute: /cad/projects/:projectId
viewerRoute: /cad/view/:versionId
```

`CadDocument.kind` determines Part versus Assembly behavior.

ASA Lab owns:

- session/identity;
- projects and permissions;
- classes/assignments/courses;
- versions/checkpoints;
- submissions/review;
- Assembly component-version resolution.

ASA-CAD owns:

- editor/viewer;
- Part/Assembly document semantics;
- CAD commands;
- geometry/solver runtime adapters;
- local compute and rendering.

## Compatibility policy

Saved project compatibility is a hard release boundary.

- new releases open documents from their declared supported schema range;
- migrations are explicit/tested;
- read does not silently rewrite stored documents;
- every document records schema + engine version;
- Part and Assembly fixtures are both maintained;
- ASA Lab pins an explicit ASA-CAD image/version, never `main` or `latest`.

## Upstream isolation

Toubkal is imported implementation source, not product architecture.

M1 wraps useful geometry/solver/recompute/picking/assembly behavior behind ASA adapters. Vendor UI changes do not force ASA UI changes.

Upstream updates happen only through the controlled lane in `docs/UPSTREAM.md`.
