# ASA-CAD current status

Short execution state for humans and coding agents. Product/end state: `SYSTEM_SPEC.md`; technical boundaries: `ARCHITECTURE.md`; implementation order: `ROADMAP.md`; detailed history: GitHub issues.

Last synchronized: 2026-09-16.

## Current phase

**Gate A — DONE.**  
**M2O — DONE.**  
**M3 Parametric Sketch (#5): ACTIVE after the accepted post-Equal health gate.**
**M3M #57: 001..008 DONE; M3M-009 remains a hard pre-M4 gate.**

Accepted M3 slices: M3.1 solve/overlay; M3.2 Line; M3.3 Circle; M3.4 Arc; M3.5 Rectangle; M3.6A stable-ID selection/delete; M3.6B rigid drag/translate (#75); M3.7A Horizontal/Vertical (#77); M3.7B Fixed (#79); M3.7C Coincident (#83); M3.7D Parallel (#85); M3.7E Perpendicular (#87); Tangent Line↔Circle (#90); Concentric Circle↔Circle (#92); **Equal Line↔Line (#96)**.

Equal merged as `3c1db4bf` after all five workflows passed on final review SHA `96457803`: M2 shell, M3 browser, M2 browser, Docker and baseline. It persists stable Line IDs, rejects invalid/duplicate pairs before mutation, uses PlaneGCS `EQUAL` → `equal_length`, shares desktop/mobile/search actions and the whole-Line picker, and preserves Undo/Redo + Save/Open. Circle/Arc equal-radius variants remain out of scope.

## Full Repository Health Audit after Equal — #97

**YELLOW ACCEPTED — no RED blocker for the next narrow M3 slice.**

Audit cadence is reset to **0 / 3 permanent feature slices** after this accepted audit. Run the next Full Repository Health Audit after three accepted slices or at a milestone boundary, whichever comes first.

Audit repair/evidence:
- repository hygiene and exact frozen ratchets PASS;
- `SketchConstraintCommandHandlers.ts`: 9,772 B → 7,859 B;
- new `SketchCoincidentConstraintOwner.ts`: 2,505 B focused endpoint validation/persistence;
- `SketchLinePairConstraintOwner.ts`: 2,280 B; shared Parallel/Perpendicular/Equal ownership remains compact;
- `useSketchConstraintControllers.ts`: 7,295 B; `CoincidentPartModelStage.tsx`: 3,939 B;
- `App.tsx` remains exactly 16,992 B; `M3BrowserHarness.mjs` remains exactly 7,993 B;
- UTF-8 scan of 259 tracked first-party `src/tests/docs/spec` files found no mojibake/replacement-character corruption;
- full M3 and Coincident ownership regression are green after the repair; no file-budget ceiling was raised.

Bounded/non-growing YELLOW debt:
1. M3M-009: `CadViewport.tsx`, `OpenCascadePartRuntime.ts` and remaining pre-M4 frozen hotspots;
2. pinned vendor/toolchain modernization before beta: current audit still reports 1 moderate + 3 high npm vulnerabilities; Actions remain on `checkout/setup-node@v4` with the known runtime deprecation warning;
3. root product license / third-party notice decision before public beta/release;
4. ASA-CAD ↔ ASA Lab M3X golden host-contract preflight: ASA-CAD has `CadProjectHost`, `baseRevision`, `mutationId`, conflict/recovery semantics and tests, but matching cross-repo golden fixtures / ASA Lab compatibility are not yet proven;
5. large history/topology/runtime scale benchmarks remain M4/M4B work.

## Protected architecture / regressions

- six ASA document kinds behind `CadDocument` / `CadApplication`;
- `CadProjectSession -> CadProjectHost`; no browser/kernel persistence authority;
- centralized application history/rollback and shared desktop/mobile/search actions;
- focused Sketch geometry/edit/unary constraint/Line-pair/Tangent/Concentric/Coincident/dimension owners;
- stable-ID selection/drag and binary-constraint selection stay transient;
- PlaneGCS/OpenCascade stay lazy; no persisted solver/OCC/Three objects;
- protected Part and all accepted M3 geometry/edit/constraint regressions through Equal are green.

## Next M3 work

Feature work may resume only after this audit-maintenance PR itself is merged with green CI.

The authoritative registry next points to `constraint.symmetric`, then `constraint.pointOnCurve`. Before implementation, verify the actual PlaneGCS/typed-command seam and choose one narrow operand scope; do not infer or broaden Symmetry semantics from registry order alone.

Do not start broad M4 before M3M-009 and green M3/M3X entry gates.
