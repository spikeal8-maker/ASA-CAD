# ASA-CAD agent rules

Binding rules for automated coding agents.

## Read before ordinary changes

Read these entry points first:

1. `docs/STATUS.md` — current state, blocking gate, immediate next work;
2. `docs/SYSTEM_SPEC.md` — product/end-state invariants;
3. `docs/ARCHITECTURE.md` — dependency/runtime/persistence boundaries;
4. the GitHub issue for the active task.

If `STATUS.md` names a blocking gate, read that gate/issue before coding and do not start later feature work. Then use `docs/DOCS_POLICY.md` to open only the focused spec/registry needed for the subsystem. Do not preload the documentation tree.

## Product and dependency invariants

ASA-CAD is a browser-native engineering CAD and future ASA Lab module. Document kinds are Part, Assembly, Drawing, Fragment, Specification and Text.

Normal CAD geometry/solving runs on the active client. ASA Lab owns identity/classes/projects/persistence/versions/assignments/submissions/review; it is not the normal CAD-compute server.

Permanent direction:

```text
ASA UI
  -> typed command/view model + registries
  -> CadApplication / CadDocument
  -> ASA runtime adapters
  -> vendor-derived runtime / OpenCascade / solvers
```

Visible Toubkal UI is diagnostic/reference only.

## Hard prohibitions

- Do not rewrite the geometry kernel or make mesh data authoritative.
- Do not make product UI depend on raw OCC objects, `window.oc`, vendor stores/events/components.
- Do not persist WASM pointers, OCC/Three objects or transient face/edge ordinals.
- Do not silently resolve ambiguous topology references to a different subshape.
- Do not introduce normal server geometry/solver RPC.
- Do not auto-update `vendor/toubkal` on `main`.
- Do not break saved-document compatibility silently.
- Do not copy proprietary KOMPAS artwork/icons.
- Do not expose production controls without an implemented command.
- Do not invent command IDs/layout/mobile placement when registries already define them.
- Do not create a separate mobile command/document model or delegate mobile commands through desktop DOM clicks.
- Do not solve responsive layout with unreadable text or whole-app transforms that break picking.
- Do not bypass a blocking execution/maintenance gate.

## Vertical-slice pattern

Each permanent command is implemented end to end:

```text
typed ASA command/API
-> parameter/selection contract
-> registry/layout metadata
-> desktop/mobile presentation
-> deterministic fixture
-> focused regression
-> acceptance/status update
```

Desktop and mobile consume the same typed action model. The central work area owns global selection/navigation policy.

Direct Sketch tools must compose `SketchInteractionSurface`; tool layers own only tool state, ghost rendering and typed intent. They must not duplicate pointer/touch/pan/pinch/wheel policy.

## Code-size and ownership budgets

Bot-friendly code size is a required architecture property, not a style preference. `tests/process/file-budgets.mjs` is authoritative and runs in required CI.

Default targets for hand-written files:

| Kind | Target | Hard limit |
| --- | ---: | ---: |
| UI/controller `.ts/.tsx` | <= 10 KB | 20 KB |
| runtime/adapter `.ts` | <= 14 KB | 24 KB |
| command-handler `.ts` | <= 10 KB | 16 KB |
| domain CSS | <= 10 KB | 20 KB |
| M3 browser test | <= 8 KB | 14 KB |
| agent entry/status doc | <= 5 KB | 8 KB |
| focused narrative spec | <= 12 KB | 20 KB |

Machine registries, fixture datasets, vendor and lock/generated files are exempt.

Existing files above a target may be grandfathered only at the explicit byte ceiling in `file-budgets.mjs`. A grandfathered file may shrink but must never grow. When an extraction reduces it, lower the ceiling in the same PR.

Before adding responsibility to a file:
1. check its owner and budget;
2. if the responsibility is a new family, create/extend a focused owner;
3. if the target would be exceeded, extract first instead of increasing the ceiling;
4. never raise a grandfathered ceiling to make CI pass.

Expected ownership:
- document/runtime session -> controller/hook/service;
- Sketch editing -> focused Sketch controller/stage;
- Part features -> focused Part feature controller/runtime evaluator;
- selection -> focused selection controller;
- shell presentation -> shell component;
- Tree/Parameters -> focused panels;
- viewport interaction -> viewport/input modules;
- persistence -> `CadProjectHost` / session layer.

`App.tsx`, `usePartSketchWorkspace.ts`, `CadViewport.tsx`, `OpenCascadePartRuntime.ts`, `SketchCommandHandlers.ts` and monolithic CSS are ratcheted hotspots until maintenance issue #57 closes.

## Protected regressions

The protected Part workflow must remain green:

`Sketch 60x40 -> Extrude 10 -> diameter-12 through cut -> Fillet R1 -> edit 60 to 80 -> rebuild -> save -> reopen -> edit again`.

After M4A, protected Assembly becomes a second permanent gate.

## Run/test

Primary ASA development:

```bash
npm run install:vendor
npm run dev
```

Default ASA dev URL: `http://localhost:8090`.

Vendor diagnostic UI only:

```bash
npm run dev:vendor
```

Release-like test:

```bash
npm run docker:up
```

Default Docker URL: `http://localhost:8088`.

For every change run the cheapest affected tests first, then the required shell/browser/Docker/vendor gates named by the active issue.

## Change discipline

For every change:
1. read current status + active issue/gate;
2. change the narrowest owner;
3. preserve typed boundaries and saved-document compatibility;
4. add/update the smallest deterministic regression;
5. run affected gates;
6. update registry/spec only when behavior/contract changed;
7. when a milestone/gate changes state, update the issue and `docs/STATUS.md` in the same review change that establishes that state.

Do not use a later status-only PR as the normal workflow; it caused status drift. Historical issue comments may carry detailed logs, while `STATUS.md` stays short.

## PR discipline

A review branch is an artifact, not a transcript.

- One PR = one vertical slice or one focused maintenance concern.
- **Hard limit: 6 commits.** Rebuild/squash a noisy scratch branch before review.
- Remove one-shot codemod/review-fix scripts/workflows before review.
- If a repair crosses ownership boundaries, split the work.
- Relevant browser/Docker suites must be green before merge even when path-filtered.
- Close superseded branches/PRs/issues.
- Use `.github/PULL_REQUEST_TEMPLATE.md`.

## Upstream

Treat `vendor/toubkal` as implementation source, not product architecture. For upstream changes read `docs/UPSTREAM.md`, use a dedicated PR, record old/new SHA, port only useful runtime/kernel changes through ASA boundaries, preserve notices and run compatibility gates.

## Efficiency rule

Prefer typed boundaries, small owners, machine registries and deterministic tests over repository-wide refactors or duplicated prose. Current status belongs only in the active GitHub issue + `docs/STATUS.md`.
