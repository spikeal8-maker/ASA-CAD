# ASA-CAD current status

Short repository state for humans and coding agents. Product intent: `SYSTEM_SPEC.md`; architecture: `ARCHITECTURE.md`; implementation order: `ROADMAP.md`; detailed milestone history: GitHub issues.

Last synchronized: 2026-09-13.

## Current phase

**Gate A — ASA CAD Core: DONE.**  
**M2O — Architecture Optimization Gate (#21): DONE.**  
**M3 Parametric Sketch (#5): PAUSED by blocking maintenance gate #57.**  
**M3M code-size / bot-efficiency maintenance (#57): ACTIVE.**

Accepted M3 slices: M3.1 solve/overlay, M3.2 Line, M3.3 Circle, M3.4 Arc, M3.5 Rectangle, M3.6A stable-ID selection/delete — DONE.

M3.6B rigid drag draft PR #56 is closed and discarded. Restart only after M3M-001..008 are accepted.

## Blocking maintenance gate #57

1. M3M-001 — file-size budgets + numeric agent rules — DONE (#58);
2. M3M-002 — focused Part/Sketch workspace owners — DONE (#60);
3. M3M-003 — `SketchEditingStage` extracted from `PartModelStage` — DONE (#61);
4. **M3M-004 — shell presentation extracted from `App.tsx`; App ratcheted to 18,023 B — DONE (this change);**
5. **M3M-005 — shell CSS split into focused domain files; monolithic `styles.css` removed — DONE (this change);**
6. **M3M-006 — split Sketch command handlers by geometry/edit/constraint/dimension ownership — NEXT;**
7. M3M-007 — shared M3 browser-test harness;
8. M3M-008 — reduce mandatory agent-document context and retire stale workflow prose;
9. M3M-009 — freeze/decompose `CadViewport.tsx` / `OpenCascadePartRuntime.ts` before broad M4.

No new M3 feature slice may merge until M3M-001..008 are accepted. M3M-009 blocks broad M4 expansion.

## Accepted architecture

Protected boundaries:
- six ASA document kinds;
- `CadDocument` / `CadApplication`;
- `CadProjectSession -> CadProjectHost`;
- typed shared desktop/mobile action model;
- explicit `activeSketchId` / `SketchSession`;
- transient `SketchSolveSession` and PlaneGCS preview;
- `SketchEditingStage` owns active 2D Sketch viewport state, solve overlay, stable-ID selection and direct tool layers;
- `PartModelStage` owns only Part/B-Rep presentation and mode delegation;
- `App.tsx` owns orchestration; shell/ribbon/panel/status/dialog presentation lives in focused `CadShell*` modules;
- Sketch SVG overlay remains separate from B-Rep/Three;
- shared `SketchInteractionSurface`;
- client-side lazy OpenCascade/PlaneGCS;
- centralized application history/Undo/Redo;
- protected `main`, file budgets, PR hygiene and separate M2/M3 browser lanes.

## Protected workflows

Part browser/Docker regression:
`XY Sketch -> rectangle 60x40 -> dimensions -> Extrude 10 -> top-face Sketch -> Ø12 through cut -> edge Fillet R1 -> width 60→80 -> rebuild -> save/reopen -> Ø12→14`.

M3 regressions protect Line/Circle/Arc/Rectangle and selection/delete on desktop/touch without eager OpenCascade.

## Runtime invariants

- solver/ghost/view/selection state is transient;
- committed changes go through typed `CadApplication` commands;
- PlaneGCS loads only for Sketch solving;
- OpenCascade loads only for exact B-Rep work;
- normal CAD math stays on the client;
- persisted data contains no OCC/Three/WASM objects or transient subshape ordinals.

## Immediate next work

Work **only on #57 M3M-006** after this change merges. Split Sketch command handlers into focused geometry/edit/constraint/dimension owners before broader constraints. Do not restart M3.6B.
