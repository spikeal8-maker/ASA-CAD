# ASA-CAD — состояние и следующий видимый результат

Снимок 2026-10-03. Координатор #10, исполнительная очередь #19, user-first requirements owner #178.

## Текущий статус

- Full Repository Health Audit #166 — **YELLOW_ACCEPTED / completed**; accepted audit final main `fa13134bf7397a20a9b02790a6644e9084e943e0`.
- KOMPAS-SHELL-ADOPTION-001 / PR #173 — **DONE / MERGED / REGIONAL RESULT ACCEPTED**; merge `027d4ea6a5b2549609b0b3a9cfdefd397fe8559b`; scope = PART TOP SHELL ONLY.
- V6C / CAD-VIS-006C / PR #175 — **DONE / MERGED / REGIONAL RESULT ACCEPTED**; merge `cda903d762b7e52e9345fe09e6dfa0be508a0d6a`; historical scope = Sketch hierarchy + dimension ownership presentation.
- Historical V1–V6B remain accepted regional work as recorded in ROADMAP.
- CADENCE = **2/3**.
- FEATURE_FREEZE = **LIFTED**.
- FULL_AUDIT_REQUIRED_NOW = **NO**.
- FULL_AUDIT_REQUIRED_AFTER_NEXT_ACCEPTED_PRODUCT_SLICE = **YES**.
- FULL_TREE_PARITY = **NOT ACCEPTED**.
- FULL_M2V = **NOT ACCEPTED**.
- FULL_KOMPAS_PARITY = **NO**.

Full Audit #166 reset cadence to 0/3; #173 is accepted permanent product slice 1/3 and #175 is 2/3. Governance/docs maintenance does not increment cadence. Acceptance of the next permanent product slice reaches 3/3 and requires a new Full Repository Health Audit before any later product slice.

Remaining accepted #166 YELLOW constraints stay non-growing:
- Y-AUD-166-BUDGETS;
- Y-AUD-166-THIRD-TOUCH;
- Y-AUD-166-STALE-PRS (#143/#146 do not merge as-is);
- Y-AUD-166-V6A-OWNERSHIP.

## NEXT — KOMPAS-CORE-INTERACTION

Detailed acceptance contracts are owned by `docs/ROADMAP.md` and #178.

1. **C1 / KOMPAS-CORE-INTERACTION-001 — Unified Part Viewport** — **IN REVIEW** (Draft PR from `feat/c1-unified-part-viewport`) / NOT ACCEPTED.
   - EMPTY_PART_VIEWPORT = **IMPLEMENTED IN REVIEW / NOT ACCEPTED**.
   - 3D_NAVIGATION_CONTINUITY = **IMPLEMENTED IN REVIEW / NOT ACCEPTED**.
   - #179 overlap decision (recorded in #178): **SUPERSEDE** its SVG empty-Part scene; **EXTRACT** tree plane selection and the empty-Part DOM test contract.
   - Owner acceptance of C1 reaches CADENCE 3/3: a Full Repository Health Audit is required before C2.
2. **C2 / KOMPAS-CORE-INTERACTION-002 — Sketch-in-Viewport** — THEN / NOT STARTED.
   - SKETCH_VIEWPORT_CONTINUITY = **NOT ACCEPTED**.
3. **C3 / KOMPAS-CORE-INTERACTION-003 — Geometry Command Lifecycle** — THEN / NOT STARTED.
   - LINE_COMMAND_LIFECYCLE = **NOT ACCEPTED**.
   - LINE_PARAMETER_WORKFLOW = **NOT ACCEPTED**.
4. After Core Interaction Foundation: Drawing R1 → Drawing R2 → Drawing→Sketch flow.
5. Later: additional Tree polish, remaining KOMPAS shell/parameters, Resize, final Part/Sketch parity review.

Historical V6C / #175 stays DONE and is not moved back to backlog.

## Existing Draft candidates

- PR #177 / PART-CORE-RECOVERY-001 — **TECHNICAL RECOVERY CANDIDATE / MERGE HOLD / UNCHANGED**. Preserve useful geometry/runtime recovery; it may be a dependency/reuse source but does not satisfy C1/C2/C3.
- PR #179 / R1 first editable Drawing — **DEPENDENT CANDIDATE / HOLD / UNCHANGED**. Drawing/schema scope is separate. Its C1 overlap was reviewed (SUPERSEDE scene / EXTRACT tree wiring); a rebase after C1 must drop `PartEmptyWorkArea`.

## Honesty boundaries

M1 ASA-owned `CadDocument` preserves six first-class document kinds: Part, Assembly, Drawing, Fragment, Specification, Text.

The ~90% learner-facing visual + functional/workflow identity for **Деталь / Part, Сборка / Assembly, Чертеж / Drawing** remains a target, not current acceptance. PR #170 remains REFERENCE / PROTOTYPE ONLY.

GitHub remains the source of truth and execution/test environment.
