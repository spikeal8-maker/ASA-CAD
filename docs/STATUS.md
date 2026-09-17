# ASA-CAD current status

Short execution state for humans and coding agents. Product/end state: `SYSTEM_SPEC.md`; technical boundaries: `ARCHITECTURE.md`; implementation order: `ROADMAP.md`; detailed history: GitHub issues.

Last synchronized: 2026-09-17.

## Current phase

**Gate A — DONE.**
**M2O — DONE.**
**M3 Parametric Sketch (#5): ACTIVE.**
**M3M #57: 001..008 DONE; M3M-009 remains a hard pre-M4 gate.**

Accepted M3 slices: M3.1 solve/overlay; M3.2 Line; M3.3 Circle; M3.4 Arc; M3.5 Rectangle; M3.6A stable-ID selection/delete; M3.6B rigid drag/translate (#75); M3.7A Horizontal/Vertical (#77); M3.7B Fixed (#79); M3.7C Coincident (#83); M3.7D Parallel (#85); M3.7E Perpendicular (#87); Tangent Line↔Circle (#90); Concentric Circle↔Circle (#92); Equal Line↔Line (#96); **Symmetry endpoint↔endpoint about Line (#99)**.

Symmetry merged as `6fbac278` after all five workflows passed on final review SHA `1f3a6a6c`: M2 shell, M3 browser, M2 browser, Docker and baseline. It persists canonical stable Line endpoint refs plus a distinct Line-axis ID, rejects invalid/self/duplicate/cross-Sketch selections, uses existing PlaneGCS `SYMMETRY` → `p2p_symmetric_ppl`, shares desktop/mobile/search actions, and preserves Undo/Redo + Save/Open. Circle/Arc centers and generalized symmetry stay out of scope.

## Full Repository Health Audit after Equal — #97/#98

**YELLOW ACCEPTED — no RED blocker for narrow M3 work.**

Audit cadence after that accepted gate: **1 / 3 permanent feature slices** (Symmetry). Run the next Full Repository Health Audit after three accepted post-audit slices or at a milestone boundary, whichever comes first.

Audit repair/evidence:
- repository hygiene and exact frozen ratchets PASS;
- `SketchConstraintCommandHandlers.ts`: 9,772 B → 7,859 B;
- `SketchCoincidentConstraintOwner.ts`: focused endpoint validation/persistence;
- `SketchLinePairConstraintOwner.ts`: focused Parallel/Perpendicular/Equal ownership;
- `App.tsx` remains exactly 16,992 B; `M3BrowserHarness.mjs` remains exactly 7,993 B;
- UTF-8 first-party scan found no mojibake/replacement-character corruption;
- no file-budget ceiling was raised.

Bounded/non-growing YELLOW debt:
1. M3M-009: `CadViewport.tsx`, `OpenCascadePartRuntime.ts` and remaining pre-M4 frozen hotspots;
2. pinned vendor/toolchain modernization before beta: 1 moderate + 3 high npm audit findings and the known Actions runtime warning;
3. root product license / third-party notice decision before public beta/release;
4. ASA-CAD ↔ ASA Lab M3X golden host-contract compatibility before broad M4/M5;
5. large history/topology/runtime scale benchmarks remain M4/M4B work.

## Protected architecture / regressions

- six ASA document kinds behind `CadDocument` / `CadApplication`;
- `CadProjectSession -> CadProjectHost`; no browser/kernel persistence authority;
- centralized history/rollback and shared desktop/mobile/search actions;
- focused Sketch geometry/edit/constraint owners; transient selection never becomes persisted authority;
- PlaneGCS/OpenCascade stay lazy; no persisted solver/OCC/Three objects;
- protected Part and all accepted M3 geometry/edit/constraint regressions through Symmetry are green.

## Next M3 slice

**Point-on-curve — Line endpoint (`a`/`b`) on a different Line only.**

Scope: stable endpoint ref + stable target Line ID in one Sketch; endpoint-owner Line and target Line must be distinct; duplicate/self/type/cross-Sketch selections reject atomically; ASA runtime maps the persisted intent to the existing PlaneGCS `point_on_line_pl` substrate; shared desktop/mobile/search action; transient 2-step endpoint → target-Line selection; Undo/Redo + Save/Open + focused browser acceptance. Circle/Arc targets and generalized point kinds stay out of this first slice.

After this slice, authoritative registry order proceeds into remaining construction geometry/editing/driving dimensions/DOF diagnostics according to `ROADMAP.md`; do not infer broad scope from registry order alone.

Do not start broad M4 before M3M-009 and green M3/M3X entry gates.
