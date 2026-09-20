# ASA-CAD current status

Short execution state for humans and coding agents. Product/end state: `SYSTEM_SPEC.md`; technical boundaries: `ARCHITECTURE.md`; implementation/exit order: `ROADMAP.md` + `spec/process/milestone-gates.v1.json`; detailed history: GitHub issues.

Last synchronized: 2026-09-20.

Older issue/PR/status text is historical only; if it conflicts, use this file + the active issue under `DOCS_POLICY.md` precedence, not stale task wording.

## Current phase

**Gate A - DONE.**
**M2O - DONE.**
**M3 Parametric Sketch (#5): DONE.**
**M3M #57: 001..008 DONE; M3M-009 remains a hard pre-M4 gate.**

Protected document family: **six document kinds** - Part, Assembly, Drawing, Fragment, Specification and Text - behind `CadDocument` / `CadApplication`.

Accepted M3 includes Line/Circle/Arc/Rectangle, stable-ID selection/delete/drag, constraints through Point-on-curve, Construction Line, productized Linear/H/V/Diameter/Radius/Angular dimensions, solver-native PlaneGCS DoF, and visible under/fully/over-constrained state.

## Full Repository Health Audit #112

**YELLOW ACCEPTED - no RED blocker remains for bounded M3 work.**

Trigger: #109 M3-DIM-000 -> #110 M3-DIM-001A -> #111 M3-DIM-001B reached 3/3.

The audit found one RED blocker, `STATE-DIM-001`: `dimension.linear` was registry=`implemented` without a complete shared product path. #113 / PR #114 repaired it by productizing Linear for one selected Sketch Line with shared desktop/mobile/search action, Parameters, Cancel no-mutation, Undo/Redo, Save/Open and same-ID editing. PR #114 merged as `9d1dca92...`; M2 shell, M2 browser, M3 browser, Docker and baseline all passed on the merge SHA.

Frozen ratchets remain non-growing; no hard/frozen violation remains. Audit cadence resets to **0 / 3** at this closeout.

Bounded YELLOW debt:
1. `UI-SEARCH-001`: production search still exposes planned/deferred commands disabled instead of hiding them;
2. size/test pressure remains: M3M-009 owns frozen viewport/runtime hotspots; `useSketchConstraintControllers.ts` is near target; shared M3 browser harness must not grow; each new dimension family gets a separate focused browser spec;
3. repository hygiene/admin debt: root ignore policy, obsolete bootstrap workflow and historical branch clutter;
4. pinned vendor/toolchain security/runtime warnings remain bounded maintenance debt;
5. pre-M4 performance baselines, M3X shared golden host contract and root release license/notices remain required at their existing gates.

## Gate B closeout

Gate B and closure of umbrella M2 Issue #3 are not the same acceptance boundary. Issue #3 closes only after M2A + M2I + M2V reach their acceptance criteria. For broad M4, M2V is the hard Gate B blocker from the remaining M2 lanes.

Broad M4 is blocked until the remaining hard Gate B requirements are accepted:
- M2V KOMPAS visual acceptance;
- M3X shared ASA-CAD/ASA Lab golden fixtures;
- M3M-009;
- pre-M4 performance baselines.

M3 functional exit and the required 3/3 milestone health review are accepted.

The M3 exit contract is machine-readable in `spec/process/milestone-gates.v1.json`.

## M3 exit accepted

**M3 FUNCTIONAL EXIT — PASS.**

Accepted on main `71707127348a179a87add5369cf2d4f415a9e111` after PR #142.

- all 24/24 required M3 command IDs are implemented;
- all required driving dimensions are productized, including Angular;
- PlaneGCS native `dof()` provides meaningful non-null DoF;
- native PlaneGCS conflict/redundancy diagnostics drive visible under/fully/over-constrained state;
- stable-ID selection/delete and mouse/touch rigid drag remain browser-proven;
- central Undo/Redo and schema-compatible Save/Open/migrations remain green;
- desktop/mobile/search share the typed action path;
- post-merge CI on the M3 exit SHA passed M2 shell, M2 browser, M3 browser, Docker and baseline.

Post-#136 cadence reached **3 / 3** through Angular productization → native DoF → constraint-state UX. The milestone health review is **YELLOW ACCEPTED**: no RED blocker was found. Current pressure remains bounded/non-growing; in particular, no frozen ceiling was raised.

M3 Issue #5 may close as completed. M3 extension commands remain non-blocking unless deliberately reclassified.

## Full Repository Health Audit #123

**YELLOW ACCEPTED - no RED blocker remains for bounded M3 work.**

`STATE-SCHEMA-RELEASE-001` was repaired by #125 / PR #126: production schema, machine policy and shipped release metadata now converge on v2; M2-shell and Docker permanently verify that identity.

Remaining bounded YELLOW debt includes schema-guard brittleness, UI search visibility, size/test pressure, repository hygiene/toolchain/dependency maintenance, and the existing pre-M4 performance/M3X/legal gates.

SCHEMA-GENERALITY-001 is accepted; `SCHEMA-GUARD-001` regex/source-layout brittleness remains YELLOW.

## Full Repository Health Audit #136

**YELLOW ACCEPTED - no RED blockers remain.**

`DIM-LINEAR-FINITE-001` was repaired by PR #138, merged as `5a90d6a34eb823a899f4842a2d332eb1fed42b12`. Post-merge CI on that merge SHA passed **5 / 5**: M2 shell, M2 browser, M3 browser, Docker and baseline.

Feature freeze was lifted after Audit #136. The subsequent three accepted M3 slices were Angular productization, solver-native DoF and constraint-state UX; those now satisfy the machine M3 exit contract.

M3 extension commands do not block M3 unless deliberately reclassified.

Optimization cadence is iteration-based: every permanent slice gets a Slice Quality Gate; repeated owner pressure triggers focused review; every three accepted permanent slices or milestone boundary triggers a Full Repository Health Audit.
