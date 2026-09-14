# ASA-CAD agent rules

Binding rules for automated coding agents.

## Read before ordinary changes

Read these entry points first:

1. `docs/STATUS.md` — current state, blocking gate, immediate next work;
2. `docs/SYSTEM_SPEC.md` — product/end-state invariants;
3. `docs/ARCHITECTURE.md` — dependency/runtime/persistence boundaries;
4. the GitHub issue for the active task.

If `STATUS.md` names a blocking gate, read it before coding and do not start later feature work. Then use `docs/DOCS_POLICY.md` to open only the focused spec/registry needed for the subsystem. Do not preload the documentation tree.

`docs/DEVELOPMENT_QUALITY_GATES.md` is the binding audit/maintenance contract. Read it when a quality gate, maintenance task, budget warning, repository cleanup or cross-repository contract is involved.

## Product and dependency invariants

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
- Do not create a second mobile command/document model or delegate mobile actions through desktop DOM clicks.
- Do not bypass a blocking feature, maintenance, quality or integration gate.
- Do not raise a file ceiling merely to make CI pass.
- Do not leave temporary/generated/review artifacts tracked.

## Permanent development loop

Every permanent vertical slice follows:

```text
contract/scope
-> smallest end-to-end slice
-> focused regression
-> Slice Quality Gate
-> cleanup/refactor if required
-> affected browser/Docker/compatibility gates
-> issue + STATUS synchronization
-> next slice
```

Every three accepted slices and every milestone boundary also require the Full Repository Health Audit defined in `docs/DEVELOPMENT_QUALITY_GATES.md`.

A RED quality result blocks feature work. A YELLOW debt item must be explicit, frozen/non-growing and removed before the next milestone boundary.

## Vertical-slice pattern

Each permanent command is implemented end to end:

```text
typed ASA command/API
-> parameter/selection contract
-> document/runtime behavior
-> registry/layout metadata
-> desktop/mobile presentation
-> deterministic fixture
-> focused regression
-> save/reopen compatibility where applicable
-> repository-health audit
-> acceptance/status update
```

Desktop and mobile consume the same typed action model. Direct Sketch tools compose `SketchInteractionSurface`; tool layers own only tool state, ghost rendering and typed intent.

## Code size, ownership and repository health

`spec/process/repository-health.v1.json` is the machine-readable policy. Required CI uses `tests/process/file-budgets.mjs`, `tests/process/repository-hygiene.mjs` and `tests/process/pr-hygiene.mjs`.

Rules:

1. Check the owner and budget before adding responsibility.
2. New responsibility family -> focused owner; do not grow a god-object.
3. Files above target are review signals; hard-limit violations block merge.
4. Grandfathered hotspots may only shrink. Lower the frozen ceiling after extraction.
5. Byte budget is authoritative; line count is a secondary review signal.
6. Vendor, generated registries and deliberate fixture datasets are not ordinary handwritten-code budgets.
7. Remove dead/duplicate paths and obsolete temporary files during the required audit cycle.
8. Do not add another status/spec summary when an existing source of truth owns it.

Expected ownership:
- document/runtime session -> controller/service;
- Sketch editing -> focused Sketch controller/stage;
- Part features -> focused feature controller/runtime evaluator;
- selection -> focused selection controller;
- shell -> shell components;
- Tree/Parameters -> focused panels;
- viewport input/camera -> viewport modules;
- persistence/recovery -> `CadProjectHost` / session layer.

Current frozen hotspots include `App.tsx`, `CadViewport.tsx`, `OpenCascadePartRuntime.ts` and `SketchCommandHandlers.ts`; exact ceilings live only in the machine policy.

## Protected regressions

Permanent protected Part workflow:

`Sketch 60x40 -> Extrude 10 -> diameter-12 through cut -> Fillet R1 -> edit 60 to 80 -> rebuild -> save -> reopen -> edit again`.

After M4A, protected Assembly becomes a second permanent gate.

## ASA Lab contract preflight

Do not wait until M5 to discover Project Core incompatibility. Before broad M4 completion, maintain cross-repository compatibility evidence for project identity, `CadDocument` envelope/schema, load/save, `baseRevision`, `mutationId`, `409` conflicts, snapshots/versions, same-origin session and unsupported-version behavior.

M5 integration is blocked while this contract preflight is RED.

## Run/test

Primary ASA development:

```bash
npm run install:vendor
npm run dev
```

Default ASA dev URL: `http://localhost:8090`.

Vendor diagnostic UI only: `npm run dev:vendor`.

Release-like test:

```bash
npm run docker:up
```

Default Docker URL: `http://localhost:8088`.

For every change run the cheapest affected tests first, then the required shell/browser/Docker/vendor gates named by the active issue.

## Change and PR discipline

For every change:

1. read current status + active issue/gate;
2. change the narrowest owner;
3. preserve typed boundaries and saved-document compatibility;
4. add/update the smallest deterministic regression;
5. run affected quality/functional gates;
6. update registry/spec only when behavior/contract changed;
7. when milestone/gate state changes, update its issue and `docs/STATUS.md` in the same review change.

One PR = one vertical slice or one focused maintenance concern. Review branch hard limit is 6 commits. Remove one-shot tools before review. If a repair crosses ownership boundaries, split it or classify it explicitly as architecture/maintenance work.

Use `.github/PULL_REQUEST_TEMPLATE.md`. Close superseded branches/PRs/issues.

## Upstream

Treat `vendor/toubkal` as implementation source, not product architecture. For upstream changes read `docs/UPSTREAM.md`, use a dedicated PR, record old/new SHA, port only useful runtime/kernel changes through ASA boundaries, preserve notices and run compatibility gates.

## Efficiency rule

Prefer typed boundaries, small owners, machine registries and deterministic tests over repository-wide refactors or duplicated prose. Current status belongs only in the active GitHub issue + `docs/STATUS.md`.
