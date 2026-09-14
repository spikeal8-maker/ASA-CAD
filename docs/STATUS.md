# ASA-CAD current status

Short repository state for humans and coding agents. ASA-CAD keeps **six first-class document kinds**; product/end state: `SYSTEM_SPEC.md`; technical boundary: `ARCHITECTURE.md`; sequence: `ROADMAP.md`; detailed history: GitHub issues.

Last synchronized: 2026-09-14.

## Current phase

**Gate A — ASA CAD Core: DONE.**  
**M2O — Architecture Optimization Gate (#21): DONE.**  
**M3 Parametric Sketch (#5): READY TO RESUME after this review merges.**  
**M3M #57: M3 resume gate (001..008) COMPLETE; M3M-009 remains pre-M4.**

Accepted M3 slices: M3.1 solve/overlay, M3.2 Line, M3.3 Circle, M3.4 Arc, M3.5 Rectangle, M3.6A stable-ID selection/delete.

The discarded M3.6B draft PR #56 must not be revived; restart rigid drag from current `main` as a clean slice.

## Maintenance gate #57

1. M3M-001 file budgets/rules — DONE (#58);
2. M3M-002 focused Part/Sketch workspace owners — DONE (#60);
3. M3M-003 `SketchEditingStage` extraction — DONE (#61);
4. M3M-004 shell extraction / App ratchet — DONE (#62);
5. M3M-005 domain CSS split — DONE (#63);
6. M3M-006 Sketch geometry/edit/constraint/dimension command owners — DONE (#71);
7. **M3M-007 shared M3 browser harness; focused specs <=8 KB — DONE (this review);**
8. M3M-008 agent-context/doc cleanup + permanent quality gates — DONE (#64 plus this audit compaction);
9. **M3M-009 viewport/runtime frozen-hotspot closeout — required before broad M4.**

## Full Repository Health Audit — YELLOW accepted

No RED blocker remains for M3. Existing debt is frozen/non-growing and has explicit later gates:
- `CadViewport.tsx` / `OpenCascadePartRuntime.ts` and remaining oversized first-party owners/tests: M3M-009 / Gate-B-to-M4 closeout;
- pinned vendor dependency/security review + GitHub Actions Node-runtime modernization: upstream/M4B pre-beta maintenance;
- public-repository root license / third-party notice decision: release hygiene before beta/public release;
- ASA-CAD ↔ ASA Lab golden host-contract preflight and scale/history benchmarks: before broad M4/M5 and M4B respectively.

Audit cleanup completed in this review: M3 browser duplication removed; old M3 test exceptions removed; quality contract <12 KB; `AGENTS.md` <5 KB; full system/architecture docs are no longer mandatory context for unrelated localized edits.

## Protected architecture / regressions

- six ASA document kinds behind `CadDocument` / `CadApplication`; `CadProjectSession -> CadProjectHost`;
- shared desktop/mobile typed actions and centralized application history;
- focused Sketch stage/command owners and shared `SketchInteractionSurface`;
- M3 browser infrastructure centralized in `M3BrowserHarness.mjs` while tool assertions remain separate;
- client-side lazy PlaneGCS/OpenCascade; no persisted OCC/Three/WASM objects;
- protected Part workflow and M3 Line/Circle/Arc/Rectangle/selection-delete desktop/touch regressions remain green.

## Immediate next work

After this review merges, start **a new clean M3.6B rigid entity-drag slice** from current `main`. Do not reuse PR #56. End that slice with the normal Slice Quality Gate. Do not start broad M4 before M3M-009.
