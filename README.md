# ASA-CAD

ASA-CAD is a browser-native parametric engineering CAD system being built as a first-class module of ASA Lab.

## Target

**Build our own KOMPAS-oriented browser CAD with two real document modes — `Деталь` and `Сборка` — while all CAD mathematics runs on the learner device and ASA Lab provides identity, classes, projects, saving, versions and submissions.**

Primary contract: [`docs/SYSTEM_SPEC.md`](docs/SYSTEM_SPEC.md)  
Implementation plan: [`docs/ROADMAP.md`](docs/ROADMAP.md)

## Current foundation

ToubkalCAD is imported and pinned under `vendor/toubkal/`. The imported baseline passes build, lint and its supported CAD regression suite.

We keep/harden useful runtime layers:

- OpenCascade WebAssembly;
- sketch solving;
- feature history/recompute;
- assembly runtime behavior that proves reliable;
- B-Rep/tessellation/picking;
- import/export.

The visible Toubkal UI is temporary. The product UI is ASA-owned and KOMPAS-oriented.

## Part and Assembly

One ASA module supports two saved document kinds:

```text
CadDocument
|- Part / Деталь
`- Assembly / Сборка
```

**Part** contains sketches, dimensions, features and bodies.

**Assembly** contains occurrences of Parts/subassemblies plus mates/constraints and pinned component versions.

See [`docs/ASSEMBLIES.md`](docs/ASSEMBLIES.md).

## Standalone launch

ASA-CAD is deliberately runnable without ASA Lab.

Current Docker launch:

```bash
docker compose up --build
```

Default address:

```text
http://localhost:8088
```

The container serves HTML/JS/WASM only. It has no CAD compute backend and no database. The browser downloads the WASM and performs calculations on that computer/tablet/phone.

See [`docs/RUN_AND_DEPLOY.md`](docs/RUN_AND_DEPLOY.md).

## Production ASA Lab deployment

ASA-CAD stays a separate versioned frontend Docker image:

```text
public ASA Lab origin
        |
        +---- /api/* -----> asa-api
        +---- /cad/* -----> asa-cad-web
        `---- other UI ---> asa-web
```

The user has one ASA Lab domain/session. No iframe and no second login.

Target module identity:

```text
moduleKey: cad
projectType: cad-document
editorRoute: /cad/projects/:projectId
viewerRoute: /cad/view/:versionId
```

The CAD container only serves the frontend/runtime. Geometry and assembly solving still happen in browser memory on the active device.

See [`docs/ASA_LAB_INTEGRATION.md`](docs/ASA_LAB_INTEGRATION.md).

## Mandatory internal boundary

```text
ASA KOMPAS-oriented UI
        |
        v
CadApplication / CadDocument
        |
        v
ASA runtime adapters
        |
        v
Toubkal-derived runtime / OpenCascade / solvers
```

Product UI must not depend directly on `window.oc`, raw OpenCascade objects, vendor Zustand structure or vendor UI components.

## Protected Part workflow

`Sketch 60x40 -> Extrude 10 -> centered diameter-12 cut -> Fillet -> edit 60 to 80 -> recompute -> save -> reopen`

## Protected Assembly workflow

After the Assembly milestone exists:

`create Parts -> create Assembly -> insert occurrences -> fix base -> add mates -> solve -> save -> reopen -> explicitly update/replace component -> pin version -> reopen exact pinned version`

## Implementation order

- **M0 ACTIVE** — finish protected Part baseline CI fixture.
- **M0D ACTIVE** — prove standalone Docker build/boot/browser smoke.
- **M1 NEXT** — ASA-owned `CadDocument` union + `CadApplication` API.
- **M1B** — client runtime + same-origin separate-container ASA Lab host contract.
- **M2** — replace Toubkal UI with ASA KOMPAS-oriented Part/Assembly shell.
- **M3** — parametric sketcher.
- **M4** — Part Design + stable topology references.
- **M4A** — Assembly + component version semantics + mates.
- **M4B** — stable standalone Docker release/package.
- **M5** — integrate pinned `asa-cad-web` image into ASA Lab under `/cad/*`.
- **M6+** — broader KOMPAS-oriented teaching coverage.

See [`docs/ROADMAP.md`](docs/ROADMAP.md).

## Developer commands

```bash
npm run install:vendor
npm run dev
npm run build
npm run lint
npm test
npm run check
```

Docker:

```bash
docker compose up --build
```

## Documentation

- [`docs/SYSTEM_SPEC.md`](docs/SYSTEM_SPEC.md) — primary system/product contract.
- [`docs/ROADMAP.md`](docs/ROADMAP.md) — execution order and gates.
- [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) — internal boundaries.
- [`docs/ASSEMBLIES.md`](docs/ASSEMBLIES.md) — Part/Assembly model.
- [`docs/RUN_AND_DEPLOY.md`](docs/RUN_AND_DEPLOY.md) — standalone run/test/Docker/production deployment.
- [`docs/ASA_LAB_INTEGRATION.md`](docs/ASA_LAB_INTEGRATION.md) — ASA Lab persistence/classroom/container integration.
- [`docs/UPSTREAM.md`](docs/UPSTREAM.md) — pinned upstream update policy.
- [`AGENTS.md`](AGENTS.md) — coding-agent rules.
