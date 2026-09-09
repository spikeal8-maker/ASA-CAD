# ASA-CAD architecture

## Goal

Build an ASA-owned browser CAD application whose product UI can be replaced completely without coupling it to ToubkalCAD implementation details, and whose interactive CAD mathematics runs on the active learner device when hosted by ASA Lab.

## Layer model

```text
┌──────────────────────────────────────────────┐
│ ASA CAD UI                                  │
│ KOMPAS-oriented layout, commands, panels    │
└──────────────────────┬───────────────────────┘
                       │ stable typed API
┌──────────────────────▼───────────────────────┐
│ ASA CAD Application API                     │
│ commands, selection, document, undo, status │
└──────────────────────┬───────────────────────┘
                       │ adapters
┌──────────────────────▼───────────────────────┐
│ ASA CAD Runtime                             │
│ feature graph, recompute, sketch, picking   │
└──────────────────────┬───────────────────────┘
                       │ implementation boundary
┌──────────────────────▼───────────────────────┐
│ Upstream-derived CAD implementation         │
│ Toubkal services + OpenCascade + PlaneGCS   │
└──────────────────────────────────────────────┘
```

When embedded in ASA Lab there is a second, orthogonal boundary:

```text
ASA Lab ModuleEditorHost
        │ projectId / user / assignment context
        ▼
ASA-CAD editor (lazy loaded)
        │
        ├── CadProjectHost ─────► ASA Lab project/version APIs
        │
        └── CadApplication
                 │
                 ▼
          local browser runtime
          OpenCascade WASM + solver
```

ASA Lab never calls OpenCascade. ASA-CAD never owns classroom/user databases.

## Mandatory boundaries

### UI layer may depend on

- `CadApplication` interface;
- immutable/document DTOs owned by ASA-CAD;
- command IDs owned by ASA-CAD;
- view models produced by ASA-CAD.

### UI layer must not depend on

- `window.oc`;
- raw `TopoDS_Shape` values;
- Toubkal Zustand store shape;
- Toubkal `CustomEvent` names;
- concrete `Occ*Service` classes;
- `CADGeometryRegistry` singleton access;
- upstream component file paths.

### ASA Lab host may depend on

- ASA-CAD public editor/viewer entry points;
- `CadDocument` parser/schema version;
- `CadProjectHost` persistence interface;
- ASA-CAD release/runtime version.

### ASA Lab host must not depend on

- Toubkal stores/components/services;
- OpenCascade types;
- PlaneGCS types;
- WASM shape pointers;
- geometry command implementation.

## Proposed public application API

The exact signatures will be refined in M1, but the direction is fixed:

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

Commands are product-level operations such as:

- `sketch.create`
- `sketch.line`
- `sketch.rectangle`
- `constraint.horizontal`
- `constraint.vertical`
- `dimension.linear`
- `feature.extrude`
- `feature.cutExtrude`
- `feature.revolve`
- `feature.fillet`
- `feature.chamfer`
- `document.save`

UI components dispatch these commands and never invoke OpenCascade directly.

## Host persistence API

ASA-CAD receives persistence from its host rather than importing ASA Lab networking code:

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

Standalone development can supply a local implementation. ASA Lab supplies an adapter to Project Core.

## Document authority

The authoritative project state must be a serializable ASA-owned parametric document, not the current Three.js scene and not native WASM shape pointers.

Minimum structure:

```text
CadDocument
├── schemaVersion
├── engineVersion
├── units
├── variables
├── origin
├── sketches
├── constraints
├── dimensions
├── features
├── bodies
├── references
└── viewportState
```

Runtime B-Rep shapes and meshes are derived caches.

## Runtime principles

1. Document intent is authoritative.
2. OpenCascade B-Rep is the exact geometry result.
3. Three.js geometry is presentation only.
4. Every feature has a stable ASA-owned ID.
5. Downstream references must fail explicitly when ambiguous; never silently bind to another edge/face.
6. Recompute must be deterministic for identical document + engine version.
7. A failed recompute must not corrupt the last valid saved document.
8. Normal geometry/solver/recompute/tessellation work executes on the active client device.
9. The ASA Lab server is persistence/education infrastructure, not a CAD compute service.
10. CAD runtime assets load only when a CAD project is opened.

## Client runtime delivery

The production build must split the normal editor shell from the heavy CAD runtime.

Target sequence:

1. ASA Lab resolves `moduleKey = cad`.
2. `ModuleEditorHost` lazy-imports the ASA-CAD editor.
3. ASA-CAD probes browser/device capabilities.
4. ASA-CAD loads the content-hashed OpenCascade WASM asset.
5. WASM is instantiated in the browser and uses device CPU/RAM.
6. Runtime assets are reused from browser cache until the runtime version changes.

Opening electronics/chess/current ASA 3D must not download the CAD kernel.

## Upstream isolation

ToubkalCAD currently mixes UI, Zustand state, `window` globals, geometry services and an imperative event bus. ASA-CAD will not preserve that coupling as its public architecture.

The initial upstream import is a baseline implementation. M1 introduces adapters around its geometry, solver, picking and recompute behavior. New ASA UI work starts only after those adapters are established.

## Threading and browser isolation

Do not redesign threading in the first import. Preserve the known-working baseline first.

The imported Toubkal baseline currently runs OpenCascade on the main browser thread and expects `SharedArrayBuffer`/cross-origin isolation. These are implementation facts to remove or isolate before ASA Lab production integration; they are not allowed to become accidental requirements of every ASA Lab page.

Any worker/single-thread/custom-WASM change is a separate regression-tested runtime migration. Client-side execution is mandatory; the exact browser threading model is not.

## Device model

The same `CadDocument` is portable across supported devices.

- desktop/laptop: full reference editor;
- tablet/phone: local computation with responsive panels and capability-dependent rendering/performance limits;
- unsupported browser/device: explicit safe failure/read-only fallback where possible.

No unsupported device may silently switch to server-side CAD computation.

## ASA Lab integration boundary

ASA-CAD stays standalone until its parametric workflow is stable, but the host contract is designed before UI divergence.

ASA Lab integration supplies:

- authenticated actor/project context;
- module registration (`cad` / `cad-part`);
- project open/save/version operations;
- snapshots;
- classroom assignments;
- submission/version pinning;
- teacher review/viewer context.

ASA Lab already hosts subject editors by module key and lazy component loading; CAD follows that mechanism rather than creating a second application shell.

See `docs/ASA_LAB_INTEGRATION.md` for the binding contract.

## Compatibility policy

Saved project compatibility is a hard boundary.

- New engine releases must open documents created by previous released ASA-CAD versions.
- Schema migrations are explicit and test-covered.
- Engine upgrades never rewrite a stored document silently on read.
- Every saved project records the document schema and ASA-CAD engine version that last wrote it.
- An ASA Lab deployment pins an explicit ASA-CAD release; it never consumes upstream or ASA-CAD `main` automatically.
