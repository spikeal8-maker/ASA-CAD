# ASA-CAD agent rules

Binding rules for coding agents. Keep ordinary task context small.

## Start here

Before coding read:
1. `docs/STATUS.md` — current gate and next work;
2. the active GitHub issue;
3. only the focused sources/specs required by `docs/DOCS_POLICY.md`.

Read `SYSTEM_SPEC.md` when product/document behavior may change. Read `ARCHITECTURE.md` when dependency, runtime, persistence or ownership boundaries may change. Do **not** preload the documentation tree.

If `STATUS.md` names a blocking gate, do not start later work. For maintenance/audits use `docs/DEVELOPMENT_QUALITY_GATES.md` and `spec/process/repository-health.v1.json`.

## Core invariants

```text
ASA UI
-> typed actions/registries
-> CadApplication / CadDocument
-> ASA runtime adapters
-> OpenCascade / solvers / isolated vendor-derived runtime
```

- Normal CAD geometry/solving runs on the client; ASA Lab owns identity, projects, versions and learning workflow.
- Persist serializable ASA document intent, never OCC/Three/WASM objects or transient subshape ordinals.
- Ambiguous topology references fail explicitly; never silently bind to another subshape.
- Product UI must not depend on raw OCC, `window.oc`, vendor stores/events/components.
- Toubkal visible UI is diagnostic/reference only.
- Desktop/mobile share the same command/document model.
- Saved-document compatibility requires explicit migration when changed.
- Do not auto-update `vendor/toubkal`; use the upstream procedure.
- Do not copy proprietary KOMPAS artwork/icons.

## Development loop

```text
contract/scope
-> smallest vertical slice
-> focused regression
-> Slice Quality Gate
-> cleanup if required
-> affected browser/Docker/compatibility gates
-> issue + STATUS sync
-> next slice
```

Every three accepted slices and every milestone boundary require the Full Repository Health Audit. RED blocks feature work. YELLOW must be explicit, frozen/non-growing and have a cleanup gate.

A permanent command is not complete until applicable command/API, parameters/selection, document/runtime behavior, registry/UI, deterministic fixture, regression, save/reopen compatibility and health audit are complete.

## Ownership and size

Machine policy: `spec/process/repository-health.v1.json`.

- Check the owner/budget before adding responsibility.
- New responsibility family -> focused owner, not a larger god-object.
- Never raise a ceiling merely to pass CI.
- Frozen/grandfathered hotspots may only shrink; lower/remove the exception after extraction.
- Remove dead/duplicate paths and temporary/generated artifacts during audits.
- Do not create another status/spec summary when an existing source owns it.

Expected owners: Sketch editing; Sketch geometry/edit/constraint/dimension commands; Part features; selection; viewport input/camera/render; shell/panels; persistence/recovery; runtime adapters; shared test infrastructure.

Direct Sketch tools compose `SketchInteractionSurface`; tool layers own tool state, ghost rendering and typed intent only. Application history/Undo/Redo stays centralized.

## Protected behavior

Permanent Part regression:
`Sketch 60x40 -> Extrude 10 -> Ø12 through cut -> Fillet R1 -> 60→80 -> rebuild -> save/reopen -> edit again`.

After M4A, protected Assembly is a second permanent gate.

Before broad M4/M5, ASA-CAD and ASA Lab must prove their shared Project Core contract (`CadDocument`, load/save, `baseRevision`, `mutationId`, 409 conflicts, versions/session/linked docs).

## Change discipline

1. Change the narrowest owner.
2. Preserve typed boundaries and compatibility.
3. Add/update the smallest deterministic regression.
4. Run cheapest affected checks, then gates required by the issue.
5. Update contracts only when behavior changed.
6. When gate state changes, update the issue and `STATUS.md` in the same review change.

One PR = one vertical slice or focused maintenance concern; review branch hard limit is 6 commits. Remove one-shot tools before review. Use `.github/PULL_REQUEST_TEMPLATE.md`.

Primary dev: `npm run install:vendor && npm run dev` (`http://localhost:8090`). Vendor diagnostic: `npm run dev:vendor`. Release-like: `npm run docker:up` (`http://localhost:8088`).
