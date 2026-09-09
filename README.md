# ASA-CAD

ASA-CAD is a browser-native parametric CAD module intended for integration into ASA Lab.

## Current state

ToubkalCAD is already imported as a pinned subtree under `vendor/toubkal/`.
The exact imported upstream commit is recorded in `UPSTREAM_BASELINE`.
The imported baseline currently passes build, lint, and its supported CAD regression suite in GitHub Actions.

Root commands:

```bash
npm run install:vendor
npm run dev
npm run build
npm run lint
npm test
npm run check
```

## Product target

- Separate CAD module; it does not replace the current ASA Lab `three-d` editor.
- Browser-only execution: interactive CAD mathematics runs on the active learner device.
- Desktop UI/workflows are rebuilt to follow KOMPAS-3D teaching workflows as closely as practical.
- The same parametric document opens on supported desktop/tablet/phone devices.
- ASA Lab owns identity, classes, assignments, projects, versions, submissions and teacher review.
- ASA Lab is not a geometry-compute server.

See `docs/PRODUCT_TARGET.md`.

## Technical decision

ASA-CAD starts from **ToubkalCAD** as an upstream CAD implementation, not from a blank CAD editor.

We keep and harden the useful CAD layers:

- OpenCascade WebAssembly geometry operations;
- sketch constraint solving;
- feature history and recomputation;
- shape/mesh conversion and picking;
- import/export support.

We do **not** treat ToubkalCAD's current UI as product UI. The ASA-CAD UI will be replaced behind a stable internal API.

Upstream: https://github.com/ToubkalCAD/ToubkalCAD

## Non-negotiable architecture rule

UI code must never depend directly on ToubkalCAD internals such as Zustand store layout, `window.oc`, raw `CustomEvent` names, or `Occ*Service` classes.

All product UI must call a stable ASA-owned boundary:

```text
ASA CAD UI
    ↓
ASA CAD Application API
    ↓
CAD runtime adapters
    ↓
Toubkal/OpenCascade/solver implementation
```

When hosted by ASA Lab:

```text
ASA Lab project
    ↓ lazy-load
ASA-CAD editor + kernel
    ↓
geometry calculated in browser CPU/RAM

ASA-CAD CadDocument
    ↓ save/version
ASA Lab Project Core
```

The heavy CAD/WASM runtime must load only when a CAD project opens, not during normal ASA Lab startup.

See `docs/ASA_LAB_INTEGRATION.md`.

## Repository strategy

This repository is independent from `asa-lab` during CAD development.

1. Keep the pinned Toubkal baseline reproducible.
2. Freeze baseline regression tests.
3. Extract the ASA-owned application/runtime boundary.
4. Prove the client runtime + ASA Lab host contract.
5. Rebuild UI on that boundary.
6. Integrate a pinned ASA-CAD release into ASA Lab.

Do not auto-update from upstream. Every upstream update is reviewed, tested, and imported intentionally.

## First acceptance workflow

The first release gate is one complete parametric workflow:

1. Create an XY sketch.
2. Draw a rectangle.
3. Apply dimensions 60 × 40 mm.
4. Fully constrain it.
5. Extrude 10 mm.
6. Create a second sketch on the top face.
7. Add a centred Ø12 circle.
8. Cut through the part.
9. Add a fillet.
10. Edit the original 60 mm dimension to 80 mm.
11. Recompute downstream features correctly.
12. Save, close, reopen, and edit again.

No UI redesign is considered successful until this workflow remains green.

See `docs/ARCHITECTURE.md`, `docs/ROADMAP.md`, `docs/UPSTREAM.md`, `docs/PRODUCT_TARGET.md`, and `docs/ASA_LAB_INTEGRATION.md`.
