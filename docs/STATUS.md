# ASA-CAD current status

Short execution state for humans and coding agents. Product/end state: `SYSTEM_SPEC.md`; technical boundaries: `ARCHITECTURE.md`; implementation/exit order: `ROADMAP.md` + `spec/process/milestone-gates.v1.json`; detailed history: GitHub issues.

Last synchronized: 2026-09-18.

Older issue/PR/status text is historical only; if it conflicts, use this file + the active issue under `DOCS_POLICY.md` precedence, not stale task wording.

## Current phase

**Gate A - DONE.**
**M2O - DONE.**
**M3 Parametric Sketch (#5): ACTIVE.**
**M3M #57: 001..008 DONE; M3M-009 remains a hard pre-M4 gate.**

Protected document family: **six document kinds** - Part, Assembly, Drawing, Fragment, Specification and Text - behind `CadDocument` / `CadApplication`.

Accepted M3 includes Line/Circle/Arc/Rectangle, stable-ID selection/delete/drag, the constraint family through Point-on-curve, Construction Line, and productized Linear/Horizontal/Vertical/Diameter driving dimensions through shared desktop/mobile/search actions. Radius persisted/core support is accepted on schema v2, but Radius productization remains open.

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

Broad M4 is blocked until all hard Gate B requirements are accepted:
- M2V KOMPAS visual acceptance;
- M3 machine exit contract;
- M3X shared ASA-CAD/ASA Lab golden fixtures;
- M3M-009;
- pre-M4 performance baselines;
- required Full Repository Health Audit.

The M3 exit contract is machine-readable in `spec/process/milestone-gates.v1.json`.

## Current M3 gate

M3-DIM-003A is accepted: Radius persisted/core support is implemented on CadDocument schema v2.

- `CAD_DOCUMENT_SCHEMA_VERSION = 2`;
- schema-v1 Dimension grammar remains frozen as `linear | horizontal | vertical | diameter`;
- schema-v2 adds `radius`;
- built-in migration `1 -> 2` preserves valid v1 content and advances only `schemaVersion`;
- Circle/Arc Radius DTO/command/PlaneGCS core is accepted;
- `dimension.radius` remains registry=`planned` until productization.

Required product/capability gaps remain:
- Radius productization;
- Angular dimension;
- meaningful non-null DoF;
- visible under/fully/over-constrained diagnostics.

Cadence remains **3 / 3**. Feature work is frozen.

## Full Repository Health Audit #123 — RED / blocking repair active

Audit #123 is controller-accepted **RED** on `STATE-SCHEMA-RELEASE-001`: production/schema policy is v2 while shipped release metadata still advertises schema v1.

Active bounded repair: **#125 — AUD-R1-RELEASE-SCHEMA-CONVERGENCE**.

Do not start Radius productization, Angular, DoF, constraint-state UX or another feature slice while Audit #123 remains RED. Radius remains registry=`planned`; Radius productization and Angular remain open.

Cadence remains **3 / 3** and is not reset by this repair candidate.

M3 remains ACTIVE; do not declare M3 exit until the complete machine exit contract is accepted.

M3 extension commands do not block M3 unless deliberately reclassified.

Optimization cadence is iteration-based: every permanent slice gets a Slice Quality Gate; repeated owner pressure triggers focused review; every three accepted permanent slices or milestone boundary triggers a Full Repository Health Audit.
