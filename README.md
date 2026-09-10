# ASA-CAD

Browser-native parametric engineering CAD for ASA Lab, with an ASA-owned interface/workflow intentionally close to KOMPAS-3D.

CAD geometry/solving runs on the active client device. ASA Lab provides identity, classes, projects, versions, assignments and submissions; it is not the normal geometry-compute server.

## Start here

- **Current state / next work:** [`docs/STATUS.md`](docs/STATUS.md)
- **Product/end-state contract:** [`docs/SYSTEM_SPEC.md`](docs/SYSTEM_SPEC.md)
- **Technical boundaries:** [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md)
- **Implementation order:** [`docs/ROADMAP.md`](docs/ROADMAP.md)
- **Which other docs to read for a task:** [`docs/DOCS_POLICY.md`](docs/DOCS_POLICY.md)
- **Coding-agent rules:** [`AGENTS.md`](AGENTS.md)

Do not read the entire documentation tree before ordinary changes; use `DOCS_POLICY.md` for task-scoped context.

## Product model

One CAD product, six engineering document kinds:

```text
CadDocument
├── Деталь / Part
├── Сборка / Assembly
├── Чертеж / Drawing
├── Фрагмент / Fragment
├── Спецификация / Specification
└── Текстовый документ / Text
```

Permanent dependency direction:

```text
ASA desktop/mobile UI
        ↓
typed command/view model + UI registries
        ↓
CadApplication / CadDocument
        ↓
ASA runtime adapters
        ↓
OpenCascade / PlaneGCS / isolated vendor-derived services
```

Visible Toubkal UI is diagnostic/reference only. It is not the product surface.

## Run locally

First install pinned vendor dependencies:

```bash
npm run install:vendor
```

Run the **ASA product UI**:

```bash
npm run dev
```

Equivalent explicit command: `npm run dev:asa`.

Default standalone dev address: `http://localhost:8090`.

Run the old vendor diagnostic surface only when kernel/upstream comparison is needed:

```bash
npm run dev:vendor
```

Build the ASA product:

```bash
npm run build
```

Vendor-only build:

```bash
npm run build:vendor
```

Release-like Docker:

```bash
npm run docker:up
```

Open `http://localhost:8088`; stop with `npm run docker:down`.

## Test/check

ASA tests including the current M2 shell gate:

```bash
npm test
```

Full ASA + pinned vendor validation:

```bash
npm run check
```

Browser/Docker workflows provide the heavier real-Chromium protected Part, touch, responsive/DPI/zoom and release-route gates in CI.

## Stable review routes

Use deterministic routes when reviewing/correcting UI:

```text
/dev/part/empty
/dev/part/sketch
/dev/part/extrude
/dev/part/reference
/dev/part/rebuild-error
```

This is preferable to manually recreating a model for every visual change.

## Core rules

- Authoritative project data is serializable `CadDocument`, not STL/mesh/screenshot/OCC pointer.
- OpenCascade WASM loads lazily when B-Rep work is required.
- Product UI must not reach raw OCC objects or vendor UI/store internals.
- Desktop and mobile use the same command/document model; mobile must not click/query desktop DOM controls.
- Ambiguous topology references fail explicitly rather than silently selecting another subshape.
- `/cad/*` is designed as a separately versioned frontend container surface for later ASA Lab integration.
- New features are vertical slices: command/API → parameters/selection → runtime/document → registry/layout → desktop/mobile UI → fixture → regression.

For exact status, implemented features and remaining work, read [`docs/STATUS.md`](docs/STATUS.md).