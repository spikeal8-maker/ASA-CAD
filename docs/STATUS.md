# ASA-CAD current status

Short repository state for humans and coding agents. ASA-CAD keeps **six first-class document kinds**; product/end state: `SYSTEM_SPEC.md`; technical boundary: `ARCHITECTURE.md`; sequence: `ROADMAP.md`; detailed history: GitHub issues.

Last synchronized: 2026-09-14.

## Current phase

**Gate A — ASA CAD Core: DONE.**  
**M2O — Architecture Optimization Gate (#21): DONE.**  
**M3 Parametric Sketch (#5): ACTIVE.**  
**M3M #57: M3 resume gate (001..008) COMPLETE; M3M-009 remains pre-M4.**

Accepted M3 slices: M3.1 solve/overlay, M3.2 Line, M3.3 Circle, M3.4 Arc, M3.5 Rectangle, M3.6A stable-ID selection/delete, M3.6B selected stable-ID rigid drag/translate (#75), **M3.7A selected-Line Horizontal / Vertical constraints (#77)**.

M3.6B is merged to `main` at `57c5e613`: typed `sketch.entity.translate`, transient PlaneGCS drag preview, fixed-entity guard, one pointer-up history commit, Esc cancel, Undo/Redo, Save/Open, and desktop/touch Line/Circle/Arc/Rectangle-edge regressions are accepted. OpenCascade stays lazy during Sketch drag.

M3.7A is merged to `main` at `1c5606cc`: `constraint.horizontal` / `constraint.vertical` are product actions for a selected Line through the shared desktop/mobile/search `CadUiAction` model. Application semantics reject non-Line targets, duplicate same-type constraints and direct H-vs-V conflict. Persisted constraint intent reconstructs the same solved PlaneGCS result after Undo/Redo and Save/Open; desktop Horizontal and touch Vertical browser regressions are accepted without loading OpenCascade.

## Maintenance gate #57

1. M3M-001 file budgets/rules — DONE (#58);
2. M3M-002 focused Part/Sketch workspace owners — DONE (#60);
3. M3M-003 `SketchEditingStage` extraction — DONE (#61);
4. M3M-004 shell extraction / App ratchet — DONE (#62);
5. M3M-005 domain CSS split — DONE (#63);
6. M3M-006 Sketch geometry/edit/constraint/dimension command owners — DONE (#71);
7. M3M-007 shared M3 browser harness; focused specs <=8 KB — DONE (#72);
8. M3M-008 agent-context/doc cleanup + permanent quality gates — DONE (#64/#72);
9. **M3M-009 viewport/runtime frozen-hotspot closeout — required before broad M4.**

## Full Repository Health Audit — YELLOW accepted

No RED blocker remains for M3. Existing debt is frozen/non-growing and has explicit later gates:
- `CadViewport.tsx` / `OpenCascadePartRuntime.ts` and remaining oversized first-party owners/tests: M3M-009 / Gate-B-to-M4 closeout;
- pinned vendor dependency/security review + GitHub Actions Node-runtime modernization: upstream/M4B pre-beta maintenance;
- root license / third-party notice decision: release hygiene before beta/public release;
- ASA-CAD ↔ ASA Lab golden host-contract preflight and scale/history benchmarks: before broad M4/M5 and M4B respectively.

## Protected architecture / regressions

- six ASA document kinds behind `CadDocument` / `CadApplication`; `CadProjectSession -> CadProjectHost`;
- shared desktop/mobile typed actions and centralized application history;
- focused Sketch stage/geometry/edit/constraint/dimension owners;
- shared `SketchInteractionSurface`; stable-ID selection/drag stays in separate Sketch interaction layers;
- M3 browser infrastructure centralized in `M3BrowserHarness.mjs` while tool assertions remain separate;
- client-side lazy PlaneGCS/OpenCascade; no persisted OCC/Three/WASM objects;
- protected Part and M3 Line/Circle/Arc/Rectangle/selection-delete/rigid-drag/H-V-constraint desktop+touch regressions are green.

## Immediate next work

Start **M3.7B — Fixed constraint with solved-geometry freeze semantics** as a new clean slice from current `main`:
- keep `constraint.fixed` hidden/planned until the persistence contract is explicit and browser-proven;
- Fixed must freeze the geometry the user currently sees after PlaneGCS solving, never stale pre-solve coordinates from the persisted entity DTO;
- define one atomic history mutation that persists the solved geometry required for the selected entity and creates the Fixed constraint without an intermediate inconsistent document state;
- reject duplicate Fixed deterministically and preserve the selected stable entity ID;
- Undo/Redo and Save/Open must restore the exact same frozen geometry + Fixed intent;
- dragging a fixed entity must remain rejected at both interaction and application boundaries;
- cover Line first only if that is the narrowest safe vertical slice; do not broaden to Coincident, multi-entity constraints, endpoint reshape, snapping, trim/extend, dimensions or M4 work unless required by the Fixed contract.

M3.7B must explicitly prove that solved overlay, persisted entity geometry and Fixed intent cannot silently diverge. Do not start broad M4 before M3M-009.
