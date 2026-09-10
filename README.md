# ASA-CAD

ASA-CAD is a browser-native parametric engineering CAD system being built as a first-class module of ASA Lab.

## Target

Build an ASA-owned browser CAD whose desktop interface and engineering workflow are intentionally close to KOMPAS-3D for teaching transfer, while interactive CAD calculations run on the learner device and ASA Lab provides identity, classes, projects, saving, versions and submissions.

The complete contract is [`docs/SYSTEM_SPEC.md`](docs/SYSTEM_SPEC.md).

## Document system

ASA-CAD end state includes six primary engineering document kinds:

```text
Создать
|- Деталь
|- Сборка
|- Чертеж
|- Фрагмент
|- Спецификация
`- Текстовый документ
```

They are one product/module, not six unrelated applications.

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

See [`docs/DOCUMENT_TYPES.md`](docs/DOCUMENT_TYPES.md).

## UI/button contract

The KOMPAS-oriented interface is specified command-by-command in [`docs/UI_COMMAND_SPEC.md`](docs/UI_COMMAND_SPEC.md).

That contract defines application shell regions, workspace tabs, first-wave buttons/groups/dropdowns, Russian labels, context/enabling rules, parameter-panel lifecycle, milestone placement and vendor-shell retirement rules.

A machine-readable initial command registry lives at [`spec/ui/command-registry.v1.json`](spec/ui/command-registry.v1.json). Before M2 visual freeze it evolves to include the deterministic order/collapse/mobile metadata defined in [`spec/ui/layout-registry-v2-requirements.md`](spec/ui/layout-registry-v2-requirements.md).

### UI implementation strategy

We **do not** gradually repaint ToubkalCAD into the final product.

The imported Toubkal UI remains a temporary diagnostic/reference surface until the protected Part workflow works through the ASA shell. The permanent UI is built from scratch as reusable ASA components over `CadApplication`.

Rollout is vertical-slice based:

```text
ASA command/API
-> parameter/selection contract
-> command/layout metadata
-> visible ASA control
-> deterministic demo fixture
-> browser/visual regression
-> mark implemented
```

Production must not contain clickable controls that do nothing.

## Work area, keyboard and touch

The central working surface is specified separately from toolbar buttons:

- [`docs/WORKSPACE_INTERACTION_SPEC.md`](docs/WORKSPACE_INTERACTION_SPEC.md) — 3D/2D selection, preselection, typed picking, tree synchronization, orbit/pan/zoom, previews and command interaction;
- [`docs/SHORTCUTS_SPEC.md`](docs/SHORTCUTS_SPEC.md) — centralized keyboard behavior/remapping/focus safety;
- [`docs/MOBILE_RESPONSIVE_SPEC.md`](docs/MOBILE_RESPONSIVE_SPEC.md) — phone/tablet/touch/hybrid-input shell and gestures.

The same `CadDocument` and stable command IDs are used on desktop, tablet and phone. Mobile re-composes the shell; it is not a separate CAD model.

## Display, HD/FHD/2K/4K and scaling

Display behavior is a binding product contract in [`docs/DISPLAY_LAYOUT_SPEC.md`](docs/DISPLAY_LAYOUT_SPEC.md).

Key rule: **layout uses effective CSS viewport width and height, not raw physical monitor resolution**. A 4K screen at 200% OS scaling is treated approximately like a Full-HD effective workspace and must not be enlarged a second time merely because the physical panel is 3840x2160.

Primary visual baseline:

```text
1920x1080 effective CSS viewport
UI Scale 100%
```

Required regression includes:

- 1280x720;
- 1366x768;
- 1536x864;
- 1920x1080;
- 2560x1440;
- 3440x1440 ultrawide;
- 3840x2160 effective;
- representative 4K at 150% and 200% OS scaling;
- browser zoom 100/125/150/200%;
- tablet/phone portrait/landscape and hybrid input.

Machine-readable cases: [`spec/ui/viewport-matrix.v1.json`](spec/ui/viewport-matrix.v1.json).

ASA provides its own UI Scale preference. Extra 2K/4K space primarily expands the engineering work area; tree/parameter panels and command groups remain bounded. The UI must collapse/overflow commands before shrinking text below readability floors.

## KOMPAS visual reference and acceptance

"KOMPAS-oriented" is not accepted from one subjective screenshot.

[`docs/VISUAL_REFERENCE_SPEC.md`](docs/VISUAL_REFERENCE_SPEC.md) defines a reference manifest: every major shell/workspace/active-command state maps to an official KOMPAS v25 reference or owner-provided screenshot, records the state/resolution/scale where known, maps to an ASA deterministic fixture and documents deliberate differences.

Scaffold: [`spec/ui/visual-reference-manifest.v1.json`](spec/ui/visual-reference-manifest.v1.json).

M2 final visual acceptance is defined by [`docs/M2_VISUAL_ACCEPTANCE.md`](docs/M2_VISUAL_ACCEPTANCE.md). Critical gaps found by the audit are documented in [`docs/TZ_CRITICAL_AUDIT.md`](docs/TZ_CRITICAL_AUDIT.md).

## What Part and Assembly mean

**Деталь / Part** owns one component's parametric construction history: sketches, constraints, dimensions, features and bodies.

**Сборка / Assembly** owns occurrences of Parts/subassemblies, component states and mates. It supports both inserting finished components and creating/editing Parts/subassemblies in the context of the Assembly.

See [`docs/ASSEMBLIES.md`](docs/ASSEMBLIES.md).

## Drawing/documentation direction

**Чертеж / Drawing** is a structured multi-sheet 2D engineering document with associative views from Part/Assembly, dimensions and annotations. It is not a viewport screenshot.

**Фрагмент / Fragment** is reusable/draft 2D geometry without required sheet framing/title block and shares the 2D drafting engine with Drawing.

**Спецификация / Specification** is structured product/BOM data linked to Assembly/Drawing.

**Текстовый документ / Text** is page-based engineering documentation linked to other project documents.

## Technical foundation

ASA-CAD starts from a pinned ToubkalCAD source baseline under `vendor/toubkal/` and reuses/hardens useful runtime layers such as OpenCascade WebAssembly geometry, sketch solving, feature/recompute behavior, assembly behavior that proves reliable, exact B-Rep operations, tessellation/Three.js rendering, picking/measurement and proven exchange functionality.

The visible product UI is ASA-owned and must not be built directly on vendor UI/store internals.

```text
ASA UI
  -> CadApplication / CadDocument
  -> ASA adapters/runtime
  -> vendor-derived implementation / OpenCascade / solvers
