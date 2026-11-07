# ASA-CAD — актуальное состояние репозитория

Снимок: 2026-11-07 UTC. Live GitHub SHA имеет приоритет над сохранёнными датами.

## Канон продукта

- UI/UX reference: frozen [#170](https://github.com/spikeal8-maker/ASA-CAD/pull/170), tag `ui-reference-20261004`, SHA `88c535c652dac8b04f0d68fa144cf8486afdc926`. Его prototype runtime не является продуктовым ядром.
- Принятый integration: `d9484da144d2dddfc71bc32e35173683832a5400` — одна продуктовая оболочка `src/web/kompas`, адаптивная на desktop/tablet/phone; прежний fallback <900 px удалён.
- Main: `1f8d2627da7ddfa63b31876d46347d0b8080c154`, с прежним fallback и без текущих audit repairs. Перенос integration в main и production не выполнен.
- Авторитеты: `CadDocument`, история `CadApplication`, typed actions, ASA → PlaneGCS → solved profile → OpenCascade B-Rep, product persistence. Three.js отображает производные данные.
- Контракты описывают six document kinds: Part, Assembly, Drawing, Fragment, Specification, Text. Готовность редакторов и команд различается.

## Принятые изменения

| PR | Принятый результат | Integration merge | Exact PR CI |
| --- | --- | --- | --- |
| [#195](https://github.com/spikeal8-maker/ASA-CAD/pull/195) | Общий U1A/U1B/U1C: shell/tree/parameters/viewport, K1/C1 | `cc2ceaa` | 9/9 |
| [#202](https://github.com/spikeal8-maker/ASA-CAD/pull/202) | Единый responsive KOMPAS, menu/tree/quick actions/resize | `1be7bdb` | 9/9 |
| [#209](https://github.com/spikeal8-maker/ASA-CAD/pull/209) | CI browser runner, совместимый с pinned Playwright | `169cb83` | 9/9 |
| [#208](https://github.com/spikeal8-maker/ASA-CAD/pull/208) | LEGACY-CLEANUP-202: удалены недостижимые owners/CSS | `4381141` | 9/9 |
| [#210](https://github.com/spikeal8-maker/ASA-CAD/pull/210) | Семантическая проверка constraint refs при загрузке | `03b7956` | 7/7 |
| [#211](https://github.com/spikeal8-maker/ASA-CAD/pull/211) | Ownership async document/history/render/OCC cache | `82f0146` | 8/8 |
| [#212](https://github.com/spikeal8-maker/ASA-CAD/pull/212) | Snapshot-before-await и atomic recovery acknowledgement | `75d5d6e` | 7/7 |
| [#214](https://github.com/spikeal8-maker/ASA-CAD/pull/214) | Stable edge/face/owner identity и ASA temporary handles | `4af80b6` | 7/7 |
| [#215](https://github.com/spikeal8-maker/ASA-CAD/pull/215) | Current solved-profile admission и shared solver lifecycle | `d9484da` | 9/9 |

Maintenance/audit repairs приняты после независимого read-only APPROVE и проверок точного candidate/synthetic tree. CI, agent review и owner product acceptance — разные факты. Для #214 проверены Protected Part, actual OCC async 10/10, topology 18/18 и ordinary M2/M3. Recovery #212: реальные IndexedDB 3 cases PASS, удаление своей test DB подтверждено. Cleanup: 47 локальных browser entries PASS; четыре CI before/after PNG пары побайтно одинаковы.

Исторический U1 также включён в main через #196 (`e37650f`). #194 закрыт как superseded; #200/#201 — сохранённые предшественники #202. Повторно их не сливать.

## Действующая точка работ

**Machine checkpoint = `FULL_REPOSITORY_HEALTH_AUDIT` (Full Repository Health Audit); outcome = PENDING; `productCodeStartAllowed=false`.** Cadence после общего U1: 2/3 → 3/3. #199 разрешает только подтверждённые RED/P0 repairs и необходимые регрессии, не новые U2–U5 функции.

- Solved profile #215 принят; предшественник #213 закрыт с сохранением истории и причин исправлений CI. Actual GCS/OCC 14/14, isolated React 7/7, ordinary product fixtures 5/5; post-merge 8/8 jobs PASS. Sketch-only загружает PlaneGCS, не OCC.
- Fixed constraint: подтверждена порча нового same-ID документа поздней командой. Кандидат использует detached snapshot, проверки document/context/request до commit и после ответа, общий non-owning solver client. Одинаковые actual React + PlaneGCS tests: baseline 3/17 PASS, candidate 17/17 PASS, включая StrictMode и поздний ответ. Exact CI/review ещё требуются; RED не считается закрытым до технической приёмки.
- Итоговый аудит требует общей проверенной базы, пяти измеренных performance baselines, актуальной dependency classification, независимого архитектурного verdict и единого committed report. Pilot не является принятой performance-базой.
- Toolchain advisories, прежние full-web type diagnostics и vendor StableRef lifetime finding остаются явно открытыми; они не обозначаются исправленными результатом отдельных PR.

`U2 = BLOCKED` до GREEN или явно принятого YELLOW. Следующий разрешённый checkpoint после аудита — U2: настоящий Sketch-in-Viewport, Line/Rectangle/Circle/Arc, numeric entry, Undo/Redo и Save/Open поверх существующего ядра; затем U3 → U4 → U5. Повторно реализовывать работающий K1/U1 не требуется.

Полная visual parity, включая темы, и owner product acceptance остаются PENDING. `DETECT_ONLY` / `ADMIN_BRANCH_PROTECTION_NOT_ENFORCED` — `KNOWN_RISK`, известный административный риск, не ENFORCED и не отдельный запрет разработки.

## Сохраняемые кандидаты и контроль

- #170 — immutable reference, не merge-источник product runtime.
- #177 — Draft Part recovery; уникальные изменения переносить только после отдельной проверки.
- #179 — Draft Drawing/schema-v4; требует отдельного совместимого PR и миграций.
- #204–#207 — отдельная Fusion-очередь кандидатов; не приняты в текущую integration автоматически.
- Governance branch `governance/align-main-20261008` не создаёт второй продуктовый путь.

Действует `OWNER_APPROVED_CONTINUOUS_ROADMAP_20261008`: технический контролёр сверяет `spec/process/active-work.v1.json`, этот STATUS, Issue #184 и live PR/branches; выполняет Draft PR, exact CI, ordinary-user flow и независимое ревью. Дополнительное решение владельца требуется для integration → main, production, final visual parity и изменения продуктовой цели.
