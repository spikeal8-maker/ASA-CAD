# ASA-CAD agent rules

These rules are binding for automated coding agents working in this repository.

## Required reading before code changes

Read in this order:

1. `docs/SYSTEM_SPEC.md` — primary system/end-state contract.
2. `docs/ROADMAP.md` — implementation order/current milestone.
3. `docs/ARCHITECTURE.md` — dependency/runtime boundaries.
4. `docs/UI_COMMAND_SPEC.md` — binding button/group/dropdown/parameter-panel and UI rollout contract.
5. `spec/ui/command-registry.v1.json` — stable machine-readable command IDs/labels/placement/milestones.
6. `spec/ui/layout-registry-v2-requirements.md` — required deterministic order/collapse/mobile metadata before M2 visual freeze.
7. `docs/WORKSPACE_INTERACTION_SPEC.md` — central 3D/2D work-area selection/navigation/preview/interaction contract.
8. `docs/SHORTCUTS_SPEC.md` — keyboard, focus and remappable-shortcut contract.
9. `docs/MOBILE_RESPONSIVE_SPEC.md` — tablet/phone layout, touch gestures and capability-tier contract.
10. `docs/DISPLAY_LAYOUT_SPEC.md` — HD/FHD/2K/4K/ultrawide, DPI, browser zoom, typography and panel-layout contract.
11. `spec/ui/viewport-matrix.v1.json` — required responsive/DPI/zoom regression matrix.
12. `docs/VISUAL_REFERENCE_SPEC.md` + `spec/ui/visual-reference-manifest.v1.json` — KOMPAS reference mapping and deliberate-difference contract.
13. `docs/M2_VISUAL_ACCEPTANCE.md` — final M2 visual acceptance gate.
14. `docs/DOCUMENT_TYPES.md` — six document kinds and document-specific tool scopes.
15. `docs/ASSEMBLIES.md` when touching Part/Assembly semantics, component references or mates.
16. `docs/RUN_AND_DEPLOY.md` when touching Docker, runtime loading, browser headers or deployment.
17. `docs/ASA_LAB_INTEGRATION.md` when touching persistence/classroom/ASA Lab integration.
18. `docs/UPSTREAM.md` when touching `vendor/toubkal` or importing upstream changes.
19. the GitHub issue for the active milestone.

Do not reinterpret the product from scratch when these contracts already answer the question.

## Product intent

ASA-CAD is a browser-native engineering CAD system and future first-class ASA Lab module.

The end-state product has six document kinds: Part / Деталь, Assembly / Сборка, Drawing / Чертеж, Fragment / Фрагмент, Specification / Спецификация, Text / Текстовый документ.

The visible desktop workflow is ASA-owned and KOMPAS-oriented. Interactive CAD mathematics runs on the active learner device. ASA Lab owns identity, classes, projects, persistence, versions, assignments, submissions and teacher review; it is not a CAD compute server.

## Never do these

- Do not rewrite the geometry kernel from scratch.
- Do not replace authoritative exact B-Rep behavior with mesh-only approximations.
- Do not make ASA UI depend directly on `window.oc`, raw OCC objects, vendor Zustand layout, vendor events or vendor component paths.
- Do not gradually repaint the vendor Toubkal shell and call it the final ASA product UI.
- Do not invent button labels/grouping/milestones when the UI specs/registries define them.
- Do not invent independent group order, collapse/overflow or mobile placement inside React components.
- Do not use raw physical screen resolution as the primary layout breakpoint; use effective CSS viewport width/height.
- Do not double-scale 4K after OS/browser DPI scaling.
- Do not solve narrow screens by shrinking all fonts/icons below readability floors.
- Do not stretch side panels/command groups indefinitely on 2K/4K/ultrawide; additional width belongs primarily to the work area.
- Do not apply a whole-app visual transform that desynchronizes 3D/2D pointer/picking coordinates.
- Do not declare visual completion from one Full-HD screenshot; required M2 viewport/DPI/zoom/mobile gates must pass.
- Do not copy proprietary KOMPAS icons/artwork; use ASA-owned vector assets.
- Do not invent viewport mouse/touch behavior inside feature components; use the centralized workspace interaction contract.
- Do not add ad-hoc global key handlers; shortcuts go through the centralized shortcut registry and respect text/browser focus.
- Do not make essential phone/tablet behavior depend on hover.
- Do not create a separate mobile document/command model.
- Do not hide an implemented desktop command on phone without a defined alternate discovery path.
- Do not expose production buttons that appear usable but execute no implemented command.
- Do not store native WASM pointers or Three.js meshes in authoritative documents.
- Do not silently repair ambiguous Part topology references by choosing another subshape.
- Do not silently update Assembly occurrences to newer component drafts/versions.
- Do not introduce normal server geometry/assembly solve endpoints for learner CAD math.
- Do not bundle CAD/WASM runtime into normal ASA Lab pages.
- Do not collapse production deployment back into main `asa-web` without deliberate architecture revision.
- Do not require ASA Lab merely to run/test core ASA-CAD.
- Do not update Toubkal upstream automatically on `main`.
- Do not perform broad refactors while implementing one narrow CAD behavior.
- Do not begin broad permanent KOMPAS UI wiring before M1 establishes ASA-owned `CadApplication`/`CadDocument` boundaries.
- Do not break saved-document compatibility silently.

