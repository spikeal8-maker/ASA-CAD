# ASA-CAD agent rules

These rules are binding for automated coding agents working in this repository.

## Required reading before code changes

Read in this order:

1. `docs/SYSTEM_SPEC.md` — primary system/end-state contract.
2. `docs/ROADMAP.md` — implementation order/current milestone.
3. `docs/ARCHITECTURE.md` — dependency/runtime boundaries.
4. `docs/ASSEMBLIES.md` when touching Part/Assembly document semantics, component references or mates.
5. `docs/RUN_AND_DEPLOY.md` when touching Docker, runtime loading, browser headers or deployment.
6. `docs/ASA_LAB_INTEGRATION.md` when touching persistence/classroom/ASA Lab integration.
7. `docs/UPSTREAM.md` when touching `vendor/toubkal` or importing upstream changes.
8. the GitHub issue for the active milestone.

Do not reinterpret the product from scratch when these contracts already answer the question.

## Product intent

ASA-CAD is a browser-native parametric engineering CAD system and a future first-class ASA Lab module.

It has two required document modes:

- **Part / Деталь**;
- **Assembly / Сборка**.

The visible desktop workflow is ASA-owned and KOMPAS-oriented. Interactive Part/Assembly mathematics runs on the active learner device. ASA Lab owns identity, classes, projects, persistence, versions, assignments, submissions and teacher review; it is not a CAD compute server.

## Never do these

- Do not rewrite the geometry kernel from scratch.
- Do not replace authoritative exact B-Rep behavior with mesh-only approximations.
- Do not make ASA UI depend directly on `window.oc`, raw OCC objects, vendor Zustand layout, vendor events or vendor component paths.
- Do not store native WASM pointers or Three.js meshes in authoritative documents.
- Do not silently repair ambiguous Part topology references by choosing another subshape.
- Do not silently update Assembly occurrences to newer component drafts/versions.
- Do not introduce normal server endpoints such as `/compute`, `/boolean`, `/rebuild`, `/fillet`, `/solve` or `/assembly-solve` for learner CAD math.
- Do not bundle the CAD/WASM runtime into normal ASA Lab pages.
- Do not collapse the production deployment back into the main `asa-web` bundle without deliberate architecture revision.
- Do not require ASA Lab merely to run/test core ASA-CAD.
- Do not update Toubkal upstream automatically on `main`.
- Do not perform broad refactors while implementing one narrow CAD behavior.
- Do not begin broad KOMPAS UI replacement before M1 establishes ASA-owned `CadApplication`/`CadDocument` boundaries.
- Do not break saved-document compatibility silently.

## Architecture dependency direction

Allowed:

```text
ASA UI -> CadApplication/CadDocument -> ASA runtime adapters -> vendor/toubkal + kernel/solver
```

Production deployment:

```text
ASA Lab public origin
  /api/* -> asa-api
  /cad/* -> pinned asa-cad-web
  other  -> asa-web
```

The CAD container serves frontend/runtime assets only. Browser-side WASM performs CAD computation.

Forbidden:

```text
ui -> vendor/toubkal/services/*
ui -> window.oc
ui -> raw TopoDS_Shape
ASA Lab -> OpenCascade/Toubkal internals
vendor/toubkal -> ASA Lab
browser CAD command -> server geometry/assembly RPC
```

## Document rules

The public document family is:

```ts
type CadDocument = CadPartDocument | CadAssemblyDocument;
```

Part authority includes sketches/features/bodies/stable references.

Assembly authority includes occurrence identities, pinned component project versions, transforms and mates.

Runtime B-Rep and rendered meshes are derived caches.

Any schema change requires:

- explicit compatibility assessment;
- schema version increment when incompatible;
- migration or explicit compatibility handling;
- old-document fixture test;
- no silent rewrite of stored project data on read.

## Protected workflows

Part workflow must remain green:

`Sketch 60x40 -> Extrude 10 -> centered diameter-12 cut -> Fillet -> edit 60 to 80 -> recompute -> save -> close -> reopen -> edit again`

After M4A exists, Assembly workflow must also remain green:

`create Parts -> create Assembly -> insert occurrences -> fix base -> add mates -> solve -> save -> reopen -> explicitly update/replace component -> pin version -> reopen exact pinned version`

Tests verify parametric intent/identity/exact geometry where practical, not screenshots only.

## Current implementation order

The order in `docs/ROADMAP.md` is binding unless deliberately revised:

`M0 baseline + M0D Docker -> M1 ASA Part/Assembly document boundary -> M1B client runtime/container/host -> M2 KOMPAS shell -> M3 sketcher -> M4 Part Design -> M4A Assembly -> M4B release -> M5 ASA Lab integration -> M6 parity expansion`

Agents must not skip ahead by wiring product UI directly to vendor internals.

## Standalone/Docker rule

Core ASA-CAD must remain independently runnable.

Expected command:

```bash
docker compose up --build
```

Default local address:

```text
http://localhost:8088
```

Docker changes must keep the image frontend-only unless the primary system contract is deliberately changed.

CI must eventually prove image build, boot, health, browser startup and protected Part/Assembly E2E flows.

## Client-compute invariant

Normal sketch solving, Part feature construction, Assembly mate solving, booleans, recompute and tessellation execute in the browser on the active device.

Threading may evolve. Moving normal CAD math to the server is not an acceptable shortcut.

## Upstream changes

Treat `vendor/toubkal` as imported implementation source, not product architecture.

- Upstream sync happens in a dedicated branch/PR.
- Record exact source/target SHA.
- Inspect upstream changes by subsystem first.
- Normally ignore vendor UI changes.
- Port useful kernel/solver/recompute/picking/assembly fixes through ASA adapters.
- Never modify ASA product UI merely to follow an upstream internal rename.
- Keep upstream attribution/third-party notices intact.
- Run protected workflows and saved-document compatibility gates before accepting upstream-derived changes.

## UI work

The ASA UI owns command names, panel layout, workflow, selection prompts, confirmations, status feedback and error presentation.

Part and Assembly modes use the same ASA shell but different command groups/tree semantics.

The reference desktop shell is KOMPAS-oriented. Smaller screens may reorganize panels but use the same documents/commands.

Do not ship proprietary KOMPAS binaries/source/artwork; recreate required interaction/layout with ASA-owned implementation/assets.

## Change discipline

For every behavior change:

1. identify the narrow subsystem and roadmap milestone;
2. state which system invariant is affected;
3. add/update the smallest regression test;
4. preserve applicable protected workflows;
5. run typecheck/build/lint plus affected CAD tests;
6. for deployment changes, run Docker build/boot smoke;
7. record saved-document schema changes explicitly;
8. do not mix upstream import and product-feature changes in the same commit/PR;
9. do not widen scope because adjacent vendor code is inconvenient.

## Efficiency for coding agents

Inspect only files owned by the active milestone and the minimum vendor implementation needed for the adapter.

Avoid repository-wide discovery when ownership is already documented. Prefer narrow patches, typed boundaries and explicit tests over speculative refactors.
