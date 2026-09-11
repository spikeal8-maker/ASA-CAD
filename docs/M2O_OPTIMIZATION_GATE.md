# M2O — Architecture Optimization Gate

This was the **blocking execution checklist before M3 Parametric Sketch**.

**Status: DONE.** All blocking steps O1–O8 are implemented, regression-protected and green. M3 may start through the boundaries created here. Current product status belongs to [`STATUS.md`](STATUS.md); long-term architecture belongs to [`ARCHITECTURE.md`](ARCHITECTURE.md).

## Scope rule

M2O was intentionally not a repository-wide rewrite. It stopped when the minimum architecture needed for safe M3 growth was established while preserving the accepted Part/browser/Docker behavior.

Blocking classification:
- O1–O4: hard blockers — DONE;
- O5–O8: minimum structural blockers — DONE;
- O9/O11: non-blocking follow-up lanes;
- O10 repository protection — DONE after the blocking gate.

## Completed blocking work

### O1 — Architecture/document consistency — DONE

- mandatory docs/code agree on `part | assembly | drawing | fragment | specification | text`;
- current Part-focused exact-runtime maturity is documented separately;
- CI rejects regression.

### O2 — Command/layout registry integrity — DONE

- layout IDs resolve through the canonical command registry;
- stale aliases/duplicates are rejected;
- accepted M2 commands carry truthful status;
- registry integrity is CI-protected.

### O3 — Persistence boundary — DONE

Permanent path:

```text
App / UI command
  -> CadEditorPersistence
  -> CadProjectSession
  -> CadProjectHost
      -> LocalStorageCadProjectHost
      -> AsaLabCadProjectHost
```

The UI no longer owns localStorage/revision/recovery mechanics and protected save/reopen stays green.

### O4 — Shared typed UI action model — DONE

`CadUiAction` is the common presentation/action source for toolbar, search, command-backed shortcuts, Sketch/Part/View ribbon and mobile Tools. Mobile does not query/click desktop DOM.

### O5 — M3-critical UI ownership — DONE

- `DocumentTree` and `ParameterPanel` have focused presentation owners;
- `usePartSketchWorkspace` owns existing Part/Sketch command lifecycle without runtime/vendor/persistence imports;
- `App.tsx` reduced from about **62 KB to 30 KB**;
- size/architecture regressions prevent responsibilities from silently returning to root.

### O6 — Focused Sketch/Constraint/Dimension handlers — DONE

- current Sketch/Constraint/Dimension mutation + availability paths use typed handler dispatch;
- failures remain atomic;
- Undo/Redo/history/recompute stay centralized in `CadApplicationImpl`;
- M1/M2 command behavior remains protected.

### O7 — Strong Sketch contracts + semantic validation — DONE

- current persisted Sketch entities/constraints/dimensions use discriminated ASA DTOs;
- `CadSketch.support` is typed as origin plane or stable reference;
- schema-v1 wire representation remains compatible;
- PlaneGCS consumes typed DTOs and solved entities retain their discriminant;
- malformed shapes are rejected;
- semantic validation rejects duplicate/dangling/cross-Sketch entity/constraint/dimension references and missing StableRef Sketch supports;
- O7 tests run inside the mandatory M2O gate.

### Pre-M3 Sketch session / solver ownership — DONE

This emerged from the O7/O8 critical review and is now part of the accepted gate:

- explicit transient `activeSketchId` replaces implicit `latestSketch()` targeting;
- `SketchSession` invalidates stale active IDs and Tree selects a specific Sketch by ID;
- `SketchSolveSession` owns lazy solver lifecycle, transient preview, diagnostics, residual/iterations, explicit DoF availability and stale-result protection;
- solver preview cannot mutate `CadDocument` or bypass `CadApplication` history;
- current PlaneGCS reports `degreesOfFreedom: null` when rank/DoF is unavailable instead of inferring it from convergence.

### O8 — M3-critical viewport interaction decomposition — DONE

O8 was completed as three behavior-preserving slices:

1. **O8.1 Picking/selection**
   - raw Three ray hits become ASA `ViewportPickCandidate[]`;
   - semantic duplicates collapse, nearest targets rank deterministically and ambiguity is preserved;
   - body/command hover and selection have a Three-independent owner;
   - candidate model already contains a `sketch-entity` target kind for M3.

2. **O8.2 Camera/navigation**
   - Fit/front/back/top/bottom/left/right/isometric/pan/zoom policy is Three-independent;
   - `CadViewport` only adapts numeric camera state to Three/OrbitControls;
   - camera-only navigation remains independent from CAD recompute.

3. **O8.3 Sketch overlay seam**
   - `SketchOverlayModel` consumes persisted geometry or a matching successful solver preview;
   - `SketchOverlayLayer` is a separate SVG surface, not B-Rep `CadRenderModel`/Three geometry;
   - overlay is intentionally read-only and dormant until M3 owns Sketch interaction.

Full mouse/touch/picking/standard-view/UI-scale/browser-zoom/Docker/baseline regressions remain green.

---

# M3 entry gate — SATISFIED

- [x] O1 architecture/docs consistent;
- [x] O2 command/layout registries canonical and truthful;
- [x] O3 persistence goes through session/host boundary;
- [x] O4 permanent command presentation consumes shared typed actions;
- [x] O5 M3-critical UI ownership extracted and root substantially reduced;
- [x] O6 Sketch/Constraint/Dimension growth has focused handlers;
- [x] O7 Sketch contracts strongly typed and semantically validated;
- [x] explicit `activeSketchId` / SketchSession exists;
- [x] transient solve-cycle ownership is defined without bypassing Undo/Redo;
- [x] O8 selection/camera/preview can grow outside the monolithic viewport effect;
- [x] final protected Part + M1/M1B + M2 shell/browser/touch/responsive + Docker/vendor gates green.

M3 may now proceed.

---

# Non-blocking follow-up lanes

## O9 — ASA-owned dependency/toolchain direction — OPEN

New ASA-only dependencies should be root-owned. A full toolchain migration is not required before M3 while current pinned tooling remains reproducible.

## O10 — Repository branch protection / enforced PR checks — DONE

`main` is protected and verified through GitHub:
- pull request required before merge;
- admin enforcement enabled;
- required conversation resolution enabled;
- force-push and branch deletion disabled;
- required always-on checks: `shell-build`, `vendor-baseline`, `asa-m1`, `asa-m1b`.

Browser/Docker suites remain path-filtered, so they are not global branch-protection checks; affected CAD/UI PRs must still wait for those suites under the project development rules.

## O11 — M2 visual/KOMPAS acceptance — OPEN

Continue deterministic KOMPAS reference review in parallel. Final visual parity does not block M3 because the real Sketch workspace will change part of the visual surface.

## Execution discipline after M2O

For M3 and later:
1. preserve these ownership boundaries;
2. add one vertical command/application/interaction slice at a time;
3. persist changes only through `CadApplication` commands/history;
4. keep solver preview transient until explicitly committed;
5. keep Sketch overlay separate from B-Rep render data;
6. use `activeSketchId`, never implicit last-Sketch semantics;
7. keep protected browser/Docker/baseline gates green;
8. use short branch -> PR -> required checks -> merge; do not bypass protected `main`.

## Next action

Begin **M3 Parametric Sketch** by wiring the active `SketchSession` to `SketchSolveSession` and the dormant `SketchOverlayModel`, then introduce the first direct canvas Sketch interaction through the existing candidate/selection seam. Do not fold M3 interaction back into `App.tsx` or the B-Rep Three effect.
