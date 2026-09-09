# ASA-CAD

ASA-CAD is a browser-native parametric CAD module intended for later integration into ASA Lab.

## Product target

- Separate CAD module; it does not replace the current ASA Lab `three-d` editor.
- Browser-only execution: geometry is computed on the learner's computer.
- UI/workflows will be rebuilt to closely follow the educational workflow of KOMPAS-3D.
- Projects will later use ASA Lab identity, project storage, versions, assignments, and previews.

## Technical decision

ASA-CAD will start from **ToubkalCAD** as an upstream CAD implementation, not from a blank CAD editor.

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

This boundary is what allows us to replace the whole interface while still importing selected upstream CAD fixes later.

## Repository strategy

This repository is independent from `asa-lab` during CAD development.

1. Track ToubkalCAD as an explicit upstream source.
2. Import a pinned baseline.
3. Freeze baseline regression tests.
4. Extract the ASA-owned application/runtime boundary.
5. Rebuild UI on that boundary.
6. Integrate ASA-CAD into ASA Lab only after standalone CAD workflows are stable.

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

See `docs/ARCHITECTURE.md`, `docs/ROADMAP.md`, and `docs/UPSTREAM.md`.
