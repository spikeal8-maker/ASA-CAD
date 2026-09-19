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

Accepted M3 includes Line/Circle/Arc/Rectangle, stable-ID selection/delete/drag, the constraint family through Point-on-curve, Construction Line, and productized Linear/Horizontal/Vertical/Diameter/Radius driving dimensions through shared desktop/mobile/search actions.

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

M3-DIM-003B is accepted: Radius driving dimension is productized end-to-end for selected Circle or Arc.

- shared desktop/mobile/search CadUiAction;
- Circle starts from diameter / 2;
- Arc starts from persisted radius;
- Cancel is no-mutation;
- Undo/Redo, Save/Open and same-ID editing are browser-proven;
- `dimension.radius` registry status is `implemented`;
- schema remains v2; migration/release/vendor semantics are unchanged.

Required product/capability gaps remain:
- Angular dimension;
- meaningful non-null DoF;
- visible under/fully/over-constrained diagnostics.

## Full Repository Health Audit #123

**YELLOW ACCEPTED - no RED blocker remains for bounded M3 work.**

`STATE-SCHEMA-RELEASE-001` was repaired by #125 / PR #126: production schema, machine policy and shipped release metadata now converge on v2; M2-shell and Docker permanently verify that identity.

Remaining bounded YELLOW debt includes schema-guard brittleness, UI search visibility, size/test pressure, repository hygiene/toolchain/dependency maintenance, and the existing pre-M4 performance/M3X/legal gates.

Feature work may resume in bounded M3 slices. Audit #123 reset the cadence to 0 / 3; after accepted M3-DIM-003B and SCHEMA-GENERALITY-001 the cadence is **2 / 3**. Angular remains the only required Dimension product gap.

SCHEMA-GENERALITY-001 is accepted: machine policy versions document kinds, Sketch entity kinds, Constraint kinds and Dimension kinds for every schema. `SCHEMA-GUARD-001` remains YELLOW because source extraction is still regex/source-layout based.

M3 remains ACTIVE; do not declare M3 exit until the complete machine exit contract is accepted.

M3 extension commands do not block M3 unless deliberately reclassified.

Optimization cadence is iteration-based: every permanent slice gets a Slice Quality Gate; repeated owner pressure triggers focused review; every three accepted permanent slices or milestone boundary triggers a Full Repository Health Audit.
