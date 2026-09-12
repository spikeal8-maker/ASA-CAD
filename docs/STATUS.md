# ASA-CAD current status

This file is the **single short current-state entry point** for humans and coding agents. Product/end-state intent belongs to [`SYSTEM_SPEC.md`](SYSTEM_SPEC.md); implementation order belongs to [`ROADMAP.md`](ROADMAP.md).

Last synchronized: 2026-09-13.

## Current phase

**Gate A — ASA CAD Core: DONE.**

Completed foundation:
- M0 imported/pinned CAD baseline;
- M0D standalone/release Docker browser surface;
- M1 ASA-owned `CadDocument` / `CadApplication` / command/runtime boundary;
- M1U KOMPAS v25 command inventory baseline;
- M1B lazy client runtime, recovery and ASA Lab host contract.

**M2O — Architecture Optimization Gate (#21): DONE.**

All blocking O1–O8 acceptance gates are green. **M3 Parametric Sketch is active.** M2 visual/interaction lanes may continue in parallel where they do not conflict with active Sketch work.

Tracking:
- #3 M2 core shell — ACTIVE;
- #15 M2A deterministic fixtures/visual review — ACTIVE;
- #17 M2I interaction/mobile — ACTIVE;
- #18 M2R display/DPI/zoom/UI Scale — DONE;
- #19 M2V KOMPAS visual acceptance — ACTIVE;
- #21 M2O architecture optimization — DONE;
- #5 M3 Parametric Sketch — ACTIVE; M3.1, M3.2 and M3.3 DONE; M3.4 Arc contract NEXT.

## M2O result

The pre-M3 structural debt identified by the critical audit is addressed and CI-protected:

- **O1** — mandatory architecture documentation aligned to all six document kinds;
- **O2** — command/layout registries normalized to canonical IDs and drift rejected by CI;
- **O3** — editor Save/Open routed through `CadEditorPersistence -> CadProjectSession -> CadProjectHost`;
- **O4** — shared typed `CadUiAction` catalog drives toolbar, search, command-backed shortcuts, ribbon and mobile Tools;
- **O5** — `App.tsx` reduced from about 62 KB to about 30 KB; Tree, Parameters and Part/Sketch workspace ownership have focused modules;
- **O6** — Sketch/Constraint/Dimension mutation and availability live in typed handlers while history/rollback/Undo/Redo remain centralized;
- **O7** — persisted Sketch entities/constraints/dimensions are discriminated and runtime-validated; semantic validation rejects duplicate/dangling/cross-Sketch references and missing StableRef supports;
- explicit **`activeSketchId` + `SketchSession`** replaces implicit last-Sketch targeting;
- **`SketchSolveSession`** owns transient solver preview/status/diagnostics/DoF availability and cannot bypass `CadApplication` history;
- **O8.1** — Three ray hits become ASA `ViewportPickCandidate[]`, semantic duplicates are collapsed/ranked and ambiguity is preserved;
- **O8.2** — Fit/standard views/pan/zoom policy lives in a Three-independent camera controller;
- **O8.3** — persisted or solved Sketch geometry has a separate SVG `SketchOverlayModel` layer outside B-Rep `CadRenderModel`;
- **O10** — `main` is protected with required PR/status/conversation rules.

Browser/Docker path-filtered suites remain mandatory development discipline for affected CAD/UI work.

## M3 progress

### M3.1 — active solve preview / read-only overlay — DONE in PR #38

- active `SketchSession` drives `SketchSolveSession`;
- PlaneGCS loads lazily only when a non-empty active Sketch needs solving;
- successful solved geometry becomes transient `SketchOverlayModel` and is never persisted directly;
- solve status/diagnostics/DoF availability are visible;
- OpenCascade remains unloaded until exact solid work;
- active Sketch editing uses an isolated 2D workplane.

### M3.2 — direct Line — DONE in PR #39

- first pointer anchors, move shows transient ghost, second pointer creates exactly one typed `sketch.line` history mutation;
- persisted/solver overlay and direct interaction share a stable transient Sketch viewport;
- two-finger touch pan/pinch is navigation-only and cannot create accidental endpoints;
- direct manipulation collapses management UI and restores Tree after commit/cancel;
- XY/XZ/YZ workplane projection contract exists; StableRef face-backed 3D context remains deliberately unresolved;
- Chromium proves mouse/touch, ghost immutability, atomic Undo/Redo and Save/Open.

### M3.3 — direct Circle — DONE in PR #43

- first pointer sets the center, move shows a transient radius ghost, second pointer creates exactly one typed `sketch.circle` history mutation;
- `SketchCircleInteractionLayer` reuses the shared `SketchInteractionSurface`; mouse/touch/pan/pinch/wheel policy is not duplicated;
- Circle preview never mutates `CadDocument` directly;
- PlaneGCS solver preview follows the persisted Circle and OpenCascade stays lazy during pure 2D editing;
- direct Circle does **not** silently create a driving dimension as a second history mutation;
- the existing explicit numeric `dimension.diameter` path remains available through Parameters and the protected Ø12 -> cut -> reopen -> Ø14 workflow stays green;
- dedicated `ASA-CAD M3 browser` proves Line + Circle mouse/touch/Undo/Redo/Save/Open;
- M2 browser, M3 browser, Docker, shell, M0/M1/M1B and vendor baseline were green before merge;
- review branch contained one final commit and no temporary codemod/workflow artifacts.

## Protected Part workflow

Real Chromium and release Docker continue to prove through ASA-owned controls:

`XY Sketch -> rectangle 60x40 -> PlaneGCS solve/preview -> driving dimensions -> Extrude 10 -> select top face -> second Sketch -> centered diameter 12 -> through cut -> select edge -> Fillet R1 -> edit width 60 to 80 -> downstream rebuild -> save native parametric JSON -> reload/reopen -> edit diameter 12 to 14`.

Persisted data keeps feature history and durable StableRefs. Transient face/edge ordinals, solver preview, Sketch ghost/view state, Three objects and OpenCascade objects are not persisted.

## Runtime / persistence invariants

- PlaneGCS loads lazily when a non-empty active Sketch needs a solve;
- OpenCascade loads lazily only when exact B-Rep work is required;
- normal CAD mathematics stays on the client device;
- ASA Lab provides host/project/version/recovery services, not normal CAD-compute RPC;
- UI persistence remains behind `CadProjectSession/CadProjectHost`;
- solver/ghost/view preview is transient; committed geometry and solved edits must use normal `CadApplication` commands so Undo/Redo remains authoritative.

## Interaction already protected

- wheel zoom, MMB pan, RMB orbit for B-Rep;
- Fit + front/back/top/bottom/left/right/isometric;
- central keyboard shortcuts and focus-safe input;
- body selection synchronized Viewport <-> Tree;
- typed face/edge command picking;
- semantic candidate dedupe/ranking + ambiguity seam;
- real touch navigation/selection;
- phone Tools using the same action catalog as desktop;
- HD/FHD/2K/4K/ultrawide, DPR/browser zoom and UI Scale matrix;
- active-Sketch solver overlay in an isolated 2D workplane;
- shared `SketchInteractionSurface` owns direct-tool pointer/touch/pan/pinch/wheel policy;
- direct Line and direct Circle mouse/touch input on the stable Sketch frame.

## Deterministic review routes

Part fixtures:
- `/dev/part/empty`;
- `/dev/part/sketch`;
- `/dev/part/line`;
- `/dev/part/circle`;
- `/dev/part/extrude`;
- `/dev/part/reference`;
- `/dev/part/rebuild-error`.

## Deliberately not complete

Do **not** mistake the protected Part proof, completed M2O gate or first three M3 slices for KOMPAS parity.

Still incomplete:
- M3 Arc/Rectangle and edit tools, broader constraints/dimensions, snapping, drag editing and reliable StableRef-backed 3D Sketch context;
- exact solver DoF/rank reporting where PlaneGCS wrapper does not expose it;
- M2I advanced selection/window/context/chooser behavior beyond the accepted O8 seam;
- M2V final KOMPAS visual/icon acceptance;
- O9 root-owned dependency/toolchain follow-up;
- broad Part Design + industrial StableRef corpus (M4);
- Assembly (M4A);
- ASA Lab deployment (M5);
- Drawing/Fragment and Specification/Text (M6/M6A).

## Immediate next work

Continue issue #5 with **M3.4 — Arc contract slice first**.

Arc is not yet part of `CadSketchEntity` or the typed command surface. Before any Arc pointer UI:
1. choose one canonical persisted Arc representation;
2. add runtime validation and schema-v1 round-trip coverage;
3. add typed `sketch.arc` command/handler + availability;
4. add PlaneGCS support/regression for that exact representation;
5. keep command-registry status truthful;
6. only after the contract/runtime slice is green, add direct Arc interaction through the existing `SketchInteractionSurface`.

Do not combine Rectangle, trim, snap or broader constraints with the Arc contract slice.

O9 and O11 remain non-blocking follow-ups in [`M2O_OPTIMIZATION_GATE.md`](M2O_OPTIMIZATION_GATE.md).
