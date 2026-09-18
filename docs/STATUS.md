# ASA-CAD current status

Short execution state for humans and coding agents. Product/end state: `SYSTEM_SPEC.md`; technical boundaries: `ARCHITECTURE.md`; implementation/exit order: `ROADMAP.md` + `spec/process/milestone-gates.v1.json`; detailed history: GitHub issues.

Last synchronized: 2026-09-18.

## Current phase

**Gate A вЂ” DONE.**
**M2O вЂ” DONE.**
**M3 Parametric Sketch (#5): ACTIVE after the post-Construction health gate.**
**M3M #57: 001..008 DONE; M3M-009 remains a hard pre-M4 gate.**`n`nProtected document family: **six document kinds** — Part, Assembly, Drawing, Fragment, Specification and Text — behind `CadDocument` / `CadApplication`.

Accepted M3 includes Line/Circle/Arc/Rectangle, stable-ID selection/delete/drag, the required current constraint family through Point-on-curve, and **Construction Line (#103)**.

Construction #103 passed all five workflows on review SHA `d513edbb` and merged as `953fc235`. It persists a dedicated construction boolean, stays PlaneGCS geometry, is visually distinct, is excluded from protected Part profile eligibility, and preserves Undo/Redo + Save/Open.

## Full Repository Health Audit after Construction вЂ” #104/#105

**YELLOW ACCEPTED by the audit repair + governance closeout; no RED blocker remains for bounded M3 work.**

Audit cadence resets to **0 / 3** only when this governance closeout merges.

Audit repair:
- #105 fixed four real Cyrillic mojibake UI strings and added a permanent UTF-8/mojibake hygiene guard;
- repository hygiene, exact ratchets, TypeScript, full M2O/M3, browser, Docker and baseline remain green;
- no file-budget ceiling was raised;
- iteration-based owner optimization and machine milestone exit policy are now binding.

Bounded/non-growing YELLOW debt:
1. M3M-009: `CadViewport.tsx`, `OpenCascadePartRuntime.ts` and remaining pre-M4 hotspots;
2. `useSketchConstraintControllers.ts` is near its controller target and must be decomposed before broad new constraint responsibility;
3. pinned vendor/toolchain modernization: current audit still has 1 moderate + 3 high dependency findings and the known Actions runtime warning;
4. root product LICENSE / THIRD_PARTY_NOTICE before public beta/release;
5. M3X ASA-CAD в†” ASA Lab shared golden host contract is not yet proven;
6. large history/topology/runtime scale benchmarks remain required before/through M4/M4B.

## Gate B closeout

Broad M4 is blocked until all are accepted:
- M2V KOMPAS visual acceptance;
- M3 machine exit contract;
- M3X shared ASA-CAD/ASA Lab golden fixtures;
- M3M-009;
- pre-M4 performance baselines;
- Full Repository Health Audit.

The M3 exit contract is machine-readable in `spec/process/milestone-gates.v1.json`. Required missing work must be selected from that contract, not inferred from registry order.

## Next M3 work

After this governance closeout merges, choose **one bounded required M3-exit slice**. Current required gaps are primarily driving-dimension coverage and meaningful under/fully/over-constrained + DOF feedback. M3 extension commands (polyline/polygon/ellipse/spline/point, trim/extend/split/offset/fillet/chamfer/mirror/move/rotate/scale/project, `dimension.auto`) do not block M3 unless deliberately reclassified.

Optimization cadence is iteration-based: every slice gets a Slice Quality Gate; repeated owner pressure triggers a focused owner review; every three accepted permanent slices or milestone boundary triggers a Full Repository Health Audit.
