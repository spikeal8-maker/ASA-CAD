# ASA-CAD

ASA-CAD is a browser-native parametric engineering CAD system being built as a first-class module of ASA Lab.

## Target

Build an ASA-owned browser CAD whose desktop interface and engineering workflow are intentionally close to KOMPAS-3D for teaching transfer, while interactive CAD calculations run on the learner device and ASA Lab provides identity, classes, projects, saving, versions and submissions.

The complete product contract is [`docs/SYSTEM_SPEC.md`](docs/SYSTEM_SPEC.md). The current implementation order and accepted gates are in [`docs/ROADMAP.md`](docs/ROADMAP.md).

## Document system

ASA-CAD is one CAD product with six primary engineering document kinds:

```text
Создать
|- Деталь
|- Сборка
|- Чертеж
|- Фрагмент
|- Спецификация
`- Текстовый документ
```

The public document family is:

```text
CadDocument
|- CadPartDocument
|- CadAssemblyDocument
|- CadDrawingDocument
|- CadFragmentDocument
|- CadSpecificationDocument
`- CadTextDocument
```

See [`docs/DOCUMENT_TYPES.md`](docs/DOCUMENT_TYPES.md) and [`docs/ASSEMBLIES.md`](docs/ASSEMBLIES.md).

## Product/runtime boundary

ASA-CAD starts from a pinned ToubkalCAD source baseline under `vendor/toubkal/` and reuses isolated CAD runtime functionality such as OpenCascade WebAssembly, PlaneGCS, stable-reference helpers, tessellation and proven geometry services.

The permanent product UI is ASA-owned. Do not build new UI directly on Toubkal UI/store internals.

```text
ASA KOMPAS-oriented UI
        -> CadApplication / CadDocument
        -> ASA browser/runtime adapters
        -> vendor-derived implementation
        -> OpenCascade / PlaneGCS
```

Interactive geometry, sketch solving and rebuild run on the active client device. ASA Lab is persistence/education infrastructure, not a geometry-compute server.

## What already works

The core foundation is accepted:

- **M0 DONE** — pinned/reproducible vendor baseline and protected Part regression;
- **M0D DONE** — standalone/release Docker, deep `/cad/*` routes, COOP/COEP, lazy WASM and full browser protected-Part E2E;
- **M1 DONE** — six-kind `CadDocument`, `CadApplication`, undo/redo/rebuild, OpenCascade/PlaneGCS adapters, StableRef boundary, migrations and render/measurement contracts;
- **M1U DONE** — KOMPAS v25 command/UI inventory baseline;
- **M1B DONE** — client capability/lazy-runtime layer, standalone + ASA Lab `CadProjectHost`, IndexedDB recovery and `/cad/*` release contract.

The current **M2 ASA-owned shell** already drives a real protected Part workflow in Chromium:

```text
XY sketch
-> rectangle 60x40 + driving dimensions
-> Finish Sketch
-> Extrude 10
-> select top face -> StableRef
-> second sketch -> centered Ø12
-> through-all cut
-> select edge -> StableRef
-> Fillet R1
-> edit width 60 -> 80
-> downstream rebuild
-> save/reopen parametric document
-> edit reopened Ø12 -> Ø14
```

The saved document contains parametric history and durable StableRefs; transient face/edge ordinals and native OpenCascade objects do not enter persistence.

## UI/button contract

The KOMPAS-oriented interface is specified command-by-command in [`docs/UI_COMMAND_SPEC.md`](docs/UI_COMMAND_SPEC.md).

Machine-readable sources of truth:

- [`spec/ui/command-registry.v1.json`](spec/ui/command-registry.v1.json) — stable commands;
- [`spec/ui/layout-registry.v2.json`](spec/ui/layout-registry.v2.json) — workspace/group/order/collapse/mobile placement;
- [`spec/ui/kompas-command-inventory.v25.json`](spec/ui/kompas-command-inventory.v25.json) — KOMPAS v25 inventory/classification;
- [`spec/ui/visual-reference-manifest.v1.json`](spec/ui/visual-reference-manifest.v1.json) — visual reference mapping;
- [`spec/ui/viewport-matrix.v1.json`](spec/ui/viewport-matrix.v1.json) — required display/DPI/mobile cases.

We do **not** gradually repaint ToubkalCAD into the final product. The imported Toubkal UI is a diagnostic/reference surface only. Permanent UI is built as ASA components over `CadApplication`.

