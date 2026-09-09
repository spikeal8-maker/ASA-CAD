# ASA-CAD

ASA-CAD is a browser-native parametric engineering CAD system being built as a future first-class module of ASA Lab.

## The target in one sentence

**Build an ASA-owned browser CAD whose desktop interface and modeling workflow are as close as practical to KOMPAS-3D for teaching, while all interactive CAD mathematics runs on the learner's own device and ASA Lab provides users, classes, projects, saving, versions and submissions.**

The complete source of truth is **[`docs/SYSTEM_SPEC.md`](docs/SYSTEM_SPEC.md)**.
The implementation order is **[`docs/ROADMAP.md`](docs/ROADMAP.md)**.

## Current state

ToubkalCAD is already imported as a pinned subtree under `vendor/toubkal/`.
The exact imported upstream commit is recorded in `UPSTREAM_BASELINE`.

The imported baseline currently passes in GitHub Actions:

- clean dependency install;
- TypeScript/build;
- lint;
- supported CAD regression suite.

Root commands:

```bash
npm run install:vendor
npm run dev
npm run build
npm run lint
npm test
npm run check
```

## What the finished system is

```text
ASA Lab
  |
  | learner opens moduleKey = cad
  v
ASA-CAD editor is lazy-loaded
  |
  v
ASA-owned KOMPAS-oriented UI
  |
  v
CadApplication + CadDocument
  |
  v
ASA runtime adapters
  |
  v
OpenCascade WASM + sketch solver + rendering
  |
  v
CAD calculations happen on this device
```

At the same time:

```text
CadDocument
   |
   | save/version/snapshot
   v
ASA Lab Project Core
   |
   +-- identity
   +-- classes
   +-- assignments/courses
   +-- projects
   +-- versions/checkpoints
   +-- submissions
   `-- teacher review
```

ASA Lab is **not** a geometry-compute server.

## Interface target

The visible ToubkalCAD UI is temporary and is not the product target.

ASA-CAD will implement its own desktop CAD interface with:

- document tabs/application commands;
- KOMPAS-oriented top command/ribbon organization;
- model/history tree;
- contextual parameter/task panel;
- central 3D viewport;
- sketch constraints and driving dimensions;
- confirm/cancel command lifecycle;
- status/constraint feedback;
- Russian engineering terminology aligned to the taught KOMPAS workflow.

We recreate the interface/workflow in ASA-CAD; we do not ship proprietary KOMPAS binaries, source code or protected artwork.

## Technical foundation

ASA-CAD starts from **ToubkalCAD** as a source baseline rather than writing CAD from zero.

Useful layers we keep/harden:

- OpenCascade WebAssembly geometry;
- sketch constraint solving;
- feature history and recomputation;
- exact B-Rep operations;
- shape/mesh conversion and picking;
- import/export support that proves reliable.

We do **not** build new product UI directly on Toubkal internals.

Mandatory boundary:

```text
ASA CAD UI
    |
    v
ASA CadApplication API
    |
    v
ASA runtime adapters
    |
    v
Toubkal-derived implementation / OpenCascade / solver
```

This is what lets ASA-CAD replace the whole visible interface and still selectively consume useful upstream fixes later.

## Local-compute rule

Interactive CAD mathematics runs on the active client:

- desktop/laptop -> that computer;
- tablet -> that tablet;
- supported phone -> that phone.

The heavy CAD JavaScript/WASM runtime loads only when a CAD project opens. It must not be part of normal ASA Lab startup and must not be downloaded by unrelated modules.

Unsupported devices fail clearly/read-only where possible; they do not silently switch to server-side CAD computation.

See [`docs/ASA_LAB_INTEGRATION.md`](docs/ASA_LAB_INTEGRATION.md).

## Saved project rule

The authoritative project is an ASA-owned serializable parametric `CadDocument`, not STL, not a screenshot, not Three.js meshes and not WASM shape pointers.

A project must preserve:

- sketches;
- constraints;
- driving dimensions;
- features/history;
- bodies;
- stable references;
- document/engine version information.

The same document must reopen and recompute on another supported device.

## First protected workflow

Every milestone must preserve this reference part:

1. create XY sketch;
2. rectangle 60 x 40 mm;
3. fully constrain it;
4. extrude 10 mm;
5. second sketch on top face;
6. centered diameter-12 circle;
7. through cut;
8. fillet;
9. edit original 60 mm dimension to 80 mm;
10. recompute downstream features;
11. save;
12. close/reopen;
13. edit again.

## Current implementation order

### M0 — ACTIVE

Finish the reproducible baseline by putting the protected reference workflow into CI.

### M1 — NEXT

Create ASA-owned `CadDocument` v1 + `CadApplication` API and run the protected workflow through that API only.

### M1B

Prove lazy client-side kernel loading, device capability checks and the ASA Lab host/persistence contract.

### M2

Replace the visible Toubkal shell with the ASA KOMPAS-oriented application shell.

### M3

Complete the parametric sketcher foundation.

### M4 / M4B

Complete Part Design features, stable references, compatibility and standalone release packaging.

### M5

Integrate the pinned ASA-CAD release as native `moduleKey = cad` inside ASA Lab.

### M6+

Expand KOMPAS-oriented teaching coverage and selectively consume safe upstream improvements.

See [`docs/ROADMAP.md`](docs/ROADMAP.md) for acceptance gates.

## Repository/update strategy

This repository remains independent from `asa-lab` during core CAD development.

The upstream Toubkal baseline is pinned. Do not auto-update it.

For upstream changes we selectively port useful geometry/solver/recompute fixes through ASA adapters and rerun the full regression/compatibility gates. Vendor UI changes are normally irrelevant.

See [`docs/UPSTREAM.md`](docs/UPSTREAM.md).

## Documentation map

- [`docs/SYSTEM_SPEC.md`](docs/SYSTEM_SPEC.md) — complete system/end-state contract.
- [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) — internal technical boundaries.
- [`docs/ASA_LAB_INTEGRATION.md`](docs/ASA_LAB_INTEGRATION.md) — ASA Lab host/runtime/persistence integration.
- [`docs/ROADMAP.md`](docs/ROADMAP.md) — implementation milestones and release gates.
- [`docs/UPSTREAM.md`](docs/UPSTREAM.md) — pinned upstream update procedure.
- [`docs/PRODUCT_TARGET.md`](docs/PRODUCT_TARGET.md) — concise product target.
- [`AGENTS.md`](AGENTS.md) — coding-agent rules.
