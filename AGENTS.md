# ASA-CAD agent rules

These rules are binding for automated coding agents working in this repository.

## Product intent

ASA-CAD is a browser-native parametric CAD application that will later integrate into ASA Lab. The visible workflow should be intentionally close to the selected educational KOMPAS-3D workflow, while the implementation remains ASA-owned and maintainable.

## Never do these

- Do not rewrite the geometry kernel.
- Do not replace exact B-Rep results with mesh-only approximations for CAD features.
- Do not make ASA UI depend directly on `window.oc`, raw OCC objects, Toubkal Zustand layout, or raw Toubkal event names.
- Do not store native WASM pointers or Three.js meshes in the authoritative document.
- Do not silently repair ambiguous edge/face references by choosing another subshape.
- Do not update Toubkal upstream automatically on `main`.
- Do not perform broad refactors while implementing one CAD operation.
- Do not redesign UI before the protected parametric reference workflow is green.

## Architecture dependency direction

Allowed:

```text
ui -> application -> runtime adapters -> vendor/toubkal + kernel/solver
```

Forbidden:

```text
ui -> vendor/toubkal/services/*
ui -> window.oc
ui -> raw TopoDS_Shape
vendor/toubkal -> ASA Lab
```

## Change discipline

For every behavior change:

1. identify the narrow subsystem;
2. add/update the smallest regression test;
3. preserve the reference parametric workflow;
4. run typecheck/build/lint plus affected CAD tests;
5. record any saved-document schema change explicitly;
6. do not mix upstream import and product-feature changes in the same commit/PR.

## Protected reference workflow

No change may break:

`Sketch 60×40 -> Extrude 10 -> Ø12 cut -> Fillet -> edit 60→80 -> recompute -> save -> reopen`

The test must verify intent and exact geometry where practical, not only screenshots.

## Upstream changes

Treat `vendor/toubkal` as imported implementation source.

- Upstream sync happens in a dedicated branch/PR.
- First inspect what changed upstream.
- Prefer porting useful fixes through the ASA adapter boundary.
- Never modify ASA product UI merely to follow an upstream internal rename.
- Keep upstream attribution and third-party notices intact.

## UI work

The ASA UI owns command names, panel layout, workflow, selection prompts, confirmations and error presentation.

UI components dispatch stable product commands. They never own B-Rep algorithms.

## Document rules

The serialized ASA `CadDocument` is authoritative for saved projects.

Runtime B-Rep and rendered meshes are derived.

Any schema change requires:
- schema version increment when incompatible;
- migration or explicit compatibility handling;
- old-document fixture test.

## Efficiency for coding agents

Before editing:
- read `README.md`;
- read `docs/ARCHITECTURE.md`;
- read the relevant roadmap milestone;
- inspect only the affected runtime/vendor files.

Avoid repository-wide discovery when the ownership boundary is already known. Prefer narrow patches and explicit tests over speculative refactors.
