# ASA-CAD current status

Short execution state for humans and coding agents. Product/end state: `SYSTEM_SPEC.md`; technical boundaries: `ARCHITECTURE.md`; implementation order: `ROADMAP.md`; detailed history: GitHub issues.

Last synchronized: 2026-09-16.

## Current phase

**Gate A — DONE.**  
**M2O — DONE.**  
**M3 Parametric Sketch (#5): ACTIVE.**  
**M3M #57: 001..008 DONE; M3M-009 remains a hard pre-M4 gate.**

Accepted M3 slices: M3.1 solve/overlay; M3.2 Line; M3.3 Circle; M3.4 Arc; M3.5 Rectangle; M3.6A stable-ID selection/delete; M3.6B rigid drag/translate (#75); M3.7A Horizontal/Vertical (#77); M3.7B Fixed solved-geometry freeze (#79); M3.7C Line endpoint Coincident (#83); M3.7D Line↔Line Parallel (#85); **M3.7E Line↔Line Perpendicular (#87)**.

M3.7E merged as `951d4452` after all five workflows passed on final review SHA `f421739c`: M2 shell, M3 browser, M2 browser, Docker and baseline. It persists two stable Line IDs, rejects invalid/self/symmetric-duplicate pairs, uses existing PlaneGCS `PERPENDICULAR`, shares the Line-pair interaction lifecycle with Parallel, and preserves Undo/Redo + Save/Open semantics.

## Full Repository Health Audit after M3.7E — #88/#89

**YELLOW ACCEPTED — no RED blocker for the next narrow M3 slice after issue synchronization.**

Audit repair evidence:
- `SketchConstraintCommandHandlers.ts`: 10,131 B → 8,737 B;
- new `SketchLinePairConstraintOwner.ts`: focused Parallel/Perpendicular validation + persistence;
- `CadShellTop.tsx`: 10,224 B → 5,477 B;
- new `CadShellCommandGroups.tsx`: focused Sketch/Part/View ribbon composition;
- `App.tsx`, `usePartSketchWorkspace.ts` and `M3BrowserHarness.mjs` did not grow;
- no file-budget ceiling was raised;
- M2 shell, M3 browser through Perpendicular, M2 browser, Docker and baseline all passed on audited review tree `ebfbfc17` before final status synchronization.

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
- focused Sketch geometry/edit/constraint/Line-pair/dimension owners;
- stable-ID selection/drag and binary-constraint selection stay transient;
- PlaneGCS/OpenCascade stay lazy; no persisted solver/OCC/Three objects;
- protected Part and M3 Line/Circle/Arc/Rectangle/selection/delete/drag/H-V/Fixed/Coincident/Parallel/Perpendicular regressions are green.

## Next M3 planning

Do not invent a numbered next slice before #5 is updated. Remaining planned M3 geometric constraints in registry order begin: **Tangent → Concentric → Equal → Symmetry → Point-on-curve**. Select one as a narrow vertical slice, then continue remaining Sketch geometry/editing/driving dimensions.

Do not start broad M4 before M3M-009 and green M3/M3X entry gates.
