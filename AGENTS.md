# ASA-CAD agent rules

These rules are binding for automated coding agents working in this repository.

## Required reading before code changes

Read in this order:

1. `docs/SYSTEM_SPEC.md` — system/end-state contract.
2. `docs/ROADMAP.md` — implementation order and current milestone.
3. `docs/ARCHITECTURE.md` — dependency/runtime boundaries.
4. `docs/ASA_LAB_INTEGRATION.md` when touching runtime delivery, persistence or host integration.
5. `docs/UPSTREAM.md` when touching `vendor/toubkal` or importing upstream changes.
6. the GitHub issue for the milestone being implemented.

Do not reinterpret the product from scratch when these contracts already answer the question.

## Product intent

ASA-CAD is a browser-native parametric engineering CAD application that becomes a first-class ASA Lab module.

The visible desktop workflow should be intentionally close to the selected educational KOMPAS-3D workflow, while the implementation remains ASA-owned and maintainable.

Interactive CAD mathematics must execute on the active learner device. ASA Lab provides identity, classes, projects, persistence, versions, assignments, submissions and teacher review; it is not a normal CAD compute server.

## Never do these

- Do not rewrite the geometry kernel from scratch.
- Do not replace exact B-Rep results with mesh-only approximations for authoritative CAD features.
- Do not make ASA UI depend directly on `window.oc`, raw OCC objects, Toubkal Zustand layout, raw Toubkal event names, or vendor component paths.
- Do not store native WASM pointers or Three.js meshes in the authoritative document.
- Do not silently repair ambiguous edge/face references by choosing another subshape.
- Do not introduce normal server endpoints such as `/compute`, `/boolean`, `/rebuild`, `/fillet` or `/solve` to perform learner CAD mathematics.
- Do not make the heavy CAD/WASM runtime part of normal ASA Lab startup.
- Do not update Toubkal upstream automatically on `main`.
- Do not perform broad refactors while implementing one CAD operation.
- Do not begin broad KOMPAS UI replacement before M1 establishes the ASA-owned `CadApplication`/`CadDocument` boundary.
- Do not break saved-document compatibility silently.

## Architecture dependency direction

Allowed:

```text
ASA UI -> CadApplication/CadDocument -> runtime adapters -> vendor/toubkal + kernel/solver
```

When hosted:

```text
ASA Lab host -> ASA-CAD public editor/viewer/host interfaces
ASA-CAD runtime -> local browser kernel
CadDocument -> ASA Lab project/version APIs
```

Forbidden:

```text
ui -> vendor/toubkal/services/*
ui -> window.oc
ui -> raw TopoDS_Shape
ASA Lab -> OpenCascade/Toubkal internals
vendor/toubkal -> ASA Lab
browser CAD command -> server geometry RPC
```

## Change discipline

For every behavior change:

1. identify the narrow subsystem and roadmap milestone;
2. state which system invariant is affected;
3. add/update the smallest regression test;
4. preserve the protected parametric reference workflow;
5. run typecheck/build/lint plus affected CAD tests;
6. record any saved-document schema change explicitly;
7. do not mix upstream import and product-feature changes in the same commit/PR;
8. do not widen scope because adjacent vendor code looks inconvenient.

## Protected reference workflow

No change may break:

`Sketch 60x40 -> Extrude 10 -> centered diameter-12 cut -> Fillet -> edit 60 to 80 -> recompute -> save -> close -> reopen -> edit again`

The test must verify parametric intent and exact geometry where practical, not only screenshots.

## Current implementation order

The order in `docs/ROADMAP.md` is binding unless deliberately revised:

`M0 baseline -> M1 ASA boundary -> M1B client runtime/host -> M2 KOMPAS shell -> M3 sketcher -> M4 Part Design/stable refs -> M4B release -> M5 ASA Lab integration -> M6 parity expansion`

Agents must not skip ahead by wiring product UI directly to vendor internals as a shortcut.

## Client-compute invariant

Normal sketch solving, feature construction, booleans, recompute, tessellation and related CAD math execute in the browser on the active device.

The exact threading implementation may evolve, but moving normal geometry computation to the server is not an acceptable shortcut.

Kernel/WASM assets must be lazy-loaded only for CAD and must remain behind the ASA runtime loader.

## Upstream changes

Treat `vendor/toubkal` as imported implementation source, not product architecture.

- Upstream sync happens in a dedicated branch/PR.
- Record exact source/target SHA.
- First inspect what changed upstream by subsystem.
- Normally ignore vendor UI changes.
- Prefer porting useful kernel/solver/recompute/picking fixes through the ASA adapter boundary.
- Never modify ASA product UI merely to follow an upstream internal rename.
- Keep upstream attribution and third-party notices intact.
- Run protected workflow and saved-document compatibility gates before accepting an upstream-derived change.

## UI work

The ASA UI owns command names, panel layout, workflow, selection prompts, confirmations, status feedback and error presentation.

UI components dispatch stable ASA product commands. They never own B-Rep algorithms.

The reference desktop shell is KOMPAS-oriented. Smaller screens may reorganize panels but must use the same document and command model.

Do not ship proprietary KOMPAS binaries/source/artwork; recreate the required interaction/layout with ASA-owned implementation/assets.

## Document rules

The serialized ASA `CadDocument` is authoritative for saved projects.

Runtime B-Rep and rendered meshes are derived caches.

Any schema change requires:

- explicit compatibility assessment;
- schema version increment when incompatible;
- migration or explicit compatibility handling;
- old-document fixture test;
- no silent rewrite of stored project data on read.

## Efficiency for coding agents

Before editing, inspect only the files owned by the active milestone and the minimum vendor implementation needed to understand the adapter.

Avoid repository-wide discovery when the ownership boundary is already documented. Prefer narrow patches, typed boundaries and explicit tests over speculative refactors.
