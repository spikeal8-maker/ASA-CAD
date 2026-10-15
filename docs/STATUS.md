# ASA-CAD — актуальное состояние репозитория

Снимок: 2026-10-15. Live GitHub SHA — источник фактов, а не сохранённые даты.

## Канон продукта

- Новый внешний интерфейс/взаимодействия: frozen #170, tag `ui-reference-20261004`, SHA `88c535c652dac8b04f0d68fa144cf8486afdc926`.
- Единственный продуктовый runtime: `CadDocument` / `CadApplication` / typed UI actions / PlaneGCS / OpenCascade B-Rep / persistence. Демо-математика прототипа #170 не является ядром.
- Целевой контракт: **одна продуктовая оболочка** `src/web/kompas` на любых экранах. В принятом main `1f8d262` и integration `7fe83dd` пока остался Legacy fallback <900 px. Его удаление и адаптивная компоновка находятся только в непринятом PR #202.
- Система документов по контрактам — шесть видов (six document kinds): Part, Assembly, Drawing, Fragment, Specification, Text. Не все редакторы/команды готовы.

## Факт объединения U1

- Ветка `ui-core/u1-visible` содержала U1A (ранее PR #194), клавиатурные исправления, K1 solver→profile→OpenCascade, C1 viewport, меню/панели/дерево из #170 и тесты.
- [PR #195](https://github.com/spikeal8-maker/ASA-CAD/pull/195) **MERGED в integration**, SHA `cc2ceaa22858f7f885a17b17a16286e0ce65c8e2`. Проверочный HEAD `7e243894052d9a40aa590e6a4314fc0c9a691c65`: GitHub PR CI 9/9 SUCCESS.
- [PR #196](https://github.com/spikeal8-maker/ASA-CAD/pull/196) **MERGED в main**, SHA `e37650f08d9e2fa6cf13ceb6a09ecd8e8a568c15`; PR workflows SUCCESS.
- #194 закрыт как superseded, его код уже внутри #195/#196. Не делать повторный U1A / K1 merge.
- Код U1 интегрирован, но **полный независимый U1 architecture review, итоговый health audit, полная визуальная и продуктовая приёмка не заявлены**. Не путать CI PASS с 90% KOMPAS parity.

## Действующая точка работ

**Текущий machine checkpoint = `FULL_REPOSITORY_HEALTH_AUDIT`.** U1A/U1B/U1C уже включены как единый продуктовый пакет, исторический scope U1A не является следующим заданием.

Полный аудит UI / geometry / topology / persistence / schema / CI / docs после U1 остаётся PENDING (cadence 2/3→3/3). [PR #199](https://github.com/spikeal8-maker/ASA-CAD/pull/199) принят только в integration (`7fe83dd`): `auditRepairAllowed=true` разрешает подтверждённые P0/RED-исправления; новые U2–U5 функции запрещены.

Активный ремонт: [PR #202](https://github.com/spikeal8-maker/ASA-CAD/pull/202). #200/#201 — сохранённые предшественники, повторно не сливать. На исходном HEAD `bb8664b` M2 browser FAIL и независимый review CHANGES_REQUESTED. Ремонт охватывает читаемость меню/дерева, доступность быстрых действий, desktop-параметры, просмотр наборов без запуска команд и resize. Новые browser assertions проверяют эти дефекты. Приёмка требует всех exact-head CI и повторного независимого review **последнего HEAD #202**; исправленный код до merge остаётся кандидатом.

Остаточный долг: [LEGACY-CLEANUP-202 в #184](https://github.com/spikeal8-maker/ASA-CAD/issues/184#legacy-cleanup-202), owner — контролёр FULL_REPOSITORY_HEALTH_AUDIT, gate — до приёмки полного аудита. Удалить недостижимые pre-U1 shell-модули/CSS с переносом исторических boundary-тестов; проверить сборку, бюджеты и реальные workflows. Видимость команд теперь проверяется на действующем KOMPAS resolver. Ремонт не закрывает полный аудит, topology/schema review или итоговый визуальный паритет.

`U2 = BLOCKED` до аудита GREEN или явно принятого YELLOW. Это обязательный технический gate, а не административная GitHub Ruleset-блокировка. `DETECT_ONLY` integration — известный риск `KNOWN_RISK` (`ADMIN_BRANCH_PROTECTION_NOT_ENFORCED`); не выдавать его за ENFORCED.

После принятия аудита: реальный Sketch-in-Viewport и UX #170 (U2), затем ограничения/размеры (U3), выдавливание/геометрия (U4), Protected Part (U5). Переиспользовать уже работающий код, не переписывать заново.

## Непринятые кандидаты

- #170 — frozen UI/UX reference, не merge-источник product runtime.
- #177 — Draft Part recovery. K1 использует часть идей, уникальные исправления проверять и извлекать отдельно, не сливать поверх нового ядра механически.
- #179 — Draft Drawing R1/schema-v4. Требует самостоятельного совместимого PR, миграций и тестов; не был принят в U1.
- Governance branch `governance/align-main-20261008` не является новым продуктовым путём, правила из неё пересекаются с уже принятыми PR.

## Контроль исполнения

Действующее разрешение владельца: `OWNER_APPROVED_CONTINUOUS_ROADMAP_20261008`; оно не отменяет независимого технического ревью и обязательного Full Repository Health Audit после U1.

Уполномоченный контролёр читает `spec/process/active-work.v1.json`, этот STATUS и Issue #184, проверяет live branches/PR и управляет независимыми исполнителями. Коммит, Draft PR, зелёный CI, independent review и продуктовый owner verdict — разные состояния. Секреты/production не трогать без отдельного решения.
