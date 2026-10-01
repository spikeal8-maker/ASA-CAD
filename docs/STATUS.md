# ASA-CAD — состояние и следующий видимый результат

Снимок 2026-09-30. Координатор #10, визуальная очередь #19.

## Текущий статус

- В1 / CAD-VIS-001 — DONE / MERGED / REGIONAL RESULT ACCEPTED.
- В2 / CAD-VIS-002 — DONE / MERGED / REGIONAL RESULT ACCEPTED.
- В3 / CAD-VIS-003 — DONE / MERGED / REGIONAL RESULT ACCEPTED / PARITY PARTIAL.
- В4 / CAD-VIS-004 — DONE / MERGED / REGIONAL RESULT ACCEPTED / PARITY PARTIAL.
- CAD-VIS-005 — INTEGRATION CHECKPOINT / ACCEPTED / PRODUCT_DELTA NONE.
- V6A / CAD-VIS-006A — DONE / MERGED / REGIONAL RESULT ACCEPTED / PARITY PARTIAL.
- V6B / CAD-VIS-006B — DONE / MERGED / REGIONAL RESULT ACCEPTED / PARITY PARTIAL.
- V6C / CAD-VIS-006C — **DONE / MERGED / REGIONAL RESULT ACCEPTED**; PR #175; accepted HEAD `476d04c8917493adad995f8dca2a16b858927410`; merge `cda903d762b7e52e9345fe09e6dfa0be508a0d6a`; scope = **Sketch hierarchy + dimension ownership presentation**.
- KOMPAS-SHELL-ADOPTION-001 — **DONE / MERGED / REGIONAL RESULT ACCEPTED**; accepted scope = **PART TOP SHELL ONLY**.
- Full Repository Health Audit #166 — **YELLOW_ACCEPTED / completed**.
- Accepted audit final main: `fa13134bf7397a20a9b02790a6644e9084e943e0`.
- RED findings = **NONE**.
- CADENCE = **2/3**.
- FEATURE_FREEZE = **LIFTED**.
- FULL_TREE_PARITY = **NOT ACCEPTED**.
- FULL_M2V = **NOT ACCEPTED**.
- FULL_KOMPAS_PARITY = **NO**.

## Full Audit #166

Audit base:
`a03f84e21447817639f0fb9ea3f83ab86a24efb6`

CI-maintenance repair:
- PR #167;
- repair HEAD `5a8402a1e19b2c1e5223fcce2e94ab41370a899e`;
- merge `fa13134bf7397a20a9b02790a6644e9084e943e0`;
- permanent M2 shell now includes the M2 architecture test script (`test:m2:architecture`);
- post-repair M2 shell `36233235054` — SUCCESS;
- post-repair baseline `36233235046` — SUCCESS;
- M2 UI architecture — PASS;
- `test:asa` constituent coverage — PASS;
- `check` constituent coverage — PASS;
- literal full-repository check command (npm run check) — NOT_RUN.

Resolved:
- `Y-AUD-166-M2-ARCH`.

Remaining accepted YELLOW:
- `Y-AUD-166-BUDGETS` — hard/frozen gates PASS; do not grow pressured owners.
- `Y-AUD-166-THIRD-TOUCH` — focused owner review completed in #166; next qualifying third touch requires review before the touch.
- `Y-AUD-166-STALE-PRS` — #143/#146 remain historical/stale; do not merge as-is.
- `Y-AUD-166-V6A-OWNERSHIP` — CutExtrude profile ownership still flows through `ExtrudeOperationController`; keep non-growing and separate ownership before multi-profile, edit-existing, or generalized feature-selection scope.

Audit #158 is historical; #166 is now the latest accepted Full Repository Health Audit.

M1 ASA-owned `CadDocument` preserves six first-class document kinds: Part, Assembly, Drawing, Fragment, Specification, Text.

## Accepted V6B scope

V6B accepted only:
```text
Деталь 1
└─ Начало координат
   ├─ Плоскость XY
   ├─ Плоскость XZ
   └─ Плоскость YZ
+ real expand/collapse
```

This does not close full Tree parity.

## KOMPAS-SHELL-ADOPTION-001 — accepted closeout

**DONE / MERGED / REGIONAL RESULT ACCEPTED**.

Accepted implementation:
- PR #173;
- accepted HEAD `5719a8a8b3f357d1448ea68f7d30b41ef586bb35`;
- merge `027d4ea6a5b2549609b0b3a9cfdefd397fe8559b`;
- accepted scope = **PART TOP SHELL ONLY**.

Accepted regional result:
- existing main-menu owner preserved;
- real document-tab identity preserved;
- Part workspace/toolset selector;
- «Твердотельное моделирование»;
- «Каркас и поверхности»;
- «Инструменты эскиза»;
- registry-backed command groups;
- existing quick-access owner preserved;
- production/dev roadmap-command visibility boundary.

**PRODUCTION_VISIBILITY_CONTRACT = ACCEPTED**:
- normal product: implemented = visible; planned/deferred = hidden;
- explicit `/dev/part/*`: planned/deferred may be visible, remain disabled, and may carry roadmap markers.

PR #170 / `0d23bf19fbfcba7fbf4789afdd18f7d632adeb50` remains **REFERENCE / PROTOTYPE ONLY**, OPEN / NOT MERGED.

Honesty boundaries remain unchanged:
- FULL_TREE_PARITY = **NOT ACCEPTED**;
- FULL_M2V = **NOT ACCEPTED**;
- FULL_KOMPAS_PARITY = **NO**;
- 90% learner-facing visual + functional/workflow identity remains a **TARGET / NOT CURRENT ACCEPTANCE**;
- canonical educational parity scope remains **Деталь / Part, Сборка / Assembly, Чертеж / Drawing**.

Full Audit #166 reset cadence to 0/3. PR #173 is the first accepted permanent product slice after #166; accepted V6C / PR #175 is the second. Governance/docs PRs do not count as product slices. Therefore **CADENCE = 2/3** and **FEATURE_FREEZE = LIFTED**. Acceptance of the next permanent product slice reaches 3/3 and requires Full Repository Health Audit before any later product slice.

## NEXT — R1 / KOMPAS-FIRST-WORKFLOW-001

Owner-directed queue from #178:
- **R1 ACTIVE:** persistent WorkArea + standalone A4 Drawing + one real editable/savable Line;
- **R2 QUEUED:** simple 2D drafting primitives/dimensions;
- **R3 QUEUED:** explicit Drawing geometry copy into Part Sketch;
- **V7 / Resize = PAUSED / NOT STARTED**; required layout fixes for the R1 path are included in R1.

Dependency PR #177 remains **OPEN / DRAFT / MERGE HOLD**. Its recovery/F1/F2/camera results are preserved as the exact base for R1; they are not owner acceptance of the current UI.

R1 branch: `feat/kompas-first-workflow-r1`, based on exact recovery HEAD `44d87bef78fd66aa0e85fa1fa7ba9dc58e280a65`. Draft PR #176 remains unrelated and must not merge.

CADENCE remains **2/3** until R1 is actually accepted. Acceptance of R1 as the next permanent product slice reaches 3/3 and requires Full Repository Health Audit before later product slices.

GitHub remains the primary source of truth and execution/test environment.
