# ASA-CAD current status

Short execution state for humans and coding agents. Product/end state: `SYSTEM_SPEC.md`; technical boundaries: `ARCHITECTURE.md`; implementation/exit order: `ROADMAP.md` + `spec/process/milestone-gates.v1.json`; detailed history: GitHub issues.

Last synchronized: 2026-09-19.

Older issue/PR/status text is historical only; if it conflicts, use this file + the active issue under `DOCS_POLICY.md` precedence, not stale task wording.

## Current phase

**Gate A - DONE.**
**M2O - DONE.**
**M3 Parametric Sketch (#5): ACTIVE.**
**M3M #57: 001..008 DONE; M3M-009 remains a hard pre-M4 gate.**

Protected document family: **six document kinds** - Part, Assembly, Drawing, Fragment, Specification and Text - behind `CadDocument` / `CadApplication`.

Accepted M3 includes Line/Circle/Arc/Rectangle, stable-ID selection/delete/drag, constraints through Point-on-curve, Construction Line, productized Linear/H/V/Diameter/Radius dimensions, and Angular persisted/core support on schema v3.

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

M3-DIM-004A is accepted: Angular persisted/core support is implemented on CadDocument schema v3.

- schema-v1/v2 grammars remain frozen; v3 adds only `angular` to Dimension grammar;
- migration `2 -> 3` preserves valid v2 content and rejects illegal Angular-in-v2 before bump;
- Angular = two distinct Lines, degrees, `0 < value < 180`;
- typed command/handler and PlaneGCS ANGLE core are accepted;
- source/policy/release identity = schema 3;
- `dimension.angular` remains registry=`planned`; product UI is still open.

Required M3 gaps:
- Angular productization;
- meaningful non-null DoF;
- visible under/fully/over-constrained diagnostics.

## Full Repository Health Audit #123

**YELLOW ACCEPTED - no RED blocker remains for bounded M3 work.**

`STATE-SCHEMA-RELEASE-001` was repaired by #125 / PR #126: production schema, machine policy and shipped release metadata now converge on v2; M2-shell and Docker permanently verify that identity.

Remaining bounded YELLOW debt includes schema-guard brittleness, UI search visibility, size/test pressure, repository hygiene/toolchain/dependency maintenance, and the existing pre-M4 performance/M3X/legal gates.

SCHEMA-GENERALITY-001 is accepted; `SCHEMA-GUARD-001` regex/source-layout brittleness remains YELLOW.

## Full Repository Health Audit #136

**YELLOW ACCEPTED - no RED blockers remain.**

`DIM-LINEAR-FINITE-001` was repaired by PR #138, merged as `5a90d6a34eb823a899f4842a2d332eb1fed42b12`. Post-merge CI on that merge SHA passed **5 / 5**: M2 shell, M2 browser, M3 browser, Docker and baseline.

Feature freeze is **lifted**. Audit cadence resets to **0 / 3**.

M3 remains **ACTIVE**. Required M3 gaps remain open:
- Angular productization;
- meaningful non-null DoF;
- visible under/fully/over-constrained diagnostics.

Do not declare M3 exit until the complete machine exit contract is accepted.

M3 extension commands do not block M3 unless deliberately reclassified.

Optimization cadence is iteration-based: every permanent slice gets a Slice Quality Gate; repeated owner pressure triggers focused review; every three accepted permanent slices or milestone boundary triggers a Full Repository Health Audit.
