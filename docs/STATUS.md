# ASA-CAD current status

This file is the **single short current-state entry point** for humans and coding agents. Product/end-state intent belongs to [`SYSTEM_SPEC.md`](SYSTEM_SPEC.md); implementation order belongs to [`ROADMAP.md`](ROADMAP.md). Detailed milestone history belongs in GitHub issues.

Last synchronized: 2026-09-13.

## Current phase

**Gate A — ASA CAD Core: DONE.**  
**M2O — Architecture Optimization Gate (#21): DONE.**  
**M3 Parametric Sketch (#5): ACTIVE.**

Tracking:
- #3 M2 core shell — ACTIVE;
- #15 M2A deterministic fixtures/visual review — ACTIVE;
- #17 M2I advanced interaction/mobile — ACTIVE;
- #18 M2R display/DPI/zoom/UI Scale — DONE;
- #19 M2V KOMPAS visual acceptance — ACTIVE;
- #21 M2O architecture optimization — DONE;
- #5 M3 Parametric Sketch — ACTIVE; **M3.1, M3.2, M3.3, M3.4A, M3.4B and M3.5 DONE; M3.6A Sketch entity selection + atomic delete NEXT.**

## Accepted architecture foundation

The pre-M3 structural debt identified by the critical audit is CI-protected:

- six ASA document kinds and ASA-owned `CadDocument` / `CadApplication` boundaries;
- persistence through `CadProjectSession -> CadProjectHost`;
- one typed `CadUiAction` catalog for desktop/mobile/search/shortcuts;
- focused Tree/Parameters/Part-Sketch controllers instead of a growing `App.tsx`;
- typed Sketch command handlers with centralized rollback/history/Undo/Redo;
- discriminated Sketch DTOs plus semantic reference validation;
- explicit `activeSketchId` / `SketchSession`;
- transient `SketchSolveSession` for PlaneGCS preview/status/diagnostics;
- Three-independent picking/selection and camera controllers;
- separate SVG `SketchOverlayModel` outside B-Rep `CadRenderModel`;
- shared `SketchInteractionSurface` owning direct-tool mouse/touch/pan/pinch/wheel policy;
- protected `main`, PR hygiene gate and separate M2/M3 browser lanes.

## M3 accepted slices

### M3.1 — solve/overlay session — DONE (#38)
Active Sketch drives lazy PlaneGCS solving; solved geometry is transient SVG preview and never bypasses `CadApplication` history. OpenCascade remains lazy until exact B-Rep work.

### M3.2 — direct Line — DONE (#39)
First point -> ghost -> second point -> exactly one typed `sketch.line` mutation. Mouse/touch/Undo/Redo/Save/Open and `/dev/part/line` are protected.

### M3.3 — direct Circle — DONE (#43 + #45)
Center -> radius direct interaction through `SketchInteractionSurface`; one typed `sketch.circle` mutation; explicit diameter dimensions remain separate; `/dev/part/circle` and desktop/touch persistence regression are protected.

### M3.4A — Arc contract/runtime — DONE (#46)
Canonical schema-v1 Arc DTO is `center + radius + startAngle + endAngle`, radians, positive CCW sweep. Typed `sketch.arc`, rollback and PlaneGCS readback are protected in `test:m3`.

### M3.4B — direct Arc — DONE (#50)
- center -> start -> end direct interaction on the stable Sketch viewport;
- Arc reuses `SketchInteractionSurface`; no gesture-policy duplication;
- center/radius/sweep ghosts are transient;
- invalid end point coincident with Arc center is rejected without leaving the tool;
- exactly one typed `sketch.arc` application-history mutation;
- persisted/solver Arc renders through the Sketch overlay with correct SVG sweep after Y inversion;
- deterministic `/dev/part/arc` solves through PlaneGCS without OpenCascade;
- desktop + touch + Undo/Redo + Save/Open are green in the dedicated M3 browser lane;
- `sketch.arc` is now `implemented` in the product command registry;
- shell, M2 browser, M3 browser, Docker, M1/M1B and vendor baseline were green before merge.

### M3.5 — direct Rectangle — DONE (#52)
- first corner -> opposite corner direct interaction on the stable Sketch viewport;
- Rectangle reuses `SketchInteractionSurface`; no duplicate pointer/touch/navigation policy;
- preview is exactly four transient ghost edges and never mutates `CadDocument`;
- arbitrary drag direction normalizes to canonical `origin + positive width + positive height`;
- zero-width/zero-height opposite points are rejected while the tool remains active;
- exactly one typed `sketch.rectangle` application-history mutation atomically creates the four persisted line entities;
- direct Rectangle does not silently add driving dimensions;
- explicit numeric Width/Height + driving dimensions remain available through Parameters and the protected Part workflow still passes;
- deterministic `/dev/part/rectangle` solves through PlaneGCS without OpenCascade;
- desktop + touch + Undo/Redo + Save/Open are green in the dedicated M3 browser lane;
- shell, full M2 browser, M3 browser, Docker, M1/M1B and vendor baseline were green on the final one-commit PR before merge.

## Protected Part workflow

Real Chromium and release Docker continue to prove:

`XY Sketch -> explicit numeric rectangle 60x40 -> PlaneGCS solve/preview -> driving dimensions -> Extrude 10 -> select top face -> second Sketch -> centered diameter 12 -> through cut -> select edge -> Fillet R1 -> edit width 60 to 80 -> downstream rebuild -> save native parametric JSON -> reload/reopen -> edit diameter 12 to 14`.

Persisted data keeps feature history and durable StableRefs. Solver preview, Sketch ghosts/view state, transient face/edge ordinals, Three objects and OpenCascade objects are not persisted.

## Runtime / persistence invariants

- PlaneGCS loads lazily only for non-empty active Sketch solving;
- OpenCascade loads lazily only for exact B-Rep work;
- normal CAD mathematics stays on the client device;
- ASA Lab provides project/version/recovery services, not normal CAD-compute RPC;
- solver/ghost/view preview is transient; committed edits go through normal `CadApplication` commands;
- Undo/Redo remains authoritative.

## Interaction already protected

- wheel zoom, MMB pan, RMB orbit for B-Rep;
- Fit + standard views;
- central keyboard shortcuts and focus-safe input;
- Viewport <-> Tree body selection;
- typed face/edge command picking plus candidate ambiguity seam;
- real touch navigation/selection;
- shared desktop/mobile action catalog;
- HD/FHD/2K/4K/ultrawide, DPR/browser zoom and UI Scale matrix;
- isolated active-Sketch 2D viewport and solver overlay;
- direct Line, Circle, Arc and Rectangle mouse/touch tools through one `SketchInteractionSurface`.

## Deterministic review routes

Part fixtures:
- `/dev/part/empty`;
- `/dev/part/sketch`;
- `/dev/part/line`;
- `/dev/part/circle`;
- `/dev/part/arc`;
- `/dev/part/rectangle`;
- `/dev/part/extrude`;
- `/dev/part/reference`;
- `/dev/part/rebuild-error`.

## Deliberately not complete

Do **not** mistake the protected Part proof or completed M2O gate for KOMPAS parity.

Still incomplete:
- M3 Sketch entity selection/delete/drag, trim/extend, snapping, construction/reference geometry, broader constraints/dimensions and reliable StableRef-backed 3D Sketch context;
- exact solver DoF/rank reporting where the PlaneGCS wrapper does not expose it;
- M2I advanced window/context/candidate chooser behavior beyond the accepted seam;
- M2V final KOMPAS visual/icon acceptance;
- O9 root-owned dependency/toolchain follow-up;
- broad Part Design + industrial StableRef corpus (M4);
- Assembly (M4A);
- ASA Lab deployment (M5);
- Drawing/Fragment and Specification/Text (M6/M6A).

## Immediate next work

Continue issue #5 with **M3.6A — Sketch entity selection + atomic delete foundation only**.

There is no typed delete command yet, so establish the contract before expanding UI behavior:
1. add one typed Sketch-entity delete command keyed by explicit `sketchId + entityId`;
2. handle Sketch-local constraints/dimensions that reference the deleted entity deterministically in the same atomic history mutation; never leave dangling references;
3. select persisted/solver Sketch entities through the ASA Sketch overlay by stable `entityId`, never SVG/DOM index identity;
4. keep selection transient and outside persisted `CadDocument`;
5. desktop click and touch tap select the same entity; Esc clears selection;
6. Delete/Backspace and the shared mobile action presentation execute the same typed delete intent;
7. Undo/Redo restores/removes the entity and handled dependencies atomically;
8. protect Line/Circle/Arc/Rectangle selection/delete in deterministic M3 browser coverage without loading OpenCascade.

Do not combine dragging, trim, snapping, constraint authoring or general box-selection with this slice.

O9 and O11 remain non-blocking follow-ups in [`M2O_OPTIMIZATION_GATE.md`](M2O_OPTIMIZATION_GATE.md).
