# ASA-CAD — актуальное состояние репозитория

Снимок: 2026-10-13. Live GitHub SHA — источник фактов, а не сохранённые даты.

## Канон продукта

- Новый внешний интерфейс/взаимодействия: frozen #170, tag `ui-reference-20261004`, SHA `88c535c652dac8b04f0d68fa144cf8486afdc926`.
- Единственный продуктовый runtime: `CadDocument` / `CadApplication` / typed UI actions / PlaneGCS / OpenCascade B-Rep / persistence. Демо-математика прототипа #170 не является ядром.
- Desktop >=900 px уже показывает продуктовый `src/web/kompas`. **Текущий fallback <900 px на прежнюю оболочку — подтверждённый P0-дефект**, а не второй утверждённый интерфейс. Разрешён ремонт через PR #200: одна адаптивная компоновка `src/web/kompas` на любых экранах с теми же `CadUiAction`/`CadDocument`. До merge #200 считать проблему открытой.
- Система документов по контрактам — шесть видов (six document kinds): Part, Assembly, Drawing, Fragment, Specification, Text. Не все редакторы/команды готовы.

## Факт объединения U1

- Ветка `ui-core/u1-visible` содержала U1A (ранее PR #194), клавиатурные исправления, K1 solver→profile→OpenCascade, C1 viewport, меню/панели/дерево из #170 и тесты.
- [PR #195](https://github.com/spikeal8-maker/ASA-CAD/pull/195) **MERGED в integration**, SHA `cc2ceaa22858f7f885a17b17a16286e0ce65c8e2`. Проверочный HEAD `7e243894052d9a40aa590e6a4314fc0c9a691c65`: GitHub PR CI 9/9 SUCCESS.
- [PR #196](https://github.com/spikeal8-maker/ASA-CAD/pull/196) **MERGED в main**, SHA `e37650f08d9e2fa6cf13ceb6a09ecd8e8a568c15`; PR workflows SUCCESS.
- #194 закрыт как superseded, его код уже внутри #195/#196. Не делать повторный U1A / K1 merge.
- Код U1 интегрирован, но **полный независимый U1 architecture review, итоговый health audit, полная визуальная и продуктовая приёмка не заявлены**. Не путать CI PASS с 90% KOMPAS parity.

## Действующая точка работ

**Текущий machine checkpoint = `FULL_REPOSITORY_HEALTH_AUDIT`.** U1A/U1B/U1C уже включены как единый продуктовый пакет, исторический scope U1A не является следующим заданием.

Следующий обязательный шаг: провести независимый полный аудит исходного дерева и связей UI / geometry / topology / persistence / schema / CI / docs на текущем main+integration; **исправления подтверждённых P0/RED разрешены во время аудита** (`auditRepairAllowed=true`), но новые U2–U5 функции запрещены до закрытия gate. P0: убрать Legacy shell в компактном режиме, закрепить #170 в обязательных CI, проверить review-before-merge. Полный аудит после U1 требуется по cadence 2/3→3/3.

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
