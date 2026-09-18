# ASA-CAD agent rules

Binding rules for coding agents. Keep ordinary task context small and verify repository state before trusting chat/history.

## Mandatory entry protocol

Before changing code:
1. resolve current `main` HEAD and inspect open blocking audit/maintenance PRs;
2. read `docs/STATUS.md` and the active milestone issue;
3. if STATUS, issue, ROADMAP or an open blocking gate disagree, **stop feature work and repair state drift first**;
4. identify the narrowest owner, command ID/registry entry and focused regression for the requested change;
5. check that owner's target/frozen budget in `spec/process/repository-health.v1.json`.

Read `SYSTEM_SPEC.md` only when product/document behavior may change. Read `ARCHITECTURE.md` when dependency, runtime, persistence or ownership boundaries may change. Never preload the documentation tree.

## Tiny UI/change route

For a button, label, enablement or presentation fix, inspect in this order:
`command-registry -> CadUiAction binding -> desktop/mobile surface -> application command only if behavior changes`.

Do not create a second handler for another surface. Desktop/mobile/search must consume one typed action. A visual-only fix must not rewrite application/runtime code.

## Core invariants

```text
ASA UI
-> typed actions/registries
-> CadApplication / CadDocument
-> ASA runtime adapters
-> OpenCascade / solvers / isolated vendor-derived runtime
```

- CAD geometry/solving runs on the client; ASA Lab owns identity, projects, versions and learning workflow.
- Persist serializable ASA intent, never OCC/Three/WASM objects or transient subshape ordinals.
- Ambiguous topology references fail explicitly; never silently bind to another subshape.
- Product UI must not depend on raw OCC, `window.oc`, vendor stores/events/components.
- Desktop/mobile share the same command/document model.
- Saved-document compatibility requires explicit tested migration when changed.
- Do not auto-update `vendor/toubkal` or copy proprietary KOMPAS artwork/icons.

## Iteration-based maintenance

Optimization is triggered by **accepted iterations and owner pressure, never by calendar time**:
- every permanent slice -> Slice Quality Gate;
- if the same primary owner is touched by two accepted slices since its last focused review, review/decompose it before a third feature touch;
- at >=85% of a target budget, add no new responsibility family without extraction;
- frozen owners may not grow;
- every three accepted permanent slices, and every milestone boundary -> Full Repository Health Audit;
- an active audit/RED gate freezes feature work until accepted.

Machine policy is authoritative: `spec/process/repository-health.v1.json`. Milestone exit classification is in `spec/process/milestone-gates.v1.json`.

## Development loop

```text
scope/contract
-> smallest vertical slice
-> focused regression
-> Slice Quality Gate
-> cleanup/owner optimization when triggered
-> affected browser/Docker/compatibility gates
-> issue + STATUS + registry sync
-> next slice
```

A permanent command is not complete until applicable command/API, selection/parameters, document/runtime behavior, registry/UI, deterministic evidence, regression, save/reopen compatibility and health gate are complete.

## Completion and state sync

- One PR = one vertical slice or one focused maintenance concern.
- Update command registry whenever implementation status/command mapping changes.
- When phase/gate/next action changes, update active issue and `docs/STATUS.md` before another feature starts.
- If merge SHA/evidence can only be known after merge, the immediate next change is status-only closeout; no feature branch starts first.
- Do not create another summary/status document.
- Review branch target <=6 commits; remove one-shot tools, build output and temporary workflows before review.

Protected Part regression:
`Sketch 60x40 -> Extrude 10 -> Ø12 cut -> Fillet R1 -> 60→80 -> rebuild -> save/reopen -> edit again`.

Before broad M4: M3 exit, M2V, M3X, M3M-009 and the required Full Repository Health Audit must all be green/accepted.

Dev: `npm run install:vendor && npm run dev` at `http://localhost:8090`. Release-like: `npm run docker:up` at `http://localhost:8088`.