## Workspace, mouse and keyboard

The permanent ASA viewport currently supports:

- wheel zoom;
- middle-button pan;
- right-drag orbit;
- face/edge preselection for modeling commands;
- ordinary body selection synchronized Viewport ↔ Tree by stable ASA `bodyId`;
- Fit and front/back/top/bottom/left/right/isometric views;
- camera preservation across B-Rep rebuild;
- central keyboard resolver with focus safety.

Implemented shortcuts include Ctrl+S, Ctrl+Z, Ctrl+Y/Ctrl+Shift+Z, Esc, Ctrl+Enter, F5, Fit/orientation shortcuts and camera pan/zoom keys. Browser-critical shortcuts remain browser-owned.

Contracts:

- [`docs/WORKSPACE_INTERACTION_SPEC.md`](docs/WORKSPACE_INTERACTION_SPEC.md)
- [`docs/SHORTCUTS_SPEC.md`](docs/SHORTCUTS_SPEC.md)
- [`docs/MOBILE_RESPONSIVE_SPEC.md`](docs/MOBILE_RESPONSIVE_SPEC.md)

## HD/FHD/2K/4K, DPI and UI Scale

Display behavior is binding in [`docs/DISPLAY_LAYOUT_SPEC.md`](docs/DISPLAY_LAYOUT_SPEC.md).

Layout uses the **effective CSS viewport**, not raw physical monitor pixels. A 4K monitor at 200% OS scaling must not receive a second automatic ×2 ASA scaling pass.

Primary baseline:

```text
1920x1080 effective CSS viewport
UI Scale 100%
```

Regression coverage includes HD, 1366x768, 1536x864, FHD, 2K, ultrawide, 4K, effective 4K at 150%/200% OS scaling, short-wide displays, portrait/landscape tablets, hybrid input and phones down to 360x640.

ASA UI Scale is implemented as tokenized chrome/layout scaling:

```text
Auto | 90% | 100% | 110% | 125% | 150%
```

It does not transform CAD geometry or model coordinates. A visible Settings surface is available on desktop and phone. Browser-zoom regression is modeled through the effective CSS viewport + DPR contract that the application actually observes.

Tracking: #18 M2R.

## Deterministic review pages

The ASA shell can be reviewed separately from ASA Lab using stable Part fixtures:

```text
/dev/part/empty
/dev/part/sketch
/dev/part/extrude
/dev/part/reference
/dev/part/rebuild-error
```

These states are browser-tested. They are the preferred review surface for requests such as “change this panel/button/spacing” because the state is reproducible.

M2A remains open until reference screenshots and owner visual review are completed.

## Run ASA-CAD separately from ASA Lab

### First install

```bash
npm run install:vendor
```

### Main ASA development shell

```bash
npm run dev:asa
```

Open the address printed by the ASA dev server (normally `http://localhost:8080`). This is the UI you should inspect and correct.

### Vendor diagnostic baseline only

```bash
npm run dev
```

This starts the imported Toubkal diagnostic/reference surface. It is **not** the permanent ASA-CAD product UI.

### Production-like Docker

```bash
npm run docker:up
# or: docker compose up --build
```

Open:

```text
http://localhost:8088
```

Stop with:

```bash
npm run docker:down
```

The release container serves HTML/JS/CSS/WASM only. There is no CAD compute backend/database. Full protected Part browser E2E in the release container is already accepted.

See [`docs/DEVELOPMENT_WORKFLOW.md`](docs/DEVELOPMENT_WORKFLOW.md) and [`docs/RUN_AND_DEPLOY.md`](docs/RUN_AND_DEPLOY.md).

## Future ASA Lab deployment

Production target:

```text
asa-lab.ru/*       -> ASA Lab web
asa-lab.ru/api/*   -> ASA Lab API
asa-lab.ru/cad/*   -> pinned asa-cad-web container
```

The same `CadDocument` is saved through ASA Lab Project Core/classes/assignments/version workflows. CAD JS/WASM is loaded only when a CAD route is opened. Actual ASA Lab deployment remains M5; the host/runtime contract was prepared in M1B.

See [`docs/ASA_LAB_INTEGRATION.md`](docs/ASA_LAB_INTEGRATION.md).

## Saved project and export rule

