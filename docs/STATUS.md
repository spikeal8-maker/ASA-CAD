# ASA-CAD current status

Short execution state for humans and coding agents. Product/end state: `SYSTEM_SPEC.md`; technical boundaries: `ARCHITECTURE.md`; implementation/exit order: `ROADMAP.md` + `spec/process/milestone-gates.v1.json`; detailed history: GitHub issues.

Last synchronized: 2026-09-18.

Older issue/PR/status text is historical only; if it conflicts, use this file + the active issue under `DOCS_POLICY.md` precedence, not stale task wording.

## Current phase

**Gate A - DONE.**
**M2O - DONE.**
**M3 Parametric Sketch (#5): ACTIVE after the accepted post-Construction health gate.**
**M3M #57: 001..008 DONE; M3M-009 remains a hard pre-M4 gate.**

Protected document family: **six document kinds** - Part, Assembly, Drawing, Fragment, Specification and Text - behind `CadDocument` / `CadApplication`.

Accepted M3 includes Line/Circle/Arc/Rectangle, stable-ID selection/delete/drag, the constraint family through Point-on-curve, Construction Line (#103), and productized Horizontal/Vertical driving dimensions through shared desktop/mobile/search actions.

Construction #103 passed all five workflows on review SHA `d513edbb` and merged as `953fc235`. It persists a dedicated construction boolean, remains PlaneGCS geometry, is visually distinct, is excluded from protected Part profile eligibility, and preserves Undo/Redo + Save/Open.

## Full Repository Health Audit after Construction - #104/#105/#106

**YELLOW ACCEPTED - no RED blocker remains for bounded M3 work.**

- #105 repaired four real Cyrillic mojibake UI strings and added permanent UTF-8 hygiene scanning;
- #106 added the mandatory bot entry protocol, blocking state-drift rule, machine M3/Gate-B exit policy and iteration-based optimization;
- final governance head `4ae5fd1` passed M2 shell, M2 browser, M3 browser, Docker and baseline;
- no file-budget ceiling was raised;
- audit cadence reset to **0 / 3** at this accepted audit boundary.

Bounded/non-growing YELLOW debt:
1. M3M-009: `CadViewport.tsx`, `OpenCascadePartRuntime.ts` and remaining pre-M4 hotspots;
2. `useSketchConstraintControllers.ts` is near target and must be decomposed before broad new constraint responsibility;
3. pinned vendor/toolchain modernization: current audit has 1 moderate + 3 high dependency findings and the known Actions runtime warning;
4. root product LICENSE / THIRD_PARTY_NOTICE before public beta/release;
5. M3X ASA-CAD <-> ASA Lab shared golden host contract is not yet proven;
6. large history/topology/runtime scale benchmarks remain required before/through M4/M4B.

## Current iteration cadence

After the post-Construction audit reset, accepted permanent slices #109 (M3-DIM-000) and #110 (M3-DIM-001A) account for **2 / 3**. Acceptance of this H/V productization slice is the third permanent slice and therefore reaches **3 / 3**; the required Full Repository Health Audit is the next action before another feature slice.

## Gate B closeout

Gate B and closure of umbrella M2 Issue #3 are not the same acceptance boundary. Issue #3 closes only after M2A + M2I + M2V reach their acceptance criteria. For broad M4, M2V is the hard Gate B blocker from the remaining M2 lanes; M2A is supporting visual/fixture evidence and is required wherever that evidence is needed to accept M2V; M2I is a parallel advanced-interaction lane and does not itself block broad M4 unless a specific M2I criterion is explicitly promoted into Gate B.

Broad M4 is blocked until all hard Gate B requirements are accepted:
- M2V KOMPAS visual acceptance;
- M3 machine exit contract;
- M3X shared ASA-CAD/ASA Lab golden fixtures;
- M3M-009;
- pre-M4 performance baselines;
- Full Repository Health Audit.

The M3 exit contract is machine-readable in `spec/process/milestone-gates.v1.json`. Required missing work must be selected from that contract, not inferred from registry order.

## Next M3 work

After acceptance of the H/V productization slice, run the required Full Repository Health Audit before another feature slice. M3 remains ACTIVE; do not declare M3 exit.

Remaining required dimension product gaps are Angular, Radius, Diameter productization, plus a focused check/closeout of remaining Linear product completeness. Meaningful under/fully/over-constrained diagnostics and DOF feedback also remain required.

M3 extension commands (polyline/polygon/ellipse/spline/point, trim/extend/split/offset/fillet/chamfer/mirror/move/rotate/scale/project, `dimension.auto`) do not block M3 unless deliberately reclassified.

Optimization cadence is iteration-based: every slice gets a Slice Quality Gate; repeated owner pressure triggers a focused owner review; every three accepted permanent slices or milestone boundary triggers a Full Repository Health Audit.
