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

All blocking O1–O8 acceptance gates are green. **M3 Parametric Sketch is active.** M2 visual/interaction lanes may continue in parallel where they do not conflict with the active Sketch work.

Tracking:
- #3 M2 core shell — ACTIVE;
- #15 M2A deterministic fixtures/visual review — ACTIVE;
- #17 M2I interaction/mobile — ACTIVE;
- #18 M2R display/DPI/zoom/UI Scale — DONE;
- #19 M2V KOMPAS visual acceptance — ACTIVE;
- #21 M2O architecture optimization — DONE / closeout;
- #5 M3 Parametric Sketch — ACTIVE.

## M2O result

The pre-M3 structural debt identified by the critical audit is now addressed and CI-protected:

- **O1** — mandatory architecture documentation aligned to all six document kinds;
- **O2** — command/layout registries normalized to canonical IDs, accepted M2 statuses truthful and drift rejected by CI;
- **O3** — editor Save/Open routed through `CadEditorPersistence -> CadProjectSession -> CadProjectHost`;
- **O4** — shared typed `CadUiAction` catalog drives toolbar, search, command-backed shortcuts, Sketch/Part/View ribbon and mobile Tools;
- **O5** — `App.tsx` reduced from about 62 KB to about 30 KB; Tree, Parameters and Part/Sketch workspace ownership have focused modules;
- **O6** — Sketch/Constraint/Dimension mutation and availability live in typed handlers while application history/rollback/Undo/Redo remain centralized;
- **O7** — current persisted Sketch entities/constraints/dimensions are discriminated and runtime-validated; Sketch support is typed; PlaneGCS consumes typed ASA DTOs; semantic validation rejects duplicate/dangling/cross-Sketch references and missing StableRef supports;
- explicit **`activeSketchId` + `SketchSession`** replaces implicit `latestSketch()` targeting;
- **`SketchSolveSession`** owns transient solver preview/status/diagnostics/DoF availability and cannot bypass `CadApplication` history; current PlaneGCS reports DoF as unavailable rather than guessing;
- **O8.1** — Three ray hits become ASA `ViewportPickCandidate[]`, semantic duplicates are collapsed/ranked and ambiguity is preserved; selection state has a Three-independent owner;
- **O8.2** — Fit/standard views/pan/zoom policy lives in a Three-independent camera controller;
- **O8.3** — persisted or solved Sketch geometry has a separate read-only `SketchOverlayModel`/SVG layer outside B-Rep `CadRenderModel`;
- **O10** — `main` is protected: changes require a pull request, admins are enforced, conversations must resolve, force-push/delete are disabled, and always-on required checks are `shell-build`, `vendor-baseline`, `asa-m1`, `asa-m1b`.

Browser/Docker path-filtered suites remain mandatory development discipline for affected CAD/UI work even though they cannot be global required checks on docs-only PRs.

## M3 progress

### M3.1 — active solve preview / read-only overlay — DONE in PR #38

The first real Sketcher slice is now implemented and regression-protected:
- explicit active `SketchSession` drives `SketchSolveSession`;
- browser PlaneGCS is loaded lazily only after a non-empty active Sketch needs solving;
- successful solved geometry is projected into transient `SketchOverlayModel` and is never persisted directly;
- solve status, diagnostics and DoF availability are visible to the editor;
- an empty Sketch renders without loading PlaneGCS;
- OpenCascade remains unloaded until the first exact solid operation;
- PlaneGCS and OpenCascade have separate browser WASM lifecycles and the protected Chromium flow proves both;
- M3.1 uses a deliberate **isolated 2D Sketch workplane** while editing. B-Rep is not composited under the screen-fitted SVG until M3.2 owns support-aware projection, preventing a misleading overlay on XZ/YZ or face-supported sketches.

## Protected Part workflow

Real Chromium and release Docker continue to prove through ASA-owned controls:

`XY Sketch -> rectangle 60x40 -> PlaneGCS solve/preview -> driving dimensions -> Extrude 10 -> select top face -> second Sketch -> centered diameter 12 -> through cut -> select edge -> Fillet R1 -> edit width 60 to 80 -> downstream rebuild -> save native parametric JSON -> reload/reopen -> edit diameter 12 to 14`.

Persisted data keeps feature history and durable StableRefs. Transient face/edge ordinals, solver preview, Three objects and OpenCascade objects are not persisted.

## Runtime / persistence invariants

- PlaneGCS loads lazily when a non-empty active Sketch needs a solve;
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
- B-Rep picking across UI Scale changes;
- read-only active-Sketch solver overlay in an isolated 2D workplane.

## Deterministic review routes

Part fixtures:
- `/dev/part/empty`;
- `/dev/part/sketch`;
- `/dev/part/extrude`;
- `/dev/part/reference`;
- `/dev/part/rebuild-error`.

## Deliberately not complete

Do **not** mistake the protected Part proof, completed M2O gate or M3.1 preview for KOMPAS parity.

Still incomplete:
- M3 direct drawing/editing, broader geometry/constraints/dimensions, snapping, active overlay interaction and support-aware 3D projection/context;
- M2I advanced selection/window/context/chooser behavior beyond the accepted O8 seam;
- M2V final KOMPAS visual/icon acceptance;
- O9 root-owned dependency/toolchain follow-up;
- broad Part Design + industrial StableRef corpus (M4);
- Assembly (M4A);
- ASA Lab deployment (M5);
- Drawing/Fragment and Specification/Text (M6/M6A).

## Immediate next work

Continue issue #5 with **M3.2 — direct Line canvas interaction**. Route pointer input through the existing viewport candidate/Sketch seams, add ghost/snap preview outside B-Rep, commit one normal typed `sketch.line` command through `CadApplication`, and add support-aware workplane projection before compositing Sketch geometry with B-Rep context. Preserve the M3.1 rule that transient solver/ghost geometry never mutates `CadDocument` directly.

O9 and O11 remain non-blocking follow-ups in [`M2O_OPTIMIZATION_GATE.md`](M2O_OPTIMIZATION_GATE.md).
