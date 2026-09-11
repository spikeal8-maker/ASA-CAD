# ASA-CAD current status

This file is the **single short current-state entry point** for humans and coding agents. Product/end-state intent belongs to [`SYSTEM_SPEC.md`](SYSTEM_SPEC.md); implementation order belongs to [`ROADMAP.md`](ROADMAP.md).

Last synchronized: 2026-09-12.

## Current phase

**Gate A — ASA CAD Core: DONE.**

Completed foundation:
- M0 imported/pinned CAD baseline;
- M0D standalone/release Docker browser surface;
- M1 ASA-owned `CadDocument` / `CadApplication` / command/runtime boundary;
- M1U KOMPAS v25 command inventory baseline;
- M1B lazy client runtime, recovery and ASA Lab host contract.

**M2O — Architecture Optimization Gate (#21): DONE.**

All blocking O1–O8 acceptance gates are green. **M3 Parametric Sketch is no longer blocked by M2O.** M2 visual/interaction lanes may continue in parallel where they do not conflict with the active Sketch work.

Tracking:
- #3 M2 core shell — ACTIVE;
- #15 M2A deterministic fixtures/visual review — ACTIVE;
- #17 M2I interaction/mobile — ACTIVE;
- #18 M2R display/DPI/zoom/UI Scale — DONE;
- #19 M2V KOMPAS visual acceptance — ACTIVE;
- #21 M2O architecture optimization — DONE / closeout.

## M2O result

The pre-M3 structural debt identified by the critical audit is now addressed and CI-protected:

- **O1** — mandatory architecture/docs agree on all six document kinds;
- **O2** — command/layout registries use canonical IDs and truthful implemented status;
- **O3** — Save/Open flows through `CadEditorPersistence -> CadProjectSession -> CadProjectHost`;
- **O4** — desktop/mobile/search/shortcuts/ribbon share typed `CadUiAction` objects;
- **O5** — `App.tsx` was reduced from about 62 KB to about 30 KB; Tree, Parameters and Part/Sketch workspace ownership have focused modules;
- **O6** — Sketch/Constraint/Dimension mutation and availability live in typed handlers while application history/rollback/Undo/Redo remain centralized;
- **O7** — current persisted Sketch entities/constraints/dimensions are discriminated and runtime-validated; Sketch support is typed; PlaneGCS consumes typed ASA DTOs; semantic validation rejects duplicate/dangling/cross-Sketch references and missing StableRef supports;
- explicit **`activeSketchId` + `SketchSession`** replaces implicit `latestSketch()` targeting;
- **`SketchSolveSession`** owns transient solver preview/status/diagnostics/DoF availability and cannot bypass `CadApplication` history; current PlaneGCS reports DoF as unavailable rather than guessing;
- **O8.1** — Three ray hits are converted to ASA `ViewportPickCandidate[]`, semantically deduplicated/ranked, and ambiguity is preserved; selection state has a Three-independent owner;
- **O8.2** — Fit/standard views/pan/zoom policy lives in a Three-independent camera controller;
- **O8.3** — persisted or solved Sketch geometry has a separate read-only `SketchOverlayModel`/SVG layer outside B-Rep `CadRenderModel`. It is deliberately dormant until M3 owns the interaction flow.

The final O7/O8 PRs passed the complete shell/M2O, M1/M1B, Chromium interaction/touch/responsive/UI-scale, release Docker and vendor baseline gates.

## Protected Part workflow

Real Chromium and release Docker continue to prove through ASA-owned controls:

`XY Sketch -> rectangle 60x40 -> driving dimensions -> Extrude 10 -> select top face -> second Sketch -> centered diameter 12 -> through cut -> select edge -> Fillet R1 -> edit width 60 to 80 -> downstream rebuild -> save native parametric JSON -> reload/reopen -> edit diameter 12 to 14`.

Persisted data keeps feature history and durable StableRefs. Transient face/edge ordinals, solver preview, Three objects and OpenCascade objects are not persisted.

## Runtime / persistence invariants

- OpenCascade loads lazily only when exact B-Rep work is required;
- normal CAD mathematics stays on the client device;
- ASA Lab provides host/project/version/recovery services, not normal CAD-compute RPC;
- UI persistence remains behind `CadProjectSession/CadProjectHost`;
- solver preview is transient; committing a solved edit must use a normal `CadApplication` command so Undo/Redo remains authoritative.

## Interaction already protected

- wheel zoom, MMB pan, RMB orbit;
- Fit + front/back/top/bottom/left/right/isometric;
- central keyboard shortcuts and focus-safe input;
- body selection synchronized Viewport <-> Tree;
- typed face/edge command picking;
- semantic candidate dedupe/ranking + ambiguity seam;
- real touch navigation/selection;
- phone Tools using the same action catalog as desktop;
- HD/FHD/2K/4K/ultrawide, DPR/browser zoom and UI Scale matrix;
- B-Rep picking across UI Scale changes.

## Deterministic review routes

Part fixtures:
- `/dev/part/empty`;
- `/dev/part/sketch`;
- `/dev/part/extrude`;
- `/dev/part/reference`;
- `/dev/part/rebuild-error`.

## Deliberately not complete

Do **not** mistake the protected Part proof or completed M2O gate for KOMPAS parity.

Still incomplete:
- M3 full interactive parametric Sketch workflow: direct drawing/editing, broader geometry/constraints/dimensions, live PlaneGCS cycle, DoF/diagnostics presentation, snapping and active overlay interaction;
- M2I advanced selection/window/context/chooser behavior beyond the accepted O8 seam;
- M2V final KOMPAS visual/icon acceptance;
- broad Part Design + industrial StableRef corpus (M4);
- Assembly (M4A);
- ASA Lab deployment (M5);
- Drawing/Fragment and Specification/Text (M6/M6A).

## Immediate next work

Start **M3 Parametric Sketch** through the architecture that M2O created. The first slice should wire the explicit active `SketchSession` to `SketchSolveSession` and the dormant `SketchOverlayModel`, then add direct Sketch interaction as normal typed command/application slices. Do not reintroduce `latestSketch()`, direct solver document mutation, or Sketch drawing inside the B-Rep Three scene.

Non-blocking follow-ups O9/O10/O11 remain tracked in [`M2O_OPTIMIZATION_GATE.md`](M2O_OPTIMIZATION_GATE.md).
