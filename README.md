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

ASA-CAD currently starts from a pinned ToubkalCAD source baseline under `vendor/toubkal/` and reuses/hardens useful runtime layers such as:

- OpenCascade WebAssembly geometry;
- sketch solving;
- feature/recompute behavior;
- assembly behavior that proves reliable;
- exact B-Rep operations;
- tessellation/Three.js rendering;
- picking/measurement;
- proven exchange functionality.

The visible product UI is ASA-owned and must not be built directly on vendor UI/store internals.

Required dependency direction:

```text
ASA UI
  -> CadApplication / CadDocument
  -> ASA adapters/runtime
  -> vendor-derived implementation / OpenCascade / solvers
```

## Run it separately from ASA Lab

### Fast UI/development mode

Install once:

```bash
npm run install:vendor
```

Run:

```bash
npm run dev
```

Current imported baseline dev server:

```text
http://localhost:8080
```

This is the fast hot-reload loop for visual/layout work.

### Production-like Docker mode

```bash
npm run docker:up
```

or:

```bash
docker compose up --build
```

Open:

```text
http://localhost:8088
```

Stop:

```bash
npm run docker:down
```

The Docker container serves HTML/JS/CSS/WASM only. There is no CAD compute backend or own database; CAD calculations execute in the browser.

Docker build/boot/health/static-header smoke is already green in GitHub Actions. Real-browser protected workflow E2E remains part of M0D.

See [`docs/DEVELOPMENT_WORKFLOW.md`](docs/DEVELOPMENT_WORKFLOW.md) and [`docs/RUN_AND_DEPLOY.md`](docs/RUN_AND_DEPLOY.md).

## How visual correction will work

As the ASA-owned shell is implemented, deterministic development-only fixtures/routes will be added for exact states such as Part, Assembly context editing, Drawing, Specification, etc.

Target review loop:

```text
open exact dev URL
-> identify UI/behavior defect
-> agent edits ASA-owned UI source
-> hot reload
-> owner reviews
-> Docker/browser E2E before acceptance
```

The owner should not need ASA Lab/PostgreSQL or a Docker rebuild for every CSS/layout correction.

## Local-compute rule

Interactive CAD mathematics runs on the active client device:

- desktop/laptop -> that computer;
- tablet -> that tablet;
- supported phone -> that phone.

ASA Lab is persistence/education infrastructure, not a normal geometry-compute server.

## Saved project rule

The authoritative project is a serializable ASA `CadDocument`, not STL, screenshot, Three.js mesh or WASM shape pointer.

Exports are derived outputs. Formats/settings are defined in [`docs/FILES_SETTINGS_AND_EXPORT.md`](docs/FILES_SETTINGS_AND_EXPORT.md).

## Current implementation order

- **M0 ACTIVE** — pinned/reproducible runtime + protected Part CI fixture.
- **M0D ACTIVE** — standalone Docker; static build/boot checks green, browser E2E remains.
- **M1 NEXT** — six-kind `CadDocument` union + stable `CadApplication` boundary.
- **M1B** — standalone/ASA Lab host-container contract.
- **M2** — ASA-owned KOMPAS-oriented shell and six-kind new-document routing.
- **M2A** — stable demo routes/visual fixtures/owner review loop.
- **M3** — parametric sketcher.
- **M4** — Part Design + stable references.
- **M4A** — Assembly + mates + in-context component design.
- **M4B** — standalone beta/release hardening.
- **M5** — native ASA Lab integration via pinned `asa-cad-web` container.
- **M6** — shared 2D engine + Drawing + Fragment.
- **M6A** — Specification + Text documents.
- **M7** — broader KOMPAS parity/settings/exchange/templates.

See [`docs/ROADMAP.md`](docs/ROADMAP.md).

## Documentation map

- [`docs/SYSTEM_SPEC.md`](docs/SYSTEM_SPEC.md) — complete end-state/system contract.
- [`docs/DOCUMENT_TYPES.md`](docs/DOCUMENT_TYPES.md) — six document kinds and tool scopes.
- [`docs/ASSEMBLIES.md`](docs/ASSEMBLIES.md) — Assembly/in-context/version semantics.
- [`docs/FILES_SETTINGS_AND_EXPORT.md`](docs/FILES_SETTINGS_AND_EXPORT.md) — saving, formats, settings, appearance.
- [`docs/DEVELOPMENT_WORKFLOW.md`](docs/DEVELOPMENT_WORKFLOW.md) — how to run, inspect and correct UI separately.
- [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) — technical boundaries.
- [`docs/RUN_AND_DEPLOY.md`](docs/RUN_AND_DEPLOY.md) — Docker/production deployment.
- [`docs/ASA_LAB_INTEGRATION.md`](docs/ASA_LAB_INTEGRATION.md) — host/persistence/classroom integration.
- [`docs/ROADMAP.md`](docs/ROADMAP.md) — implementation order and gates.
- [`docs/UPSTREAM.md`](docs/UPSTREAM.md) — pinned upstream policy.
- [`AGENTS.md`](AGENTS.md) — binding coding-agent rules.
