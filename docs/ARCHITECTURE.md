# ASA-CAD architecture

## Goal

Build an ASA-owned browser CAD application whose product UI can be replaced completely without coupling it to ToubkalCAD implementation details.

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

## Document authority

The authoritative project state must be a serializable ASA-owned parametric document, not the current Three.js scene and not native WASM shape pointers.

Minimum structure:

```text
CadDocument
├── schemaVersion
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

## Upstream isolation

ToubkalCAD currently mixes UI, Zustand state, `window` globals, geometry services and an imperative event bus. ASA-CAD will not preserve that coupling as its public architecture.

The initial upstream import is a baseline implementation. M1 introduces adapters around its geometry, solver, picking and recompute behavior. New ASA UI work starts only after those adapters are established.

## Threading

Do not redesign threading in the first import. Preserve the known-working baseline first.

A later milestone may move expensive OpenCascade operations to a worker after profiling. This must be treated as a separate engineering change because Toubkal currently relies on synchronous shape access for picking and measurement.

## ASA Lab integration boundary

ASA-CAD stays standalone until its parametric workflow is stable.

Later ASA Lab integration supplies:

- authenticated actor/project context;
- project open/save/version operations;
- snapshots;
- classroom assignments;
- submission/version pinning.

ASA Lab must not know OpenCascade or Toubkal internals. It stores/returns the ASA-CAD document contract.

## Compatibility policy

Saved project compatibility is a hard boundary.

- New engine releases must open documents created by previous released ASA-CAD versions.
- Schema migrations are explicit and test-covered.
- Engine upgrades never rewrite a stored document silently on read.
- Every saved project records the document schema and ASA-CAD engine version that last wrote it.
