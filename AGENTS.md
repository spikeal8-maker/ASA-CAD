# ASA-CAD agent rules

Binding rules for automated coding agents.

## Read before ordinary changes

Read only these four entry points first:

1. `docs/STATUS.md` — current implementation state and immediate next work;
2. `docs/SYSTEM_SPEC.md` — product/end-state invariants;
3. `docs/ARCHITECTURE.md` — dependency/runtime/persistence boundaries;
4. the GitHub issue for the active task.

Then use `docs/DOCS_POLICY.md` to open **only** the focused specification/registry required by the subsystem being changed.

Do not preload the whole documentation tree. Do not reinterpret the product from scratch.

## Product invariants

ASA-CAD is a browser-native engineering CAD system and future ASA Lab module.

Document family:
- Part / Деталь;
- Assembly / Сборка;
- Drawing / Чертеж;
- Fragment / Фрагмент;
- Specification / Спецификация;
- Text / Текстовый документ.

Interactive CAD mathematics runs on the active client device. ASA Lab owns identity/classes/projects/persistence/versions/assignments/submissions/teacher review and is not a normal CAD-compute server.

Permanent product UI is ASA-owned and KOMPAS-oriented. Visible Toubkal UI is diagnostic/reference only.

## Dependency direction

Allowed:

```text
ASA UI
  -> typed command/view model + UI registries
  -> CadApplication / CadDocument
  -> ASA runtime adapters
  -> vendor-derived runtime / OpenCascade / solvers
```

Do not reverse this direction.

## Hard prohibitions

- Do not rewrite the geometry kernel from scratch.
- Do not replace exact B-Rep with mesh-only authoritative data.
- Do not make product UI depend on `window.oc`, raw OCC objects, vendor Zustand/events/components.
- Do not persist WASM pointers, OCC objects, Three.js meshes or transient face/edge ordinals.
- Do not silently resolve ambiguous topology references to another subshape.
- Do not introduce normal server geometry/solver RPC.
- Do not bundle/load CAD WASM on unrelated ASA Lab pages.
- Do not auto-update `vendor/toubkal` on `main`.
- Do not break saved-document compatibility silently.
- Do not copy proprietary KOMPAS artwork/icons.
- Do not expose production controls with no implemented command.
- Do not invent command IDs/layout/mobile placement when registries already define them.
- Do not create a separate mobile document/command model.
- Do not implement mobile commands by querying/clicking desktop DOM controls.
- Do not solve responsive layout by shrinking text below documented floors or by whole-app transforms that break picking.
- Do not hide an implemented desktop command on phone without a defined mobile discovery path.

## UI implementation pattern

Each permanent command is a vertical slice:

```text
stable ASA command/API
-> parameter/selection contract
-> command registry
-> layout/mobile metadata
-> desktop/mobile presentation
-> deterministic fixture
-> browser regression
-> acceptance/status update
```

Desktop and mobile presentations must consume the same typed command/action model. They may render differently but may not delegate through DOM clicks.

The central work area owns global selection/navigation semantics. Feature-specific code may request a selection mode but may not redefine mouse/touch/keyboard behavior locally.

## Code-size / ownership rule

Do not grow `src/web/App.tsx` into a god-object.

Before adding a new responsibility, choose an owner:
- document/runtime session -> controller/hook/service;
- command lifecycle -> command controller/action model;
- desktop shell -> desktop component;
- mobile shell -> mobile component;
- Tree/Parameters -> focused panel components;
- viewport interaction -> viewport/input modules;
- persistence -> `CadProjectHost` / session layer.

A change that adds a new feature family should normally add/extend a focused module rather than another large block in `App.tsx`.

## Protected regression

Part protected workflow must remain green:

`Sketch 60x40 -> Extrude 10 -> centered diameter-12 cut -> Fillet R1 -> edit 60 to 80 -> downstream recompute -> save -> reopen -> edit again`

After M4A, protected Assembly workflow becomes a second permanent gate.

## Standalone/runtime rule

Primary ASA dev UI:

```bash
npm run install:vendor
npm run dev
```

`npm run dev:asa` is an explicit alias for the same ASA product shell. Default dev address: `http://localhost:8090`.

Vendor/Toubkal diagnostic UI is explicit:

```bash
npm run dev:vendor
```

Default `npm run build` builds ASA-CAD; use `npm run build:vendor` only for vendor validation.

Release-like test:

```bash
npm run docker:up
```

Default Docker address: `http://localhost:8088`.

The release image serves frontend/WASM assets only. Browser-side runtime performs CAD calculations.

## Change discipline

For every change:
1. identify active issue/subsystem;
2. read only its focused contract via `DOCS_POLICY.md`;
3. change the narrowest owner/module;
4. update registry/spec only if behavior/contract changed;
5. add/update the smallest deterministic regression;
6. preserve protected workflows;
7. run affected type/build/browser/Docker gates;
8. update the issue + `docs/STATUS.md` when status/gate changes.

Do not mix upstream import work with product-feature changes.

## Upstream

Treat `vendor/toubkal` as implementation source, not product architecture.

When upstream work is actually required:
- read `docs/UPSTREAM.md`;
- use a dedicated change/PR;
- record old/new upstream SHA;
- normally ignore vendor UI changes;
- port only useful kernel/solver/recompute/picking/assembly changes through ASA boundaries;
- preserve attribution/notices;
- run protected/compatibility gates.

## Efficiency rule

Prefer typed boundaries, small modules, machine registries and deterministic tests over repository-wide refactors or duplicated prose. Current status is owned by `docs/STATUS.md` + GitHub issues; do not copy status into additional summary documents.