```

## Run it separately from ASA Lab

Fast UI/development mode:

```bash
npm run install:vendor
npm run dev
```

Current imported baseline dev server: `http://localhost:8080`.

Production-like Docker mode:

```bash
npm run docker:up
# or docker compose up --build
```

Open `http://localhost:8088` and stop with:

```bash
npm run docker:down
```

The Docker container serves HTML/JS/CSS/WASM only. There is no CAD compute backend or own database; CAD calculations execute in the browser.

Docker build/boot/health/static-header smoke is already green in GitHub Actions. Real-browser protected workflow E2E remains part of M0D.

See [`docs/DEVELOPMENT_WORKFLOW.md`](docs/DEVELOPMENT_WORKFLOW.md) and [`docs/RUN_AND_DEPLOY.md`](docs/RUN_AND_DEPLOY.md).

## How visual correction will work

As the ASA-owned shell is implemented, deterministic development-only fixtures/routes will be added for exact states.

```text
open exact dev URL
-> identify UI/behavior defect
-> agent edits ASA-owned UI source
-> hot reload
-> owner reviews
-> viewport/DPI/touch regression
-> Docker/browser E2E before acceptance
```

The owner should not need ASA Lab/PostgreSQL or a Docker rebuild for every CSS/layout correction.

## Local-compute rule

Interactive CAD mathematics runs on the active client device: desktop/laptop -> that computer; tablet -> that tablet; supported phone -> that phone. ASA Lab is persistence/education infrastructure, not a normal geometry-compute server.

## Saved project rule

The authoritative project is a serializable ASA `CadDocument`, not STL, screenshot, Three.js mesh or WASM shape pointer. Exports are derived outputs. Formats/settings are defined in [`docs/FILES_SETTINGS_AND_EXPORT.md`](docs/FILES_SETTINGS_AND_EXPORT.md).

