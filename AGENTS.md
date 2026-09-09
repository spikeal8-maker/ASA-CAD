# ASA-CAD agent rules

These rules are binding for automated coding agents working in this repository.

## Required reading before code changes

Read in this order:

1. `docs/SYSTEM_SPEC.md` — primary system/end-state contract.
2. `docs/ROADMAP.md` — implementation order/current milestone.
3. `docs/DOCUMENT_TYPES.md` — all six document kinds and their tool scopes.
4. `docs/ARCHITECTURE.md` — dependency/runtime boundaries.
5. `docs/DEVELOPMENT_WORKFLOW.md` when touching UI, demo routes or visual tests.
6. `docs/FILES_SETTINGS_AND_EXPORT.md` when touching save/import/export/settings/styles.
7. `docs/ASSEMBLIES.md` when touching Assembly/component references/mates/context editing.
8. `docs/RUN_AND_DEPLOY.md` when touching Docker/runtime/browser headers/deployment.
9. `docs/ASA_LAB_INTEGRATION.md` when touching persistence/classroom/ASA Lab integration.
10. `docs/UPSTREAM.md` when touching `vendor/toubkal` or importing upstream changes.
11. the GitHub issue for the active milestone.

Do not reinterpret the product from scratch when these contracts already answer the question.

## Product intent

ASA-CAD is one browser-native engineering CAD product and a future first-class ASA Lab module.

Required end-state document kinds:

- **Part / Деталь**;
- **Assembly / Сборка**;
- **Drawing / Чертеж**;
- **Fragment / Фрагмент**;
- **Specification / Спецификация**;
- **Text document / Текстовый документ**.

The visible desktop workflow is ASA-owned and KOMPAS-oriented. Interactive CAD mathematics runs on the active learner device. ASA Lab owns identity, classes, projects, persistence, versions, assignments, submissions and teacher review; it is not a CAD compute server.

## Never do these

- Do not rewrite the geometry kernel from scratch.
- Do not replace authoritative exact CAD behavior with mesh-only storage.
- Do not flatten Assembly into the only native project representation.
- Do not implement Drawing as only a screenshot or image export.
- Do not implement Specification as only a disconnected manually typed table.
- Do not build separate duplicated 2D engines for Drawing and Fragment.
- Do not make ASA UI depend directly on `window.oc`, raw OCC objects, vendor Zustand layout/store, vendor events or vendor component paths.
- Do not store native WASM pointers or Three.js meshes in authoritative documents.
- Do not silently repair ambiguous Part/Assembly/Drawing references by choosing another object.
- Do not silently update Assembly occurrences or other linked documents to newer drafts/versions.
- Do not introduce normal server endpoints such as `/compute`, `/boolean`, `/rebuild`, `/fillet`, `/solve` or `/assembly-solve` for learner CAD math.
- Do not bundle CAD/WASM into normal ASA Lab pages.
- Do not collapse production deployment back into the main `asa-web` bundle without deliberate architecture revision.
- Do not require ASA Lab merely to run/test core ASA-CAD.
- Do not update Toubkal upstream automatically on `main`.
- Do not begin broad permanent product UI wiring against vendor internals before M1 establishes ASA-owned `CadApplication`/`CadDocument` boundaries.
- Do not break saved-document compatibility silently.

## Architecture dependency direction

Allowed:

```text
ASA UI -> CadApplication/CadDocument -> ASA runtime/document adapters -> vendor-derived kernels/solvers
```

Production deployment:

```text
ASA Lab public origin
  /api/* -> asa-api
  /cad/* -> pinned asa-cad-web
  other  -> asa-web
```

The CAD container serves frontend/runtime assets only. Browser-side code performs CAD computation.

Forbidden:

```text
product UI -> vendor/toubkal UI/store/service internals
product UI -> window.oc / raw TopoDS_Shape
ASA Lab -> OpenCascade/Toubkal internals
browser CAD command -> server geometry/assembly RPC
```

## Document rules

The public target family is:

