# ASA-CAD architecture

## Goal

Build an ASA-owned browser CAD application with six first-class engineering document kinds, a replaceable KOMPAS-oriented product UI, local client computation and an independently deployable frontend container that integrates with ASA Lab through the same public origin and Project Core APIs.

The public document family is:

- Part / Деталь;
- Assembly / Сборка;
- Drawing / Чертеж;
- Fragment / Фрагмент;
- Specification / Спецификация;
- Text document / Текстовый документ.

Current runtime maturity is intentionally uneven: the accepted exact-geometry vertical slice is Part-focused; Assembly and the engineering-document editors are later product stages. Public architecture must not be reduced to only the document kinds that already have mature runtime implementations.

## Internal layer model

```text
┌──────────────────────────────────────────────┐
│ ASA CAD UI                                  │
│ KOMPAS-oriented multi-document shell        │
└──────────────────────┬───────────────────────┘
                       │ stable typed API
┌──────────────────────▼───────────────────────┐
│ ASA CAD Application API                     │
│ commands, selection, document, undo, status │
└──────────────────────┬───────────────────────┘
                       │ adapters
┌──────────────────────▼───────────────────────┐
│ ASA CAD Runtime / document engines           │
│ sketch, Part, Assembly, 2D/docs as adopted  │
└──────────────────────┬───────────────────────┘
                       │ implementation boundary
┌──────────────────────▼───────────────────────┐
│ Upstream-derived implementation where used  │
│ Toubkal + OpenCascade + solver(s) + Three   │
└──────────────────────────────────────────────┘
```

Drawing/Fragment/Specification/Text are ASA-owned product layers and are not required to inherit Toubkal UI or runtime structure.

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

The active client performs the computation required by the document kind. Part/Assembly exact geometry and solving are client-side; Drawing/Fragment 2D operations and Specification/Text editing are also client-side application work and do not require a server CAD engine.

## Public document model

The canonical TypeScript direction is:

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

This list must stay synchronized with `docs/SYSTEM_SPEC.md` and `src/contracts/document.ts`.

### Part

Owns:

- origin/datum geometry;
- sketches;
- constraints/dimensions;
- feature history;
- bodies;
- persistent/stable topology references.

Current protected exact-geometry runtime is Part-focused.

### Assembly

Owns:

- component occurrences;
- references to pinned component project versions;
- occurrence transforms;
- mates/assembly constraints;
- subassembly hierarchy;
- assembly-level state.

See `docs/ASSEMBLIES.md`.

### Drawing

Owns sheet-based structured 2D engineering documentation, including sheets, associative/model references, views, dimensions, annotations and drawing-layer state. Drawing is not a screenshot of the 3D viewport.

### Fragment

Owns reusable/free 2D engineering geometry without mandatory sheet/title-block semantics. Drawing and Fragment are expected to share ASA-owned 2D drafting primitives rather than duplicate engines.

### Specification

Owns structured product/BOM composition linked to explicit document/project versions. It is structured engineering data, not a disconnected manually typed table.

### Text document

Owns page-based engineering text, tables and document formatting with links to other engineering documents. Normal Text editing must not require OpenCascade.

## Runtime maturity versus document architecture

Document membership and runtime maturity are separate concepts.

Current accepted maturity:

```text
Part            -> protected exact B-Rep vertical slice exists
Assembly        -> public schema/architecture exists; product workflow is M4A
Drawing         -> public schema/architecture exists; product workflow is M6
Fragment        -> public schema/architecture exists; product workflow is M6
Specification   -> public schema/architecture exists; product workflow is M6A
Text            -> public schema/architecture exists; product workflow is M6A
```

A future implementation stage must extend the existing six-kind public model rather than redefining `CadDocument` around only the currently mature editors.

## Mandatory dependency boundaries

### UI may depend on

- `CadApplication`;
- ASA-owned document/view DTOs;
- ASA command IDs;
- ASA view/action models.

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

Command families may include:

```text
system.*
document.*
view.*
sketch.*
constraint.*
dimension.*
feature.*
assembly.*
drawing.*
draft.*
spec.*
text.*
```

The UI never invokes OpenCascade or vendor services directly.

## Host/persistence boundary

ASA-CAD does not import ASA Lab networking/database code into document/runtime semantics.

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

Standalone mode provides a local host. Production provides an ASA Lab adapter. Product UI must use the session/host boundary rather than inventing a separate persistence path per document editor.

