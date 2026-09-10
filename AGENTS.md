# ASA-CAD agent rules

These rules are binding for automated coding agents working in this repository.

## Required reading before code changes

Read in this order:

1. `docs/SYSTEM_SPEC.md` — primary system/end-state contract.
2. `docs/ROADMAP.md` — implementation order/current milestone.
3. `docs/ARCHITECTURE.md` — dependency/runtime boundaries.
4. `docs/README_UI_SPECS.md` — UI-spec index and precedence.
5. `docs/UI_COMMAND_SPEC.md` — button/group/dropdown/parameter-panel contract.
6. `spec/ui/command-registry.v1.json` — stable product command IDs already admitted to implementation.
7. `spec/ui/kompas-command-inventory.v25.json` — maintained broader KOMPAS v25 functional inventory/classification.
8. `spec/ui/layout-registry.v2.json` — binding workspace/group order, collapse/overflow and mobile placement.
9. `docs/KOMPAS_SHELL_LAYOUT_SPEC.md` — binding default KOMPAS-oriented desktop shell composition.
10. `docs/WORKSPACE_INTERACTION_SPEC.md` — central work-area interaction.
11. `docs/SHORTCUTS_SPEC.md` — keyboard/remapping.
12. `docs/MOBILE_RESPONSIVE_SPEC.md` — phone/tablet/touch/hybrid behavior.
13. `docs/DISPLAY_LAYOUT_SPEC.md` + `spec/ui/viewport-matrix.v1.json` — HD/FHD/2K/4K/DPI/zoom/UI Scale.
14. `docs/VISUAL_REFERENCE_SPEC.md` + `spec/ui/visual-reference-manifest.v1.json` — reference mapping/visual acceptance.
15. `docs/DOCUMENT_TYPES.md` — six document kinds/tool scopes.
16. `docs/ASSEMBLIES.md` when touching Assembly.
17. `docs/RUN_AND_DEPLOY.md` for Docker/runtime/deployment.
18. `docs/ASA_LAB_INTEGRATION.md` for persistence/classroom/ASA integration.
19. `docs/UPSTREAM.md` for `vendor/toubkal`/upstream work.
20. the GitHub issue for the active milestone.

Do not reinterpret the product from scratch when these contracts already answer the question.

## Product intent

ASA-CAD is a browser-native engineering CAD system and future first-class ASA Lab module with six document kinds:

- Part / Деталь;
- Assembly / Сборка;
- Drawing / Чертеж;
- Fragment / Фрагмент;
- Specification / Спецификация;
- Text / Текстовый документ.

The visible workflow is ASA-owned and KOMPAS-oriented. Interactive CAD mathematics runs on the learner device. ASA Lab owns identity/classes/projects/persistence/versions/assignments/submissions/teacher review and is not a CAD compute server.

## Never do these

- Do not rewrite the geometry kernel from scratch.
- Do not replace authoritative exact B-Rep with mesh-only approximations.
- Do not make ASA UI depend directly on `window.oc`, raw OCC objects, vendor Zustand layout/events/component paths.
- Do not gradually repaint the visible Toubkal shell and call it the final product UI.
- Do not invent command names/group order/collapse behavior/mobile placement when the registries define them.
- Do not expose production controls that execute no implemented command.
- Do not copy proprietary KOMPAS icons/artwork; create ASA-owned vector assets.
- Do not invent viewport mouse/touch behavior inside individual features.
- Do not add ad-hoc global shortcut handlers.
- Do not require hover for essential phone/tablet behavior.
- Do not create a separate mobile document/command model.
- Do not decide responsive layout from physical resolution alone.
- Do not shrink normal text below the documented readability floor merely to fit a toolbar.
- Do not apply whole-app CSS scaling that breaks 3D/2D pointer coordinates.
- Do not store WASM pointers or Three.js meshes in authoritative documents.
- Do not silently repair ambiguous topology references by choosing another subshape.
- Do not silently update Assembly occurrences to newer component versions.
- Do not introduce normal server geometry/solver RPC endpoints.
- Do not bundle CAD/WASM into unrelated ASA Lab startup pages.
- Do not require ASA Lab to run/test core ASA-CAD.
- Do not update Toubkal upstream automatically on `main`.
- Do not break saved-document compatibility silently.

## Dependency direction

Allowed:

```text
ASA UI
  -> command/layout registries
  -> CadApplication / CadDocument
  -> ASA runtime adapters
  -> vendor-derived runtime / OpenCascade / solvers
```

Production routing:

```text
ASA Lab public origin
  /api/* -> asa-api
  /cad/* -> pinned asa-cad-web
  other  -> asa-web
```