## Current implementation order

- **M0 ACTIVE** — pinned/reproducible runtime + protected Part CI fixture.
- **M0D ACTIVE** — standalone Docker; static build/boot checks green, browser E2E remains.
- **M1 NEXT** — six-kind `CadDocument` + stable `CadApplication` + stable command IDs.
- **M1U** — complete KOMPAS v25 command/UI inventory and parity classification.
- **M1B** — standalone/ASA Lab host-container contract.
- **M2** — new ASA-owned KOMPAS shell; first working Part vertical slice.
- **M2A** — stable demo routes/visual fixtures/owner review loop.
- **M2I** — workspace interaction, keyboard, touch, responsive mobile/hybrid shell (#17).
- **M2R** — HD/FHD/2K/4K/DPI/browser zoom/UI Scale acceptance (#18).
- **M2V** — KOMPAS visual reference mapping/exact composition (#19).
- **M3** — complete first-wave parametric sketcher.
- **M4** — Part Design + stable references.
- **M4A** — Assembly + mates + in-context component design.
- **M4B** — standalone beta/release hardening.
- **M5** — ASA Lab integration via pinned `asa-cad-web` container.
- **M6** — shared 2D engine + Drawing + Fragment.
- **M6A** — Specification + Text documents.
- **M7** — broader KOMPAS parity/settings/exchange/templates.

M2 is not visually complete until its applicable M2A/M2I/M2R/M2V gates pass.

## Documentation map

Start with [`docs/README_UI_SPECS.md`](docs/README_UI_SPECS.md) for the UI-spec index.

Core documents:

- [`docs/SYSTEM_SPEC.md`](docs/SYSTEM_SPEC.md) — complete end-state/system contract.
- [`docs/DOCUMENT_TYPES.md`](docs/DOCUMENT_TYPES.md) — six document kinds and tool scopes.
- [`docs/UI_COMMAND_SPEC.md`](docs/UI_COMMAND_SPEC.md) — button-by-button UI, dropdowns, parameter panels and rollout order.
- [`docs/WORKSPACE_INTERACTION_SPEC.md`](docs/WORKSPACE_INTERACTION_SPEC.md) — engineering work area.
- [`docs/SHORTCUTS_SPEC.md`](docs/SHORTCUTS_SPEC.md) — keyboard.
- [`docs/MOBILE_RESPONSIVE_SPEC.md`](docs/MOBILE_RESPONSIVE_SPEC.md) — phone/tablet.
- [`docs/DISPLAY_LAYOUT_SPEC.md`](docs/DISPLAY_LAYOUT_SPEC.md) — display/DPI/zoom/layout geometry.
- [`docs/VISUAL_REFERENCE_SPEC.md`](docs/VISUAL_REFERENCE_SPEC.md) — KOMPAS reference process.
- [`docs/M2_VISUAL_ACCEPTANCE.md`](docs/M2_VISUAL_ACCEPTANCE.md) — M2 acceptance.
- [`docs/TZ_CRITICAL_AUDIT.md`](docs/TZ_CRITICAL_AUDIT.md) — critical audit and remaining gaps.
- [`docs/ASSEMBLIES.md`](docs/ASSEMBLIES.md) — Assembly/in-context/version semantics.
- [`docs/FILES_SETTINGS_AND_EXPORT.md`](docs/FILES_SETTINGS_AND_EXPORT.md) — saving, formats, settings, appearance.
- [`docs/DEVELOPMENT_WORKFLOW.md`](docs/DEVELOPMENT_WORKFLOW.md) — run/inspect/correct UI separately.
- [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) — technical boundaries.
- [`docs/RUN_AND_DEPLOY.md`](docs/RUN_AND_DEPLOY.md) — Docker/production deployment.
- [`docs/ASA_LAB_INTEGRATION.md`](docs/ASA_LAB_INTEGRATION.md) — host/persistence/classroom integration.
- [`docs/ROADMAP.md`](docs/ROADMAP.md) — implementation order and gates.
- [`docs/UPSTREAM.md`](docs/UPSTREAM.md) — pinned upstream policy.
- [`AGENTS.md`](AGENTS.md) — binding coding-agent rules.
