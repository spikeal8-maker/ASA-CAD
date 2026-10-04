# ASA-CAD — текущее состояние и каноничный путь

Снимок: 2026-10-04.

## Каноничные источники

- Central issue: **#184 / UI-CORE-UNIFICATION-001**.
- Convergence branch: **`integration/ui-core-unification`**.
- Frozen UI/UX reference: **PR #170**, tag `ui-reference-20261004`, SHA `88c535c652dac8b04f0d68fa144cf8486afdc926`.
- Product authority: только `src/**` — `CadDocument`, `CadApplication`, typed commands, persistence/history, product solver, OpenCascade/B-Rep и render adapters.
- Prototype-local `doc/history/sketcher/snap/THREE.ExtrudeGeometry` не являются product authority.

Product document model remains **six first-class document kinds**: Part, Assembly, Drawing, Fragment, Specification, Text.

## Текущий main и cadence

Maintenance baseline: #181 и #183 MERGED; integration должна содержать актуальный main. `U1_START_ALLOWED` не хранится как ручной статус: перед U1 проверяется, что этот U0 contract уже находится в main, integration содержит этот main, frozen reference подтверждён и required CI/policy test зелёные.

Accepted permanent product cadence до U1 = **2/3**.

**U1 считается ровно одним permanent product slice.**
После принятия U1:
- cadence = **3/3**;
- **Full Repository Health Audit обязателен немедленно**;
- **U2 BLOCKED** до принятия этого аудита.

U1A/U1B/U1C — checkpoints одного U1 и отдельно cadence не увеличивают.

Honesty boundaries:
- FULL_TREE_PARITY = NOT ACCEPTED;
- FULL_M2V = NOT ACCEPTED;
- FULL_KOMPAS_PARITY = NO;
- ~90% learner-facing visual + functional/workflow identity = TARGET / NOT CURRENT ACCEPTANCE.

## Роли существующей работы

- **#170** — CANONICAL UI/UX REFERENCE / FROZEN FOR U1 по tag `ui-reference-20261004`. Новую CAD-математику туда не добавлять.
- **#177** — REUSE SOURCE / HOLD, exact SHA `44d87bef78fd66aa0e85fa1fa7ba9dc58e280a65`.
- **#182** — CLOSED / ARCHIVED / EXTRACT SOURCE, exact SHA `27c55222331681d23ba101bd4992c9dc24a0ac42`.
- **#179** — HOLD / NOT INTEGRATION BASE, exact SHA `034d0fc4d51606425794fc76508f61600a41d0cb`.
- **#180** — SUPERSEDED / CLOSED / branch archived.
- **#181** — MERGED, merge `47aa4836adb30432adcb09609da93fb309125aa5`.
- **#183** — MERGED, merge `27380d161210aaf309fa3a8c76109fb7038a3533`.

Machine-readable convergence/reuse contract:
`spec/process/ui-core-unification.v1.json`.

## U0 — preflight

U1 разрешён только когда одновременно:
1. U0 governance/contract changes находятся в `main`;
2. #181 = MERGED;
3. #183 = MERGED;
4. integration branch обновлена от нового main;
5. pull requests в `integration/ui-core-unification` запускают required CI;
6. frozen UI reference tag указывает на `88c535c...`;
7. npm run test:process:ui-core-unification = PASS.

До выполнения всех семи условий:
**U1_START_ALLOWED = NO**.

## U1 — один permanent product slice

### U1A — shell checkpoint
- меню;
- document tab;
- toolset/ribbon layout;
- canonical composition из #170;
- никакого prototype state.

### U1B — tree/parameters/status checkpoint
- дерево;
- parameters;
- status;
- реальные product bindings;
- никаких декоративных duplicate owners.

### U1C — viewport/selection checkpoint
- real empty Part WorkArea;
- XY/XZ/YZ;
- scene/tree/parameters = одно application selection state;
- ordinary product route.

U1 acceptance:
`open Part -> canonical shell -> select XY/XZ/YZ -> one real application selection`.

После U1 acceptance:
`FULL REPOSITORY HEALTH AUDIT -> ACCEPTED/YELLOW_ACCEPTED -> только затем U2`.

## После аудита

- U2 — real Sketch;
- U3 — real constraints/dimensions;
- U4 — real OpenCascade Extrude;
- U5 — protected Part route.

## Git contract

```text
main  (всегда содержит актуальное governance ТЗ)
 |
 +-- integration/ui-core-unification
        |
        +-- ui-core/u1a-shell
        +-- ui-core/u1b-tree-parameters
        +-- ui-core/u1c-viewport-selection
        |
        +-- U1 acceptance
        +-- Full Repository Health Audit
        |
        +-- U2 ...
```

U1A/U1B/U1C могут иметь отдельные review PR, но не считаются отдельными permanent slices.

Финальный integration -> main допускается только после законченного принятого маршрута, required gates/audits и owner acceptance.