The CAD container serves frontend/runtime assets only. Browser-side WASM performs CAD calculation.

## UI implementation rule

Permanent UI is new ASA-owned code. Toubkal visible UI remains a temporary diagnostic/reference surface until the protected Part workflow is migrated.

Implement each command as a vertical slice:

1. stable ASA command/API;
2. parameter/selection contract;
3. command registry entry;
4. layout/mobile metadata;
5. visible ASA control;
6. deterministic dev fixture;
7. behavior/browser/visual test;
8. mark implemented.

Product layout obeys `spec/ui/layout-registry.v2.json`. If an implementation requires a new command/group/layout behavior, update the registry/spec deliberately rather than hard-coding a local exception.

## KOMPAS inventory rule

`spec/ui/kompas-command-inventory.v25.json` is the maintained current-reference inventory, not the production command registry.

A KOMPAS command can remain `advanced` or explicitly out-of-scope. It becomes a visible ASA product command only after deliberate promotion into the ASA command/parameter/layout contracts and its roadmap milestone.

Future KOMPAS versions/application extensions may add inventory work; agents do not automatically chase upstream product UI changes during unrelated implementation.

## Workspace/input rule

- selection/preselection, typed picking, tree sync, orbit/pan/zoom and preview follow `WORKSPACE_INTERACTION_SPEC.md`;
- keyboard follows `SHORTCUTS_SPEC.md`;
- touch/mobile follows `MOBILE_RESPONSIVE_SPEC.md`;
- command-specific code can request modes but cannot redefine global input semantics;
- every interaction receives deterministic browser fixtures/tests when implemented.

## Display/visual acceptance rule

M2 is not visually complete because it renders at one resolution.

It must pass the applicable M2A/M2I/M2R/M2V gates, including:

- baseline 1920x1080 effective viewport;
- HD/small desktop;
- 2K/4K/HiDPI;
- ultrawide/short-height cases;
- browser zoom;
- phone/tablet portrait/landscape;
- KOMPAS reference-state mapping;
- owner screenshot comparison where exact installed-KOMPAS appearance is requested.

Extra 2K/4K space expands the work area first; panels/groups remain bounded.

## Document rules

Authoritative public family:

```ts
type CadDocument =
  | CadPartDocument
  | CadAssemblyDocument
  | CadDrawingDocument
  | CadFragmentDocument
  | CadSpecificationDocument
  | CadTextDocument;
```

Runtime B-Rep/meshes are derived caches. Schema changes require explicit compatibility assessment/migration/fixtures and must never silently rewrite stored projects on read.

## Protected workflows

Part:

`Sketch 60x40 -> Extrude 10 -> centered diameter-12 cut -> Fillet -> edit 60 to 80 -> recompute -> save -> close -> reopen -> edit again`

Assembly after M4A:

`create Parts -> create Assembly -> insert/create occurrences -> fix base -> add mates -> context-edit Part -> solve -> save -> reopen -> explicitly update/replace component -> pin version -> reopen exact pinned version`

## Current implementation order

`M0/M0D -> M1 -> M1B -> M2 program (M2/M2A/M2I/M2R/M2V) -> M3 -> M4 -> M4A -> M4B -> M5 -> M6 -> M6A -> M7+`

The KOMPAS v25 baseline inventory (M1U/#16) is complete and becomes a maintained reference lane rather than a blocker.

## Standalone/Docker rule

Core ASA-CAD must remain independently runnable:

```bash
docker compose up --build
```

Default standalone address:

```text
http://localhost:8088
```

CI progressively proves image build/boot and real-browser protected workflows.

## Upstream changes

Treat `vendor/toubkal` as imported implementation source, not product architecture.

- upstream sync in dedicated change/PR;
- record source/target SHA;
- inspect by subsystem;
- normally ignore vendor UI changes;
- port useful kernel/solver/recompute/picking/assembly fixes through ASA adapters;
- preserve attribution/notices;
- run protected/compatibility gates before acceptance.

## Change discipline

For every change:

1. identify active milestone/subsystem;
2. identify affected invariant;
3. update the narrowest relevant spec/registry if product contract changes;
4. add/update smallest regression test;
5. preserve protected workflows;
6. run build/lint/affected CAD tests;
7. run Docker smoke for deployment changes;
8. run relevant viewport/input/visual fixtures for UI changes;
9. record schema compatibility changes explicitly;
10. do not mix upstream import and product-feature changes in one commit/PR.

## Efficiency

Inspect files owned by the active milestone plus the minimum vendor code required for its adapter. Prefer typed boundaries, registries and explicit tests over repository-wide speculative refactors.
