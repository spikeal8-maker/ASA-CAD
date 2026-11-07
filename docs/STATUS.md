# ASA-CAD — актуальное состояние репозитория

Снимок: 2026-11-07. Live GitHub SHA — источник фактов, а не сохранённые даты.

## Канон продукта

- Новый внешний интерфейс/взаимодействия: frozen #170, tag `ui-reference-20261004`, SHA `88c535c652dac8b04f0d68fa144cf8486afdc926`.
- Единственный продуктовый runtime: `CadDocument` / `CadApplication` / typed UI actions / PlaneGCS / OpenCascade B-Rep / persistence. Демо-математика прототипа #170 не является ядром.
- Канон принятого integration `82f0146` после PR #202/#208 — **одна продуктовая оболочка** `src/web/kompas` на любых экранах. Legacy fallback <900 px удалён. В main `1f8d262` он ещё присутствует; перенос integration в main не выполнен.
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

Ремонт [PR #202](https://github.com/spikeal8-maker/ASA-CAD/pull/202) **MERGED в integration**, SHA `1be7bdb3b351fb0caee9c040abb43fd690bed687`. Проверенный HEAD `173ec55fa5141d8d67dc6c956fe50aa6dc0c0b49`: PR CI 9/9 SUCCESS, post-merge CI 8/8 SUCCESS, независимый review APPROVE. Приняты исправления меню/дерева, быстрых действий, desktop-параметров и resize. #200/#201 — сохранённые предшественники, повторно не сливать.

Maintenance принят в integration: [#209](https://github.com/spikeal8-maker/ASA-CAD/pull/209), merge `169cb832df109858df43cd69a3418ac415a4e8c4`, закрепил совместимый CI runner; [#208](https://github.com/spikeal8-maker/ASA-CAD/pull/208), merge `438114115f7700dcc216e962acc2e0282a885ee4`, закрыл LEGACY-CLEANUP-202. Недостижимые pre-U1 owners удалены; KOMPAS/core сохранены. Оба PR: 9/9 exact-head jobs SUCCESS и независимый review APPROVE; post-merge CI SUCCESS. Cleanup: 47 локальных M2/M3 entries PASS, четыре пары CI PNG побайтно одинаковы. Merge tree совпадает с tested candidate `18a75e2`.

Приняты audit repairs: [#210](https://github.com/spikeal8-maker/ASA-CAD/pull/210), merge `03b7956`, отклоняет несогласованные constraint refs; [#211](https://github.com/spikeal8-maker/ASA-CAD/pull/211), merge `82f0146812ea274e7661e0d87d8293e2b9bf80f9`, сохраняет ownership async document/OCC cache. Exact CI 7/7 и 8/8 SUCCESS, независимый review APPROVE; merge trees совпали с tested candidates.

Открыты repairs Save ACK/recovery, raw-vs-solved profile eligibility и StableRef topology (неверное ребро / противоположная опорная грань). Полный audit и продуктовая/визуальная приёмка остаются PENDING.

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
