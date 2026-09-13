# ASA-CAD current status

Short repository state for humans and coding agents. Product intent: `SYSTEM_SPEC.md`; architecture: `ARCHITECTURE.md`; implementation order: `ROADMAP.md`; detailed milestone history: GitHub issues.

Last synchronized: 2026-09-13.

## Current phase

**Gate A — ASA CAD Core: DONE.**  
**M2O — Architecture Optimization Gate (#21): DONE.**  
**M3 Parametric Sketch (#5): PAUSED by blocking maintenance gate #57.**  
**M3M code-size / bot-efficiency maintenance (#57): ACTIVE.**

Accepted M3 slices:
- M3.1 solve/overlay — DONE;
- M3.2 direct Line — DONE;
- M3.3 direct Circle — DONE;
- M3.4 Arc contract + direct Arc — DONE;
- M3.5 direct Rectangle — DONE;
- M3.6A stable-ID selection + atomic delete — DONE.

M3.6B rigid selected-entity drag was started in draft PR #56 but is intentionally discarded/closed. Restart it from current `main` only after M3M-001..008 are accepted.

## Blocking maintenance gate #57

Immediate order:
1. **M3M-001 — file-size budgets + numeric agent rules — DONE (#58)**;
2. **M3M-002 — split `usePartSketchWorkspace` into focused Sketch/Part/selection owners — NEXT**;
3. M3M-003 — extract `SketchEditingStage` from `PartModelStage`;
4. M3M-004 — extract shell presentation from `App.tsx`;
5. M3M-005 — split monolithic `styles.css`;
6. M3M-006 — split Sketch command handlers by geometry/edit/constraint/dimension ownership;
7. M3M-007 — shared M3 browser-test harness;
8. M3M-008 — reduce mandatory agent-document context and remove stale workflow prose;
9. M3M-009 — freeze `CadViewport.tsx` / `OpenCascadePartRuntime.ts` growth and require pre-M4 decomposition.

No new M3 feature slice may merge until M3M-001..008 are accepted. M3M-009 must block broad M4 expansion.

## Accepted architecture

Protected boundaries:
- six ASA document kinds;
- `CadDocument` / `CadApplication`;
- `CadProjectSession -> CadProjectHost`;
- typed shared desktop/mobile action model;
- explicit `activeSketchId` / `SketchSession`;
- transient `SketchSolveSession` and PlaneGCS preview;
- Sketch SVG overlay separate from B-Rep/Three render model;
- stable-ID transient Sketch selection;
- shared `SketchInteractionSurface`;
- client-side OpenCascade/PlaneGCS with lazy WASM;
- centralized application history/Undo/Redo;
- protected `main`, PR hygiene and separate M2/M3 browser lanes.

## Protected workflows

Part browser/Docker regression:

`XY Sketch -> rectangle 60x40 -> dimensions -> Extrude 10 -> top-face Sketch -> Ø12 through cut -> edge Fillet R1 -> width 60→80 -> rebuild -> save/reopen -> Ø12→14`.

M3 regressions protect direct Line/Circle/Arc/Rectangle and Sketch selection/delete on desktop/touch without eager OpenCascade.

## Runtime invariants

- solver/ghost/view/selection state is transient;
- committed changes go through typed `CadApplication` commands;
- PlaneGCS loads only for Sketch solving;
- OpenCascade loads only for exact B-Rep work;
- normal CAD math stays on the client;
- persisted data never contains OCC/Three/WASM objects or transient subshape ordinals.

## Deliberately incomplete

After maintenance:
- M3 rigid drag/control-point editing, snapping, trim/extend, broader constraints/dimensions, exact DoF where available, reliable StableRef-backed 3D Sketch context;
- M2I advanced context/candidate behavior;
- M2V final KOMPAS visual/icon acceptance;
- O9 root-owned toolchain;
- M4 Part Design and broad StableRef corpus;
- M4A Assembly;
- M5 ASA Lab deployment;
- M6/M6A Drawing/Fragment/Specification/Text.

## Immediate next work

Work **only on issue #57 M3M-002** after #58 merges. Split `usePartSketchWorkspace` into focused Sketch editing, Part feature and Part selection owners; keep its public facade stable and ratchet its file ceiling downward. Do not restart M3.6B from closed PR #56.
