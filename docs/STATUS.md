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

### U1A: ограниченное разрешение владельца (2026-10-08)

OWNER_APPROVED_U1A_DETECT_ONLY_PR_FLOW = ACTIVE, строго только checkpoint U1A.
Integration protection = DETECT_ONLY / NOT ENFORCED / NOT VERIFIED.
ADMIN_BRANCH_PROTECTION_NOT_ENFORCED = KNOWN_RISK (не выдавать за ENFORCED).
UI_CORE_INTEGRATION_GUARD остаётся post-push detector, а не реальной серверной блокировкой push.

Разрешена разработка только U1A на `ui-core/u1a-shell` от exact integration HEAD.
Обязательны один Draft PR в integration, проверка точного HEAD, независимое техническое ревью,
рабочий Docker-preview и визуальная приёмка владельца перед merge.
Перенос исключения на U1B/U1C/U2 запрещён. U1A ещё НЕ принят и НЕ merged.

- productCodeStartAllowed = true (исключительно U1A);
- U1A_CODE_START_ALLOWED = YES при PASS npm run test:process:ui-core-u1a-ready;
- merge до owner acceptance = NO.

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

Сейчас разрешены только U1A shell implementation и связанное узкое governance-исключение.
Перед U1A: npm run test:process:ui-core-u1a-ready = PASS.
Next: U1A Draft PR -> exact-head CI + independent review -> Docker owner-preview -> визуальная приёмка владельца.
U1B и merge без принятия владельцем не разрешены.

После этого:
U1A -> U1B -> U1C -> U1 owner acceptance -> Full Repository Health Audit -> U2.
