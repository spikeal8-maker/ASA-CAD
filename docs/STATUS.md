# ASA-CAD current status

Short execution state for humans and coding agents. Product/end state: `SYSTEM_SPEC.md`; technical boundaries: `ARCHITECTURE.md`; implementation order: `ROADMAP.md`; detailed history: GitHub issues.

Last synchronized: 2026-09-16.

## Current phase

**Gate A — DONE.**  
**M2O — DONE.**  
**M3 Parametric Sketch (#5): ACTIVE.**  
**M3M #57: 001..008 DONE; M3M-009 remains a hard pre-M4 gate.**

Accepted M3 slices: M3.1 solve/overlay; M3.2 Line; M3.3 Circle; M3.4 Arc; M3.5 Rectangle; M3.6A stable-ID selection/delete; M3.6B rigid drag/translate (#75); M3.7A Horizontal/Vertical (#77); M3.7B Fixed solved-geometry freeze (#79); M3.7C Line endpoint Coincident (#83); M3.7D Line↔Line Parallel (#85); M3.7E Line↔Line Perpendicular (#87); **Tangent Line↔Circle (#90)**.

Tangent merged as `9d8bd3d1` after all five workflows passed on final review SHA `f5eb0cc1`: M2 shell, M3 browser, M2 browser, Docker and baseline. It persists canonical stable `[Line, Circle]` IDs, rejects self/invalid/duplicate pairs before mutation, uses existing PlaneGCS `TANGENT`/`tangent_lc`, exposes the same desktop/mobile/search action contract, and preserves Undo/Redo + Save/Open semantics. Line↔Arc and curve↔curve Tangent remain intentionally out of scope.

## Full Repository Health Audit after M3.7E — #88/#89

**YELLOW ACCEPTED — no RED blocker for narrow M3 work.**

Audit cadence after that accepted audit: **1 / 3 permanent feature slices** (Tangent). Run the next Full Repository Health Audit after three accepted post-audit slices or at a milestone boundary, whichever comes first.

Audit repair evidence:
- `SketchConstraintCommandHandlers.ts`: 10,131 B → 8,737 B;
- new `SketchLinePairConstraintOwner.ts`: focused Parallel/Perpendicular validation + persistence;
- `CadShellTop.tsx`: 10,224 B → 5,477 B;
- new `CadShellCommandGroups.tsx`: focused Sketch/Part/View ribbon composition;
- Tangent additionally reduced `App.tsx` 17,187 B → 16,992 B and lowered its exact ratchet; `M3BrowserHarness.mjs` stayed unchanged;
- no file-budget ceiling was raised.

Bounded/non-growing YELLOW debt:
1. M3M-009: `CadViewport.tsx`, `OpenCascadePartRuntime.ts` and remaining pre-M4 frozen hotspots;
2. pinned vendor/toolchain modernization before beta: install currently reports 1 moderate + 3 high vulnerabilities; GitHub Actions v4 runtime emits the Node-20 deprecation warning;
3. root product license / third-party notice decision before public beta/release;
4. ASA-CAD ↔ ASA Lab golden host-contract preflight (M3X) before broad M4/M5;
5. large history/topology/runtime scale benchmarks in M4/M4B.

## Protected architecture / regressions

- six ASA document kinds behind `CadDocument` / `CadApplication`;
- `CadProjectSession -> CadProjectHost`; no browser/kernel persistence authority;
- centralized application history/rollback and shared desktop/mobile/search actions;
- focused Sketch geometry/edit/constraint/Line-pair/Tangent/dimension owners;
- stable-ID selection/drag and binary-constraint selection stay transient;
- PlaneGCS/OpenCascade stay lazy; no persisted solver/OCC/Three objects;
- protected Part and M3 Line/Circle/Arc/Rectangle/selection/delete/drag/H-V/Fixed/Coincident/Parallel/Perpendicular/Tangent regressions are green.

## Next M3 slice

**Concentric — Circle ↔ Circle only.**

Scope: two distinct Circle entities in the same Sketch; persisted stable IDs; duplicate/self/type/cross-Sketch rejection; existing PlaneGCS `CONCENTRIC` center-coincidence substrate; shared desktop/mobile/search action; transient two-Circle selection; Undo/Redo + Save/Open + focused browser acceptance. Circle↔Arc and Arc↔Arc combinations stay out of this first Concentric slice.

After Concentric, authoritative registry order continues: `constraint.equal` → `constraint.symmetric` → `constraint.pointOnCurve`, then required construction geometry, remaining editing and driving dimensions/DOF diagnostics according to `ROADMAP.md`.

Do not start broad M4 before M3M-009 and green M3/M3X entry gates.
