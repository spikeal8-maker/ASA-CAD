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
- #5 M3 Parametric Sketch — ACTIVE; **M3.1, M3.2, M3.3, M3.4A, M3.4B, M3.5 and M3.6A DONE; M3.6B rigid entity drag/translate NEXT.**

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
- separate read-only SVG `SketchOverlayModel`/`SketchOverlayLayer` outside B-Rep `CadRenderModel`;
- separate transient `SketchSelectionLayer` using stable Sketch entity IDs;
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
Center -> start -> end direct interaction reuses `SketchInteractionSurface`; transient radius/sweep ghosts never mutate the document; one typed `sketch.arc` history mutation is protected by desktop/touch/Undo/Redo/Save/Open and `/dev/part/arc` regressions.

### M3.5 — direct Rectangle — DONE (#52)
First corner -> opposite corner direct interaction normalizes to canonical origin + positive width/height and commits exactly one `sketch.rectangle` history mutation. Four-edge ghost, `/dev/part/rectangle`, desktop/touch/Undo/Redo/Save/Open are protected; direct Rectangle creates no hidden driving dimensions.

### M3.6A — Sketch entity selection + atomic delete — DONE (#54)
- stable-ID selection for Line/Circle/Arc/Rectangle lives in transient `SketchSession.selectedEntityId`;
- read-only persisted/solver geometry remains in the accepted `CadViewport -> SketchOverlayLayer` seam;
- separate `SketchSelectionLayer` owns hit targets/highlight and never enters the B-Rep Three effect;
- direct Sketch tools disable selection while they own pointer input;
- typed `sketch.entity.delete` uses explicit `sketchId + entityId`;
- deletion atomically removes the entity plus Sketch-local dependent constraints/dimensions and ID references;
- failed cross-Sketch deletion rolls back;
- Esc clears selection; Delete/Backspace and the shared mobile action execute the same typed delete intent;
- Undo/Redo restores/removes the same stable entity ID and dependencies atomically;
- Line/Circle/Arc/Rectangle desktop selection/delete and touch mobile delete are green without OpenCascade;
- final PR was one commit and shell/M2 browser/M3 browser/Docker/M1/M1B/vendor baseline were green before merge.

## Protected Part workflow

Real Chromium and release Docker continue to prove:

`XY Sketch -> rectangle 60x40 -> PlaneGCS solve/preview -> driving dimensions -> Extrude 10 -> select top face -> second Sketch -> centered diameter 12 -> through cut -> select edge -> Fillet R1 -> edit width 60 to 80 -> downstream rebuild -> save native parametric JSON -> reload/reopen -> edit diameter 12 to 14`.

Persisted data keeps feature history and durable StableRefs. Solver preview, Sketch ghosts/view/selection state, transient face/edge ordinals, Three objects and OpenCascade objects are not persisted.

## Runtime / persistence invariants

- PlaneGCS loads lazily only for non-empty active Sketch solving;
- OpenCascade loads lazily only for exact B-Rep work;
- normal CAD mathematics stays on the client device;
- ASA Lab provides project/version/recovery services, not normal CAD-compute RPC;
- solver/ghost/view/selection preview is transient; committed edits go through normal `CadApplication` commands;
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
- direct Line, Circle, Arc and Rectangle mouse/touch tools through one `SketchInteractionSurface`;
- stable-ID Sketch entity selection, Esc clear, Delete/Backspace, mobile delete and atomic Undo/Redo.

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
- M3 entity drag/control-point editing, snapping, trim/extend, broader constraints/dimensions and reliable StableRef-backed 3D Sketch context;
- exact solver DoF/rank reporting where the PlaneGCS wrapper does not expose it;
- M2I advanced window/context/candidate chooser behavior beyond the accepted seam;
- M2V final KOMPAS visual/icon acceptance;
- O9 root-owned dependency/toolchain follow-up;
- broad Part Design + industrial StableRef corpus (M4);
- Assembly (M4A);
- ASA Lab deployment (M5);
- Drawing/Fragment and Specification/Text (M6/M6A).

## Immediate next work

Continue issue #5 with **M3.6B — selected entity rigid drag/translate only**.

Required direction:
1. typed translate intent keyed by `sketchId + entityId + delta`, preserving stable entity ID and metadata;
2. line endpoints translate together; circle/arc centers translate; selected rectangle edge remains an ordinary translated line entity;
3. drag movement stays transient and must not mutate persisted DTOs;
4. extend the transient PlaneGCS preview path only as needed to validate the drag candidate without writing history;
5. pointer-up commits exactly one normal application-history mutation; Esc/cancel discards the draft;
6. existing constraints must be respected by preview/commit and failed solve must not corrupt persisted geometry;
7. protect desktop/touch/Undo/Redo/Save/Open for Line/Circle/Arc/Rectangle-edge dragging without OpenCascade.

Do not combine endpoint/control-point reshape, snapping, trim/extend, broader constraints, selection-box or multi-select with this slice.

O9 and O11 remain non-blocking follow-ups in [`M2O_OPTIMIZATION_GATE.md`](M2O_OPTIMIZATION_GATE.md).
