# ASA-CAD — воспроизведение КОМПАСа с видимыми поставками

Редакция 2026-09-30. STATUS/#10 — текущее состояние; #19 — визуальная очередь.

## Цель

Каноническая цель: ~90% визуального + функционального/workflow соответствия разделам КОМПАС-3D v25 **Деталь / Сборка / Чертеж** ради минимального переобучения; полный контракт — `SYSTEM_SPEC.md`. FULL_M2V = **NOT ACCEPTED**. FULL_KOMPAS_PARITY = **NO**.

## Принятые поставки

- В1 / CAD-VIS-001 — DONE / regional accepted.
- В2 / CAD-VIS-002 — DONE / regional accepted.
- В3 / CAD-VIS-003 — DONE / regional accepted / PARITY PARTIAL.
- В4 / CAD-VIS-004 — DONE / regional accepted / PARITY PARTIAL.
- CAD-VIS-005 — accepted integration checkpoint / PRODUCT_DELTA NONE.
- V6A / CAD-VIS-006A — DONE / MERGED / regional accepted / PARITY PARTIAL.
- V6B / CAD-VIS-006B — DONE / MERGED / regional accepted / PARITY PARTIAL.
- V6C / CAD-VIS-006C — **DONE / MERGED / REGIONAL RESULT ACCEPTED**; PR #175; accepted HEAD `476d04c8917493adad995f8dca2a16b858927410`; merge `cda903d762b7e52e9345fe09e6dfa0be508a0d6a`; historical scope = **Sketch hierarchy + dimension ownership presentation**.
- KOMPAS-SHELL-ADOPTION-001 — **DONE / MERGED / REGIONAL RESULT ACCEPTED**; PR #173; accepted HEAD `5719a8a8b3f357d1448ea68f7d30b41ef586bb35`; merge `027d4ea6a5b2549609b0b3a9cfdefd397fe8559b`; accepted scope = **PART TOP SHELL ONLY**.

FULL_TREE_PARITY = **NOT ACCEPTED**.

## Full Repository Health Audit #166

#166 = **YELLOW_ACCEPTED / completed**.

Accepted final main:
`fa13134bf7397a20a9b02790a6644e9084e943e0`

RED findings:
**NONE**

Resolved in audit maintenance:
- `Y-AUD-166-M2-ARCH` — permanent M2 shell executes `npm run test:m2:architecture`; post-repair CI PASS.

Remaining accepted YELLOW:
- `Y-AUD-166-BUDGETS` — target pressure only; hard/frozen gates PASS; no growth.
- `Y-AUD-166-THIRD-TOUCH` — focused owner review completed in #166; repeat before the next qualifying third touch.
- `Y-AUD-166-STALE-PRS` — #143/#146 are stale/historical and must not merge as-is.
- `Y-AUD-166-V6A-OWNERSHIP` — CutExtrude profile ownership coupling is non-growing; separate before broader profile/edit-existing/generalized-selection scope.

Audit #158 is now historical. #166 is the latest accepted Full Repository Health Audit.

## Cadence

Accepted Full Audit #166 reset cadence to **0/3**.

After accepted permanent product slices #173 and #175:

**CADENCE = 2/3**

**FEATURE_FREEZE = LIFTED**

Governance/docs changes do not count as permanent product slices.

**FULL_AUDIT_REQUIRED_NOW = NO.** Acceptance of the next permanent product slice reaches **3/3** and requires a Full Repository Health Audit before any later product slice. Every permanent slice still receives a Slice Quality Gate.

## Accepted — KOMPAS-SHELL-ADOPTION-001

KOMPAS-SHELL-ADOPTION-001 = **DONE / MERGED / REGIONAL RESULT ACCEPTED**.

Accepted implementation:
- PR #173;
- accepted HEAD `5719a8a8b3f357d1448ea68f7d30b41ef586bb35`;
- merge `027d4ea6a5b2549609b0b3a9cfdefd397fe8559b`;
- scope = **PART TOP SHELL ONLY**.

Accepted regional delta includes the existing main-menu/document-tab owners, Part workspace/toolset selector, three Part toolsets, registry-backed command-group composition, preserved quick-access owner, and the production/dev roadmap-command visibility boundary.