## Architecture dependency direction

Allowed:

```text
ASA UI -> CommandRegistry/CadApplication/CadDocument -> ASA runtime adapters -> vendor/toubkal + kernel/solver
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

## UI implementation rule

The permanent product shell is new ASA-owned code. The visible Toubkal shell is a temporary diagnostic/reference surface until the protected Part workflow is migrated.

Implement UI commands as vertical slices:

1. stable ASA command/API;
2. parameter/selection contract;
3. command registry entry;
4. layout/mobile/reference metadata;
5. visible ASA control;
6. deterministic dev fixture;
7. behavior/browser/visual test;
8. mark command implemented.

Do not implement long-term visual corrections by continually editing `vendor/toubkal` components.

## Workspace/input/display rule

The central work area is a product subsystem, not a passive canvas.

- selection/preselection, typed picking, tree synchronization, orbit/pan/zoom and preview follow `WORKSPACE_INTERACTION_SPEC.md`;
- desktop keyboard input follows `SHORTCUTS_SPEC.md`;
- touch/responsive behavior follows `MOBILE_RESPONSIVE_SPEC.md`;
- display/DPI/zoom/panel geometry follows `DISPLAY_LAYOUT_SPEC.md`;
- required automated viewport cases come from `spec/ui/viewport-matrix.v1.json`;
- KOMPAS comparison follows `VISUAL_REFERENCE_SPEC.md`;
- command-specific code may request selection/input modes but must not redefine global semantics.

## M2 visual acceptance rule

M2 has coordinated subtracks:

- #15 M2A — deterministic fixtures/owner review;
- #17 M2I — workspace, keyboard, touch, mobile;
- #18 M2R — HD/FHD/2K/4K/DPI/zoom/UI Scale;
- #19 M2V — KOMPAS visual reference mapping/layout parity.

M2 may be functionally implemented while a subtrack is still open, but it cannot be declared **visual-complete** until `docs/M2_VISUAL_ACCEPTANCE.md` passes.

## Document rules

The public document family is:

```ts
type CadDocument =
  | CadPartDocument
  | CadAssemblyDocument
  | CadDrawingDocument
  | CadFragmentDocument
  | CadSpecificationDocument
  | CadTextDocument;
```

Part authority includes sketches/features/bodies/stable references. Assembly authority includes occurrence identities, pinned component versions, transforms and mates. Drawing/Fragment authority is structured 2D data, not screenshots. Specification authority is structured BOM data. Text authority is structured page content.

Runtime B-Rep and rendered meshes are derived caches. Schema changes require explicit compatibility handling and fixtures; stored project data must not be silently rewritten on read.

## Protected workflows

Part workflow must remain green:

`Sketch 60x40 -> Extrude 10 -> centered diameter-12 cut -> Fillet -> edit 60 to 80 -> recompute -> save -> close -> reopen -> edit again`

After M4A exists, Assembly workflow must also remain green:

`create Parts -> create Assembly -> insert/create occurrences -> fix base -> add mates -> context-edit Part -> solve -> save -> reopen -> explicitly update/replace component -> pin version -> reopen exact pinned version`

Tests verify parametric intent/identity/exact geometry where practical, not screenshots only.

## Current implementation order

`M0 baseline + M0D Docker -> M1 ASA document/application/command boundary + M1U inventory -> M1B client runtime/container/host -> M2 ASA KOMPAS shell + M2A/M2I/M2R/M2V gates -> M3 sketcher -> M4 Part Design -> M4A Assembly -> M4B release/device matrix -> M5 ASA Lab -> M6 Drawing/Fragment -> M6A Specification/Text -> M7 parity expansion`

Agents must not skip ahead by wiring product UI directly to vendor internals.

## Standalone/Docker rule

Core ASA-CAD remains independently runnable:

```bash
docker compose up --build
```

Default local address: `http://localhost:8088`.

Docker remains frontend-only unless the primary system contract is deliberately changed. CI progressively proves image build/boot and real-browser protected workflows.

## Client-compute invariant

Normal sketch solving, Part features, Assembly mate solving, booleans, recompute, tessellation and applicable 2D projection math execute in the browser on the active device. Moving normal CAD math to the server is not an acceptable shortcut.

## Upstream changes

Treat `vendor/toubkal` as imported implementation source, not product architecture. Upstream sync uses a dedicated branch/PR, exact SHAs, subsystem inspection, ASA adapters and protected regression/compatibility gates. Normally ignore vendor UI changes and keep attribution/notices intact.

## Change discipline

For every behavior change:

1. identify the narrow subsystem/milestone;
2. state affected invariant;
3. add/update the smallest regression;
4. preserve applicable protected workflows;
5. run typecheck/build/lint plus affected tests;
6. run Docker smoke for deployment changes;
7. run applicable viewport/interaction fixture for UI changes;
8. record schema changes explicitly;
9. do not mix upstream import with product-feature changes;
10. do not widen scope because adjacent vendor code is inconvenient.

## Efficiency for coding agents

Inspect only files owned by the active milestone and the minimum vendor implementation needed for the adapter. Prefer narrow patches, typed boundaries and explicit tests over speculative refactors.
