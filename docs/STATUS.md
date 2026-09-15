# ASA-CAD current status

Short repository state for humans and coding agents. ASA-CAD keeps **six first-class document kinds**; product/end state: `SYSTEM_SPEC.md`; technical boundary: `ARCHITECTURE.md`; sequence: `ROADMAP.md`; detailed history: GitHub issues.

Last synchronized: 2026-09-15.

## Current phase

**Gate A — ASA CAD Core: DONE.**  
**M2O — Architecture Optimization Gate (#21): DONE.**  
**M3 Parametric Sketch (#5): ACTIVE.**  
**M3M #57: M3 resume gate (001..008) COMPLETE; M3M-009 remains pre-M4.**

Accepted M3 slices: M3.1 solve/overlay, M3.2 Line, M3.3 Circle, M3.4 Arc, M3.5 Rectangle, M3.6A stable-ID selection/delete, M3.6B selected stable-ID rigid drag/translate (#75), M3.7A selected-Line Horizontal / Vertical constraints (#77), **M3.7B selected-Line Fixed with solved-geometry freeze (#79)**.

M3.6B is merged to `main` at `57c5e613`: typed `sketch.entity.translate`, transient PlaneGCS drag preview, fixed-entity guard, one pointer-up history commit, Esc cancel, Undo/Redo, Save/Open, and desktop/touch Line/Circle/Arc/Rectangle-edge regressions are accepted. OpenCascade stays lazy during Sketch drag.

M3.7A is merged to `main` at `1c5606cc`: `constraint.horizontal` / `constraint.vertical` are product actions for a selected Line through the shared desktop/mobile/search `CadUiAction` model. Application semantics reject non-Line targets, duplicate same-type constraints and direct H-vs-V conflict. Persisted constraint intent reconstructs the same solved PlaneGCS result after Undo/Redo and Save/Open; desktop Horizontal and touch Vertical browser regressions are accepted without loading OpenCascade.

M3.7B is merged to `main` at `b33087a1`: `constraint.fixed` is now a product action for a selected Line. The focused Sketch constraint controller re-solves the persisted Sketch through the lazy PlaneGCS adapter, passes only serializable solved Line geometry into one atomic `CadApplication` mutation, persists that solved geometry and creates Fixed together, preserves compatible H/V intent and stable IDs, rejects duplicate Fixed and fixed-entity drag, and survives Undo/Redo + Save/Open. Desktop/search and touch/mobile acceptance are green without loading OpenCascade.

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

## Repository health gate

Previous Full Repository Health Audit: **2026-09-14 — YELLOW ACCEPTED, no RED blocker for M3** (#57).

Since that audit, exactly three permanent product slices have been accepted:
1. M3.6B rigid entity drag/translate — #75;
2. M3.7A Horizontal / Vertical — #77;
3. M3.7B Fixed solved-geometry freeze — #79.

Per `DEVELOPMENT_QUALITY_GATES.md`, a new **Full Repository Health Audit is mandatory now before the next feature slice**. Feature work is paused until the audit returns GREEN or an explicitly accepted/non-growing YELLOW result.

Existing bounded YELLOW debt remains frozen unless the new audit changes it:
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
- protected Part and M3 Line/Circle/Arc/Rectangle/selection-delete/rigid-drag/H-V/Fixed desktop+touch regressions are green.

## Immediate next work

Run the **post-M3.7B Full Repository Health Audit** before opening another feature PR. At minimum it must re-check:
- first-party file budgets, frozen hotspot ratchets and new owner growth after M3.6B/M3.7A/M3.7B;
- command/registry truthfulness and application/runtime/UI ownership drift;
- browser-test duplication/context cost and generated/temp repository hygiene;
- saved-document/Sketch compatibility and protected M2/M3/Part regressions;
- issue/STATUS/documentation drift;
- whether any YELLOW debt has grown or become a RED blocker.

If that audit is GREEN or YELLOW-accepted, the next preferred product slice is **M3.7C — Coincident, Line endpoint ↔ Line endpoint first** because the typed command/DTO and PlaneGCS adapter already contain a Coincident seam while the registry still marks it planned. Keep the first slice narrow: two explicit stable entity IDs + endpoint refs (`a`/`b`), deterministic validation/duplicate rejection, transient selection state outside persistence, shared desktop/mobile/search action semantics, Undo/Redo, Save/Open, PlaneGCS-only browser acceptance. Do not broaden the same slice to parallel/perpendicular, mixed circle/arc refs, snapping, endpoint reshape, trim/extend, driving dimensions or M4.

Do not start broad M4 before M3M-009 and the required M3/M3X gates are complete.