**PRODUCTION_VISIBILITY_CONTRACT = ACCEPTED**:
- normal product hides planned/deferred commands;
- explicit `/dev/part/*` may show them disabled with roadmap markers.

PR #170 remains **REFERENCE / PROTOTYPE ONLY**, OPEN / NOT MERGED.

This does not accept full M2V, full KOMPAS parity, full Tree parity, Part completion, Assembly, Drawing, or the 90% target. Canonical educational parity scope remains **Деталь / Part, Сборка / Assembly, Чертеж / Drawing**.

## NEXT — KOMPAS-CORE-INTERACTION

Priority is user interaction continuity before further decorative or Tree polish. C1/C2/C3 are roadmap definitions only; implementation has not started.

### C1 / KOMPAS-CORE-INTERACTION-001 — Unified Part Viewport

Acceptance target:
- empty Part has one persistent spatial CAD scene;
- origin plus XY/XZ/YZ are real selectable scene objects;
- RMB drag = rotate, MMB drag = pan, wheel = zoom;
- tree ↔ scene plane selection uses one state;
- standard views operate through the same viewport/camera contract;
- creating a Sketch from a selected plane uses that same scene selection.

Current main:
- EMPTY_PART_VIEWPORT = **NOT ACCEPTED**;
- 3D_NAVIGATION_CONTINUITY = **NOT ACCEPTED**.

### C2 / KOMPAS-CORE-INTERACTION-002 — Sketch-in-Viewport

Acceptance target:
- Sketch is a mode of the same CAD work area, not an isolated replacement editor;
- camera orients normal to the chosen workplane through the shared camera system;
- model context remains visible when applicable;
- pan/zoom/fit remain available;
- Finish returns to Part without an unrelated camera reset.

Current main:
- PartModelStage replaces the Part stage with SketchEditingStage;
- SketchEditingStage uses CadViewport model=null;
- SKETCH_VIEWPORT_CONTINUITY = **NOT ACCEPTED**.

### C3 / KOMPAS-CORE-INTERACTION-003 — Geometry Command Lifecycle

First command contract: Line.
- P1→P2 commits segment 1 and Line stays active;
- P2→P3 commits segment 2 and Line stays active;
- explicit Finish/Esc/switch-command closes the tool cleanly;
- parameter workflow is not hidden by command start;
- active ribbon state, live ghost and per-segment Undo are required.

Current main:
- LINE_COMMAND_LIFECYCLE = **NOT ACCEPTED**;
- LINE_PARAMETER_WORKFLOW = **NOT ACCEPTED**.

### Existing Draft candidates

- #177 / PART-CORE-RECOVERY-001 — **TECHNICAL RECOVERY CANDIDATE / MERGE HOLD**. Keep its useful geometry/runtime recovery as a dependency or reuse source; it does not itself satisfy C1/C2/C3.
- #179 / R1 first editable Drawing — **DEPENDENT CANDIDATE / HOLD**. Drawing/schema work remains separate. The PR contains C1-overlap candidate code; before C1 implementation perform an independent code/browser review and choose **REUSE / EXTRACT / SUPERSEDE**. Do not build a second independent C1 in parallel.

### Queue after Core Interaction Foundation

1. Drawing R1.
2. Drawing R2.
3. Drawing → Sketch flow.
4. Later Tree polish: search, context menu, feature/body hierarchy refinement, exact spacing.
5. Remaining KOMPAS shell / parameters, Resize, then final Part/Sketch parity review.

Historical V6C / #175 remains accepted and is not moved back to backlog.

## Gates

Gate A/M2O and M3 core remain in force.

Gate B before broad M4 remains OPEN on:
- M2V KOMPAS visual acceptance;
- M3 functional exit contract;
- M3X shared ASA-CAD/ASA-Lab golden contract;
- M3M-009;
- pre-M4 performance baselines.

The Full Repository Health Audit requirement is currently satisfied by accepted #166; a new Full Audit becomes mandatory after the next accepted permanent product slice reaches cadence 3/3.

GitHub repository/PR/Issues/Actions/artifacts remain the execution environment.