```ts
type CadDocument =
  | CadPartDocument
  | CadAssemblyDocument
  | CadDrawingDocument
  | CadFragmentDocument
  | CadSpecificationDocument
  | CadTextDocument;
```

Part authority includes sketches/features/bodies/stable references.
Assembly authority includes occurrence identities, pinned component versions, transforms, mates and contextual references.
Drawing authority includes sheets/2D objects/associative view definitions/model references.
Fragment authority includes reusable 2D geometry.
Specification authority includes structured product/BOM data and linked source versions.
Text authority includes structured page/document content and linked engineering documents.

Runtime B-Rep/render meshes are derived caches.

Any schema change requires explicit compatibility assessment, version/migration handling and old-document fixture coverage. Never silently rewrite stored project data on read.

## Protected workflows

Part workflow must remain green:

`Sketch 60x40 -> Extrude 10 -> centered diameter-12 cut -> Fillet -> edit 60 to 80 -> recompute -> save -> close -> reopen -> edit again`

After M4A exists, Assembly workflow must also remain green:

`create Parts -> create Assembly -> insert/create components -> fix base -> add mates -> context-edit a Part -> solve -> save -> reopen -> explicitly update/replace component -> pin version -> reopen exact pinned version`

Tests verify engineering intent/identity/geometry where practical, not screenshots only.

## Current implementation order

The order in `docs/ROADMAP.md` is binding unless deliberately revised:

`M0 baseline + M0D Docker -> M1 six-kind ASA document boundary -> M1B runtime/container/host -> M2 KOMPAS shell -> M2A demo/visual fixtures -> M3 sketcher -> M4 Part -> M4A Assembly -> M4B release -> M5 ASA Lab integration -> M6 Drawing/Fragment -> M6A Specification/Text -> M7 parity/settings/exchange`

Agents must not skip ahead by wiring product UI directly to vendor internals.

## Standalone and visual-review rule

Core ASA-CAD remains independently runnable.

Fast development:

```bash
npm run dev
```

Production-like standalone verification:

```bash
npm run docker:up
```

Default Docker address:

```text
http://localhost:8088
```

As M2/M2A is implemented, maintain deterministic development fixtures/routes for exact review states. Long-term visual corrections belong in ASA-owned components/design tokens, not repeated repainting of vendor UI.

## Client-compute invariant

Normal sketch solving, Part feature construction, Assembly mate solving, booleans, recompute, tessellation and model-to-drawing projection generation execute in the browser on the active device where applicable.

Threading may evolve. Moving normal CAD math to the server is not an acceptable shortcut.

## Save/import/export/settings rules

Native ASA documents remain authoritative. STEP/STL/PDF/SVG/DXF/XLSX/CSV and other outputs are exchange/derived formats.

Do not claim an imported/exported format preserves parametric history unless proven.

Keep user UI settings, engineering document settings and temporary view/session state separate.

See `docs/FILES_SETTINGS_AND_EXPORT.md`.

## Upstream changes

Treat `vendor/toubkal` as imported implementation source, not product architecture.

- Record exact source/target SHA.
- Inspect changes by subsystem first.
- Normally ignore vendor UI changes.
- Port useful runtime fixes through ASA adapters.
- Never modify ASA product UI merely to follow an upstream internal rename.
- Keep upstream attribution/third-party notices intact.
- Run protected workflows and saved-document compatibility before accepting upstream-derived changes.

## Change discipline

For every behavior change:

1. identify narrow subsystem and roadmap milestone;
2. state affected invariant;
3. add/update smallest regression test;
4. preserve applicable protected workflows;
5. run typecheck/build/lint plus affected CAD/browser tests;
6. for deployment changes, run Docker build/boot smoke;
7. record saved-document/export changes explicitly;
8. do not mix upstream import and product-feature changes in the same commit/PR;
9. do not widen scope because adjacent vendor code is inconvenient.

## Efficiency for coding agents

Inspect only files owned by the active milestone and the minimum vendor implementation needed for the adapter. Prefer narrow typed patches and explicit tests over speculative repository-wide refactors.