The authoritative project is a serializable ASA `CadDocument`, not STL, a screenshot, a Three.js mesh or a WASM shape pointer. STEP/STL/PDF/SVG/DXF/etc. are derived exchange/export artifacts according to document type.

See [`docs/FILES_SETTINGS_AND_EXPORT.md`](docs/FILES_SETTINGS_AND_EXPORT.md).

## Current implementation program

- **Gate A — ASA CAD Core: DONE.** M0 + M0D + M1 + M1U + M1B.
- **M2 — ACTIVE.** Permanent ASA-owned KOMPAS-oriented shell; protected Part functional slice accepted.
- **M2A #15 — ACTIVE.** Technical deterministic Part fixtures ready; screenshot/owner visual acceptance remains.
- **M2I #17 — ACTIVE.** Mouse/navigation/views/shortcuts/ordinary selection accepted; multi-select, touch/mobile interaction and richer selection remain.
- **M2R #18 — ACTIVE.** Responsive/UI Scale/DPI/browser-zoom implementation is being stabilized through one all-green browser gate.
- **M2V #19 — ACTIVE.** KOMPAS reference baseline exists; ASA screenshot comparison/owner visual acceptance remains.
- **M3 — NEXT FEATURE LANE.** Complete first-wave parametric Sketch editor.
- **M4.** Broader Part Design + stable-reference diagnostics.
- **M4A.** Assembly + mates + in-context component design.
- **M4B.** Standalone beta/release hardening.
- **M5.** ASA Lab deployment/integration.
- **M6/M6A.** Drawing/Fragment then Specification/Text.
- **M7+.** Broader KOMPAS parity/settings/exchange/templates.

Do not treat M2 as visually complete until applicable M2A/M2I/M2R/M2V gates pass.

## Documentation map

Start with [`docs/README_UI_SPECS.md`](docs/README_UI_SPECS.md) for the UI specification index.

Core documents:

- [`docs/SYSTEM_SPEC.md`](docs/SYSTEM_SPEC.md) — end-state/system contract;
- [`docs/DOCUMENT_TYPES.md`](docs/DOCUMENT_TYPES.md) — document kinds/tool scopes;
- [`docs/UI_COMMAND_SPEC.md`](docs/UI_COMMAND_SPEC.md) — buttons/dropdowns/parameter panels/rollout;
- [`docs/WORKSPACE_INTERACTION_SPEC.md`](docs/WORKSPACE_INTERACTION_SPEC.md) — engineering work area;
- [`docs/SHORTCUTS_SPEC.md`](docs/SHORTCUTS_SPEC.md) — keyboard;
- [`docs/MOBILE_RESPONSIVE_SPEC.md`](docs/MOBILE_RESPONSIVE_SPEC.md) — phone/tablet;
- [`docs/DISPLAY_LAYOUT_SPEC.md`](docs/DISPLAY_LAYOUT_SPEC.md) — display/DPI/zoom/layout;
- [`docs/VISUAL_REFERENCE_SPEC.md`](docs/VISUAL_REFERENCE_SPEC.md) — KOMPAS reference process;
- [`docs/M2_VISUAL_ACCEPTANCE.md`](docs/M2_VISUAL_ACCEPTANCE.md) — M2 visual acceptance;
- [`docs/TZ_CRITICAL_AUDIT.md`](docs/TZ_CRITICAL_AUDIT.md) — critical specification audit;
- [`docs/ASSEMBLIES.md`](docs/ASSEMBLIES.md) — Assembly/in-context/version semantics;
- [`docs/FILES_SETTINGS_AND_EXPORT.md`](docs/FILES_SETTINGS_AND_EXPORT.md) — saving/formats/settings;
- [`docs/DEVELOPMENT_WORKFLOW.md`](docs/DEVELOPMENT_WORKFLOW.md) — standalone visual correction workflow;
- [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) — technical boundaries;
- [`docs/RUN_AND_DEPLOY.md`](docs/RUN_AND_DEPLOY.md) — Docker/deployment;
- [`docs/ASA_LAB_INTEGRATION.md`](docs/ASA_LAB_INTEGRATION.md) — host/classroom integration;
- [`docs/ROADMAP.md`](docs/ROADMAP.md) — current implementation order/gates;
- [`docs/UPSTREAM.md`](docs/UPSTREAM.md) — pinned upstream policy;
- [`AGENTS.md`](AGENTS.md) — binding coding-agent rules.
