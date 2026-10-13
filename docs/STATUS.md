# ASA-CAD — текущее состояние и каноничный путь

Снимок: 2026-10-10.

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

До U1 accepted permanent product cadence = 2/3. U1 = ровно один permanent product slice (U1A — shell; U1B — tree/parameters/status; U1C — viewport/selection); U1A/U1B/U1C отдельно cadence не увеличивают.

После U1 acceptance: 3/3 -> Full Repository Health Audit REQUIRED -> U2 BLOCKED до GREEN или явно принятого YELLOW.

Honesty: FULL_TREE_PARITY = NOT ACCEPTED; FULL_M2V = NOT ACCEPTED; FULL_KOMPAS_PARITY = NO; 90% visual + functional/workflow identity = TARGET.

## Источники старой работы

- #170 — frozen UI/UX reference only.
- #177 / 44d87bef78fd66aa0e85fa1fa7ba9dc58e280a65 — REUSE_AFTER_EXACT_REVIEW (ядро взято в K1).
- archived #182 / 27c55222331681d23ba101bd4992c9dc24a0ac42 — EXTRACT_AFTER_EXACT_REVIEW (сцена взята в пакет U1).
- #179 / 034d0fc4d51606425794fc76508f61600a41d0cb — HOLD_NOT_INTEGRATION_BASE.
- #181, #183 MERGED.

## Разрешение и процесс

OWNER_APPROVED_CONTINUOUS_ROADMAP_20261008 = ACTIVE: U1A/U1B/U1C, аудит после U1 и U2–U5 без новых owner-permit PR.

Integration protection = DETECT_ONLY / NOT ENFORCED. ADMIN_BRANCH_PROTECTION_NOT_ENFORCED = KNOWN_RISK, не product STOP. Direct/force push в integration и main запрещены регламентом.

Technical acceptance: Draft PR -> exact HEAD CI + реальный CAD user-flow -> независимый documented read-only review -> technical merge в integration -> next checkpoint. Owner product acceptance, merge в main, production и visual parity — только решением владельца.

## Состояние U1 (live GitHub — источник правды)

Machine pointer = U1A (без изменений до технического merge).

- PR #194 — U1A владельца; исправления 4 замечаний ревью — ветка ui-core/u1a-keyboard-focus, PR в ветку #194.
- K1 — ветка kernel/k1-general-profiles, PR в integration: решённый эскиз PlaneGCS -> общий профиль -> OpenCascade на XY/XZ/YZ и гранях.
- **Пакет U1 — ветка ui-core/u1-visible, Draft PR в integration (ПРЕДЛОЖЕНИЕ, ждёт решения владельца в #184):**
  - основная вёрстка рабочего стола (>= 900 px) = оболочка КОМПАС эталона #170, перенесённая в src/web/kompas: меню, вкладка документа, наборы и лента, дерево, параметры, панель быстрого доступа, сцена с XY/XZ/YZ из CadDocument;
  - каждая кнопка — typed action того же id реестра; команды без реализации показывают статус реестра;
  - математика #170 не используется; телефон (< 900 px) — компактная оболочка;
  - покрывает U1A + U1B + U1C одним PR, что расходится с п. 7 спецификации («U1 не один огромный PR») и выше repository footprint: нужны решение владельца и architecture review до технического merge.

Темы: светлая по умолчанию и тёмная — общая модель темы продукта (токены #170 для оболочки и те же значения для общих токенов, окон, панелей и плашек эскиза), переключатель и «Настройка → Параметры → Экран». Это отход от DEFERRED_NOT_U1A — предложение, ждёт решения владельца.

Не сделано в U1: эскиз в 3D-сцене (U2); панели КОМПАС для выреза, скругления, отрезка, дуги, размеров (сейчас прежняя панель в рамке КОМПАС).

## Next

1. Владелец: решение по пакету U1 (один PR или разбиение на U1A/U1B/U1C) и по #194.
2. Exact-head CI и независимое ревью PR K1, исправлений U1A и пакета U1.
3. Технический merge U1 -> Full Repository Health Audit -> U2 при допустимом исходе.
