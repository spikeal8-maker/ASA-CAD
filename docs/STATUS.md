# ASA-CAD — состояние и следующий видимый результат

Снимок 2026-09-29. Координатор #10, визуальная очередь #19.

## Текущий статус

- В1 / CAD-VIS-001 — DONE / MERGED / REGIONAL RESULT ACCEPTED.
- В2 / CAD-VIS-002 — DONE / MERGED / REGIONAL RESULT ACCEPTED.
- В3 / CAD-VIS-003 — DONE / MERGED / REGIONAL RESULT ACCEPTED / PARITY PARTIAL.
- В4 / CAD-VIS-004 — DONE / MERGED / REGIONAL RESULT ACCEPTED / PARITY PARTIAL.
- CAD-VIS-005 — INTEGRATION CHECKPOINT / ACCEPTED / PRODUCT_DELTA NONE.
- V6A / CAD-VIS-006A — DONE / MERGED / REGIONAL RESULT ACCEPTED / PARITY PARTIAL.
- V6B / CAD-VIS-006B — DONE / MERGED / REGIONAL RESULT ACCEPTED / PARITY PARTIAL.
- Full Repository Health Audit #166 — **YELLOW_ACCEPTED / completed**.
- Accepted audit final main: `fa13134bf7397a20a9b02790a6644e9084e943e0`.
- RED findings = **NONE**.
- CADENCE = **0/3**.
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

## NEXT

**KOMPAS-SHELL-ADOPTION-001** — следующий продуктовый этап.

Цель: начать перенос эталонной оболочки КОМПАСа из PR #170 в существующий рабочий ASA-CAD без создания второго приложения или второго runtime.

Reference source:
- PR #170, HEAD `0d23bf19fbfcba7fbf4789afdd18f7d632adeb50`;
- `prototypes/kompas-shell/index.html`;
- `prototypes/kompas-shell/README.md`.

PR #170 = **REFERENCE / PROTOTYPE ONLY**. Он не является product implementation, replacement application, runtime или second UI и не должен merge-иться как способ внедрения интерфейса.

Первый implementation slice после этого state transition = **PART TOP SHELL ONLY**:
- главное меню;
- вкладка документа;
- Part workspace/toolset selector;
- группы команд;
- quick-access chrome.

Три toolset первого Part-shell slice:
1. Твердотельное моделирование
2. Каркас и поверхности
3. Инструменты эскиза

Это инструментальные наборы внутри первого этапа оболочки **Деталь / Part**, а не глобальный product scope. Канонический educational parity scope остаётся: **Деталь / Part, Сборка / Assembly, Чертеж / Drawing** согласно `SYSTEM_SPEC.md`.

REFERENCE_READY = **YES**.
ADOPTION_STARTED = **NO**.

**V6C / CAD-VIS-006C — Sketch hierarchy + dimension ownership = DEFERRED UNTIL AFTER INITIAL KOMPAS SHELL ADOPTION.** V6C не закрыт, не выполнен и остаётся в очереди после начального shell adoption.

Machine policy remains authoritative: every permanent slice gets a Slice Quality Gate; Full Audit cadence remains **0/3** after accepted #166. Existing owner/frozen-budget constraints remain in force.

GitHub remains the execution/test environment for this queue.
