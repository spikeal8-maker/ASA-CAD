# ASA-CAD — текущее состояние и каноничный путь

Снимок: 2026-10-08.

## Канон

- Central issue: #184 / UI-CORE-UNIFICATION-001.
- Convergence branch: integration/ui-core-unification.
- Frozen UI reference: PR #170, tag ui-reference-20261004, SHA 88c535c652dac8b04f0d68fa144cf8486afdc926.
- Product authority: CadDocument, CadApplication, typed actions, product persistence/history, solver, OpenCascade/B-Rep, render adapters.
- Prototype doc/history/sketcher/snap/THREE.ExtrudeGeometry не являются product authority.
- Six first-class document kinds: Part, Assembly, Drawing, Fragment, Specification, Text.

Machine contract: spec/process/ui-core-unification.v1.json.
U1A map: docs/UI_CORE_U1A_MAPPING.md.

## Cadence

До U1 accepted permanent product cadence = 2/3.

U1 = ровно один permanent product slice:
- U1A — shell;
- U1B — tree/parameters/status;
- U1C — viewport/selection.

U1A/U1B/U1C отдельно cadence не увеличивают.

После U1 acceptance:
3/3 -> Full Repository Health Audit REQUIRED -> U2 BLOCKED до GREEN или явно принятого YELLOW.

Honesty:
- FULL_TREE_PARITY = NOT ACCEPTED;
- FULL_M2V = NOT ACCEPTED;
- FULL_KOMPAS_PARITY = NO;
- 90% visual + functional/workflow identity = TARGET.

## Источники старой работы

- #170 — frozen UI/UX reference only.
- #177 / 44d87bef78fd66aa0e85fa1fa7ba9dc58e280a65 — REUSE_AFTER_EXACT_REVIEW.
- archived #182 / 27c55222331681d23ba101bd4992c9dc24a0ac42 — EXTRACT_AFTER_EXACT_REVIEW.
- #179 / 034d0fc4d51606425794fc76508f61600a41d0cb — HOLD_NOT_INTEGRATION_BASE.
- #181 MERGED — 47aa4836adb30432adcb09609da93fb309125aa5.
- #183 MERGED — 27380d161210aaf309fa3a8c76109fb7038a3533.

## Preflight

Обычный U0 preflight требует:
1. governance contract в main;
2. #181/#183 merged;
3. integration содержит fresh main;
4. PR в integration запускают required CI;
5. frozen tag указывает на 88c535c...;
6. policy test PASS.

### Постоянное разрешение владельца на ROADMAP (2026-10-08)

OWNER_APPROVED_CONTINUOUS_ROADMAP_20261008 = ACTIVE. Техническая разработка U1A/U1B/U1C, аудит после U1 и U2–U5 разрешены на основании machine `developmentFlow` без дополнительных owner-permit PR.

Integration protection = DETECT_ONLY / NOT ENFORCED / NOT VERIFIED.
ADMIN_BRANCH_PROTECTION_NOT_ENFORCED = KNOWN_RISK, а не автоматический product STOP; UI_CORE_INTEGRATION_GUARD является post-push detector. Direct/force push в integration и main запрещены внутренним регламентом.

Technical acceptance: отдельный Draft PR -> exact HEAD CI + реальный CAD user-flow -> независимый documented read-only review (formal GitHub APPROVED не обязателен) -> technical merge в integration -> next checkpoint. Owner product acceptance = PENDING до оценки интегрированного U1; merge в main, production и объявление визуальной parity требуют отдельного owner decision.

PR #194 / U1A: implementation и local browser/Docker proof существуют; техническая приёмка и merge проверяются по live GitHub. Текущая machine pointer = U1A, затем U1B -> U1C -> FULL REPOSITORY HEALTH AUDIT -> U2.

## U1A contract

U1A переносит только:
- main menu;
- document tab;
- toolsets/ribbon;
- search/global actions;
- desktop shell geometry.

Не входит:
- tree/parameters/status — U1B;
- viewport/planes/selection — U1C;
- Sketch/math/persistence/solver/OpenCascade.

Preferred owners:
CadShellTop, CadFileMenu, CadShellCommandGroups, CadShellReferenceGroups, styles/top-shell.css, styles/ribbon.css, styles/shell-responsive.css.

Frozen/pressured:
- App.tsx — без новой ответственности и без роста;
- CadViewport.tsx — не трогать в U1A;
- ParameterPanel.tsx — не трогать в U1A;
- responsive.css — не увеличивать.

Visual evidence:
UI_CORE_U1_VISUAL_EVIDENCE сравнивает exact candidate с frozen #170 в solid 1600x900, surfaces 1600x900 и solid 1366x768. Capture не является автоматическим parity verdict; внешний вид принимает владелец.

## Next

Текущий checkpoint = U1A: технически проверить/принять PR #194 в integration после exact-head CI, независимого ревью и user-flow. Следом без нового разрешения: U1B -> U1C -> полный технический сценарий U1 -> автоматический Full Repository Health Audit -> U2 при допустимом исходе. Owner product acceptance после интеграции U1 и значимых этапов, отдельно от checkpoint merge.