## Document authority

The authoritative state is serialized ASA-owned intent.

Runtime B-Rep, solver state that can be rebuilt, rendered Three.js geometry and preview meshes are derived runtime state/caches unless explicitly represented as ASA document intent.

Rules:

1. every persistent object has stable ASA-owned identity appropriate to its document kind;
2. every Part feature has stable ASA-owned identity;
3. every Assembly occurrence/mate has stable ASA-owned identity;
4. Part/Assembly topology references fail explicitly if no longer resolvable;
5. Assembly component updates are explicit, never silent;
6. submitted Assembly versions pin component versions;
7. Drawing/Specification links reference explicit source identities/versions rather than implicit latest state;
8. identical document + compatible engine version must rebuild deterministically where recompute applies;
9. failed recompute/solve/update must not corrupt the last valid saved document.

## Runtime principles

1. OpenCascade provides exact Part/Assembly B-Rep geometry where required.
2. Three.js is presentation/picking support, not project authority.
3. sketch solver state is represented in ASA documents, not hidden only in WASM memory.
4. normal interactive computation executes on the active client device.
5. document kinds that do not require B-Rep must not load OpenCascade merely because they run inside ASA-CAD.
6. ASA Lab is persistence/education infrastructure, not a CAD compute service.
7. CAD runtime assets are loaded only when the active workflow requires them.
8. standalone and production use the same release/container form.

## Standalone runtime

Development can run without Docker using root scripts.

Primary ASA product shell:

```bash
npm run install:vendor
npm run dev
```

Default development address:

```text
http://localhost:8090
```

Container run:

```bash
docker compose up --build
```

Default container address:

```text
http://localhost:8088
```

See `docs/RUN_AND_DEPLOY.md`.

## Production runtime delivery

Target sequence:

1. ASA Lab resolves a `cad` project/document.
2. Browser navigates to same-origin `/cad/projects/:projectId` or another documented CAD route.
3. ASA Lab front door proxies the request to pinned `asa-cad-web`.
4. ASA-CAD performs capability checks appropriate to the document/workflow.
5. ASA-CAD loads `CadDocument` through the host/Project Core boundary.
6. Runtime assets are lazy-loaded only when required by that document/workflow.
7. Part/Assembly exact geometry is rebuilt/solved locally when applicable.
8. Drawing/Fragment/Specification/Text operate through their ASA-owned client engines without unnecessary B-Rep startup.
9. Save/autosave sends serialized document revisions back through the host boundary.

Opening unrelated ASA Lab modules never downloads the CAD kernel.

## Threading and browser isolation

The imported exact-geometry baseline currently uses OpenCascade on the main thread and requires SharedArrayBuffer/cross-origin isolation.

Do not redesign threading merely as part of ordinary editor work.

The separate `/cad/*` document/container allows current COOP/COEP requirements to remain local to CAD instead of becoming global ASA Lab requirements.

Future worker/single-thread/custom-WASM changes are independent regression-tested runtime migrations. Client-side execution is mandatory; the exact threading implementation is not part of the public document contract.

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

`CadDocument.kind` selects Part, Assembly, Drawing, Fragment, Specification or Text behavior inside the shared ASA-CAD application shell.

ASA Lab owns:

- session/identity;
- projects and permissions;
- classes/assignments/courses;
- versions/checkpoints;
- submissions/review;
- linked-document/component-version resolution infrastructure.

ASA-CAD owns:

- editor/viewer;
- semantics for all six CAD document kinds;
- CAD/document commands;
- geometry/solver/2D/document runtime adapters;
- local compute and rendering.

## Compatibility policy

Saved project compatibility is a hard release boundary.

- new releases open documents from their declared supported schema range;
- migrations are explicit/tested;
- read does not silently rewrite stored documents;
- every document records schema + engine version;
- protected fixtures/corpora expand as document kinds become implemented;
- Part protected regression remains permanent;
- protected Assembly regression becomes permanent after M4A;
- ASA Lab pins an explicit ASA-CAD image/version, never `main` or `latest`.

## Upstream isolation

Toubkal is imported implementation source, not product architecture.

ASA adapters wrap useful geometry/solver/recompute/picking/assembly behavior. Vendor UI changes do not force ASA UI changes. Drawing/Fragment/Specification/Text must not be designed around vendor UI internals merely for consistency with Toubkal.

Upstream updates happen only through the controlled lane in `docs/UPSTREAM.md`.