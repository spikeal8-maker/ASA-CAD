# Full Repository Health Audit — 07.11.2026

## 1. Решение и границы

**YELLOW_ACCEPTED — техническое решение ChatGPT `/root`** по `OWNER_APPROVED_CONTINUOUS_ROADMAP_20261008`. В проверенном объёме текущей integration подтверждённых незакрытых P0/P1/RED нет. Три долга раздела 7 остаются OPEN. Решение вступает в силу после exact CI, независимого review отчёта/машинного состояния и merge его PR в integration. Owner product acceptance этим не предоставляется.

- Audited SHA: `128480e1a150253359ce44158d5588f6b08f27b8`.
- Tree: `9bd71a94b29245754be9fc01f4f08bb5c657ec65`.
- Проверенный main: `1f8d2627da7ddfa63b31876d46347d0b8080c154`. Он сохраняет прежний responsive fallback и не содержит текущие repairs: это release integration gap.
- Измерялся чистый checkout audited SHA. Последующий commit отчёта/evidence — другой SHA; измерения ему не приписываются.
- Приёмка закрывает post-U1 audit cadence 3/3. Следующий checkpoint — U2; следующие accepted slices считаются от этой точки. Аудит также обязателен на milestone boundary.

Полные head/tree/job IDs, reviews и post-merge runs: [acceptance index](../spec/process/evidence/health-audit-20261107/acceptance-index.json). Историческое `fullAudit:PENDING` в repair receipts отражает момент их отдельной приёмки.

## 2. Закрытые дефекты

| PR / merge | Проверенный результат |
| --- | --- |
| [#209](https://github.com/spikeal8-maker/ASA-CAD/pull/209) / `169cb83` | Browser runner закреплён на Ubuntu 24.04 для pinned Playwright 1.60; зависимости/assertions сохранены. |
| [#208](https://github.com/spikeal8-maker/ASA-CAD/pull/208) / `4381141` | LEGACY-CLEANUP-202: удалены недостижимые shell/CSS owners; сохранены 219 действующих CSS branches; 47 локальных browser entries PASS. |
| [#210](https://github.com/spikeal8-maker/ASA-CAD/pull/210) / `03b7956` | PointOnCurve/Symmetric ingress отклоняет missing/foreign/inconsistent refs: 15 отрицательных cases и валидный roundtrip. |
| [#211](https://github.com/spikeal8-maker/ASA-CAD/pull/211) / `82f0146` | Поздние async rebuild/capture не владеют новым document/history/render/OCC cache: 19 application + 12 browser DTO + 10 actual OCC cases. |
| [#212](https://github.com/spikeal8-maker/ASA-CAD/pull/212) / `75d5d6e` | Snapshot до await и atomic recovery ACK по mutation ID; реальные IndexedDB 3 cases, включая две connections. Чужой ACK не удаляет новую recovery. |
| [#214](https://github.com/spikeal8-maker/ASA-CAD/pull/214) / `4af80b6` | Исправлены unique-edge indexing, face orientation, explicit owner и cleanup ASA helper: 18 actual OCC cases. |
| [#215](https://github.com/spikeal8-maker/ASA-CAD/pull/215) / `d9484da` | Актуальный solved profile для Extrude/Cut availability/begin/commit и общий browser solver lifecycle: 14 GCS/OCC + 7 React + 5 ordinary fixture cases. |
| [#216](https://github.com/spikeal8-maker/ASA-CAD/pull/216) / `128480e` | Fixed защищён от same-ID replacement, stale context/request и late result. Неизменённый corpus: 3 PASS / 14 FAIL → 17 PASS / 0 FAIL. |

Fixed проверен на edit/cancel/selection/sketch/app change, unmount, поздних ошибках/ответах, двух запросах, development StrictMode, одной команде и одном Undo. React fixture использует реальные CadApplication/PlaneGCS и sketch-only B-Rep stub; actual B-Rep проверен отдельно.

Topology oracle: box 60×40×10 / Fillet R1 давал 23997.853981633976 вместо 23991.415926535898; top face при изменении глубины могла стать bottom face. ASA helper сохраняет vendor matching, отклоняет неподходящий owner/orientation и освобождает собственные 24 Current + 1 FindKey wrappers. Это не закрывает vendor finding раздела 7.

[#213](https://github.com/spikeal8-maker/ASA-CAD/pull/213) закрыт как предшественник #215. Сохранены CI failures по empty reason, ошибочной трактовке PlaneGCS WASM как OCC и STATUS labels; review branch восстановлена по лимиту шести commits без force push. Исходные RED не заменены успешными результатами: [repair archive](../spec/process/evidence/health-audit-20261107/repairs/manifest.json).

## 3. Архитектура и совместимость

`health_audit_review` независимо сверил final HEAD/tree и source delta с ранее изученной архитектурой. `line_native_support_003` проверил topology/Fixed и exact #216; `solved_profile_review` — полный profile scope, последняя STATUS-строка проверена отдельно. Это read-only agent reviews, не формальный GitHub APPROVED.

- `build/rspack.asa.config.cjs → src/web/index.tsx → App` монтирует одну KOMPAS shell. Desktop/tablet/phone используют общие typed actions; legacy fallback удалён.
- `CadApplication` владеет authoritative document/history и durable commands. Shell store хранит presentation; selection/context находятся в общих UI owners. Не всё UI selection буквально хранится в `CadApplicationState.selection`.
- UI → typed command → ASA application/runtime → PlaneGCS/solved DTO → OpenCascade B-Rep → render adapter. Three.js отображает производные данные; snapshots/projections/request refs не создают вторую историю/модель.
- Fixed, profile, overlay и browser runtime используют shared coordinator/backend. Это не утверждение о единственном native instance во всех процессах/fixtures.
- Host/`CadProjectSession`/recovery сохраняют serializable intent. Schema/миграции не заменены; contract/migration/semantic tests прошли. ACK, failed Save/Open, stale async и dirty/history проверены отдельно.
- Registry binding, поддерживаемые шесть document kinds и source/runtime/vendor boundaries проверены CI. Готовность Part не означает готовность всех остальных редакторов.

Frozen ceilings не повышались. Ratchets снижены: feature controller 7766→6928 B, workspace 7303→6704 B, OCC runtime 15119→12293 B. `CadApplicationImpl` 12274 B близок к target 12288: новая responsibility требует extraction. Сохранены 14 frozen и 6 grandfathered ограничений; не все файлы ниже soft target.

Fixed browser runner 12436 B выше soft 8192, ниже hard 14336; независимый review подтвердил связный 17-case corpus. Generated evidence рассмотрено отдельно от продуктовых owners. Tracked logs/cache/build output не добавляются: полные log bytes находятся внутри JSON.

## 4. Реальные пользовательские проверки

Exact candidate `490b5b18219698f02034b0d7fc90d97ecc4f0b12`: **9/9 PR jobs SUCCESS**. Product jobs checkout synthetic `b795519c5d3229b3e9c30d329f06beeca360645f`, capture jobs — direct candidate. Их trees равны audited merge tree. После merge `128480e`: **6 workflows / 8 jobs SUCCESS**, включая integration guard.

M2/M3 проверили обычные mouse/touch маршруты, параметры, историю, Save/Open, responsive/UI Scale и selection. Ordinary Fixed: solved Horizontal Line → search/mobile Fixed → drag rejection → Undo/Redo → Save/Open. Docker проверил health/release metadata, lazy root/`/cad` и Protected Part.

Protected Part: Sketch 60×40 → Extrude 10 → Ø12 Cut → Fillet R1 → width 60→80 → rebuild → Save/Open → edit again. Browser test после открытия меняет Ø12→Ø14; Node performance после открытия выполняет recompute. Эти покрытия различаются.

[Before/after PNG](../spec/process/evidence/health-audit-20261107/visual/manifest.json): восемь actual SHA проверены; четыре пары побайтно одинаковы, desktop/phone просмотрены root. Условия: новый Part, light, UI Scale 100%, исходные camera/tree; 360×640, 768×1024, 844×390, 1600×900. Это сохранение этих состояний, не final visual parity. ZIP SHA: `11401e61f438a1afb352d9d8ec5265e61e25abd9092514bef4ab8aace9e16301`.

Expanded full-web check включает web roots и tracked UI fixtures: baseline d948 8 / candidate 8; наборы file/code/category/message совпали, new 0. **Full-web typecheck не PASS.** Успешные public/fixture checks этот долг не скрывают.

## 5. Принятая performance-база

Контролёр принимает STANDARD run на audited SHA как наблюдаемую исходную базу. Frozen `acceptedBaseline:false` сохранён: инструмент не выдаёт техническую приёмку. Pilot его не заменяет.

Intel Core i5-13400, Windows x64, Node 22.23.3. **10 phases / 16 cases / 106 samples / 20 warmups**, failures/unattempted 0. Correctness/identity/source/cleanup guards прошли; шесть fresh cold processes завершились.

Полные samples/configs/corpus/logs: [raw report](../spec/process/evidence/health-audit-20261107/measurement/performance-report.json). Все min/median/max: [numeric summary](../spec/process/evidence/health-audit-20261107/numeric-summary.json). Независимый reviewer пересчитал 53 case summaries и четыре cold metrics.

Ниже медианы в миллисекундах. Warm cohort: n=10 плюс 2 отдельных warmups; cold: n=3/backend без warmups. Warmups не входят в медианы.

| Warm corpus | 8 линий | 32 линии | 128 линий |
| --- | ---: | ---: | ---: |
| PlaneGCS solve без browser LRU | 0.7126 | 1.7446 | 9.7728 |
| Execute batch | 1.4488 | 13.1590 | 181.8789 |
| Undo batch | 2.9222 | 33.6180 | 456.8473 |
| Redo batch | 2.9114 | 32.2339 | 466.1537 |
| Serialize | 0.0843 | 0.1551 | 0.3907 |
| Parse | 0.0654 | 0.1586 | 0.5093 |
| Memory host save+load | 0.1073 | 0.2760 | 1.0754 |

На линию — Horizontal и driving Length=40. History batch: три команды/entity, 24/96/384 frames; проверены промежуточные snapshots/IDs/refs. Таблица даёт время всего batch, не одного Undo. Serialized corpus: 4462/16434/64394 B.

| Protected Part / cold | Медиана, мс | Min–max, мс |
| --- | ---: | ---: |
| Rebuild width 60 | 80.0923 | 64.4666–106.7469 |
| Изменение width | 0.1723 | 0.1145–0.1924 |
| Rebuild width 80 | 86.9630 | 57.4342–101.5915 |
| Host Save/Open | 0.2359 | 0.1376–0.3297 |
| Reopened recompute | 90.5965 | 61.1513–105.5258 |
| Fresh Node PlaneGCS init | 13.4772 | 13.1966–14.8301 |
| First solve | 13.6027 | 12.2494–14.8958 |
| Fresh Node OpenCascade init | 5066.6860 | 4987.8600–5193.4977 |
| First OCC recompute | 36.8758 | 31.9703–39.5887 |

Один host, последовательные workers; CPU/OS cache не контролировались. Cold — новый Node process, не browser startup или очищенный disk cache. Memory host не измеряет сеть/диск/IndexedDB latency. Browser cold/cache-hit — NOT_RUN. Нового SLO, вывода «быстрее» или heap-clean нет; PASS относится к correctness/identity/cleanup, не latency threshold.

## 6. Upstream и зависимости

Vendor не обновлялся: baseline `ccb503144e07c384aa1255c16c17bbe6906aa213`, tree `1b77a174922a125ef0c0d609b9c89248db07ec76`. License-baseline проверяет vendor notices, не выбирает лицензию проекта.

[Dependency report](../spec/process/evidence/health-audit-20261107/measurement/dependency-report.json) связан с audited SHA. Captured npm audit получен 07.11.2026 около 20:02–20:03 UTC; final classifier использовал его исходные bytes без нового сетевого audit.

- 16 affected package entries: aggregate 4 High / 12 Moderate / 0 Critical.
- 21 уникальный GHSA: 12 High / 7 Moderate / 2 Low, семь leaf packages. Это другой знаменатель.
- Graph: 217 source files, 6 npm roots, unresolved literal imports 0. Dependencies/optional/peers closure не пересекается с affected nodes.
- Реальный импорт `opencascade.js` учтён вопреки dev-флагу lock. Один dev-флаг не доказывает runtime isolation.
- Docker final: Caddy 2.10.2/static dist, без Node/node_modules. Это static import/packaging analysis, не exploit/bundle/container security proof. Toolchain exposure OPEN.

`npm audit fix`, непроверенные upgrades/downgrades и vendor replacement не выполнялись. `fixAvailable` не принят автоматически как безопасное исправление.

## 7. Открытый долг и gates

Ответственный за три долга — **ChatGPT technical controller `/root`**. Принятие не приписывается Александру. Устранить их необходимо **до технической приёмки U2 / следующей milestone boundary**; последующие slices не вправе ухудшать долг.

| ID | OPEN finding | Gate устранения |
| --- | --- | --- |
| HA-20261107-DEPENDENCIES | 16 affected toolchain nodes / 21 GHSA; High findings не исправлены. | Отдельный reviewed compatibility-tested repair, новая classification/audit; не увеличивать exposure. Также обязательный pre-beta gate. |
| HA-20261107-WEB-TYPES | 8 errors: App 3, ParameterPanel 1, SketchDimensionParameterPanel 1, SketchInteractionSurface 3. | Полный web+fixture check должен стать PASS; до этого запрещены новые diagnostics, сохранения одного количества недостаточно. Frozen owners не растут. |
| HA-20261107-VENDOR-LIFETIME | P2: StableRef оставляет owning Current/FindKey wrappers в subMap/nthSub/resolve/nearestFaceIndex/vertexCloudScale. | Native ownership repair + actual handle regression без замены matching/schema; также **до расширения этих paths**, если это раньше U2 exit. |

Vendor canonical SHA `53d6bf536c1c7cc08a6ca9c501e131f0038f253ef94b276f79233976a13cb35c` неизменён. Удаление explorer/map и cast result не удаляет промежуточные wrappers. ASA test очищает наблюдаемые vendor handles в finally: его PASS не означает vendor-memory-clean. RSS, growth rate, OOM и верхняя граница накопления не измерялись. Non-growing debt — запрет расширения дефекта, не доказанный предел роста памяти.

Отдельные release/owner gates остаются открыты:

- Main не содержит repairs; integration → main и production требуют owner decision.
- Корневые LICENSE/THIRD_PARTY_NOTICE отсутствуют: существующий pre-beta gate, vendor notices его не заменяют.
- `DETECT_ONLY` / `ADMIN_BRANCH_PROTECTION_NOT_ENFORCED` — KNOWN_RISK. Detector не даёт prevention/ENFORCED; по действующему разрешению это не блокирует U2.
- Owner final visual/theme parity и product acceptance — PENDING.

## 8. Сохранность evidence и продолжение

[Measurement manifest](../spec/process/evidence/health-audit-20261107/measurement/manifest.json) SHA:
`d6346a4afe203568d0238455a425cbe042fc43351a1d07a632114812bfdbc426`.

11 файлов восстанавливают 76 originals / 3501851 B. Writer проверил Buffer.equals с originals; независимый reviewer декодировал все 76 и проверил length/SHA. Raw report 1509008 B прошёл large-artifact review и соблюдает hard 2 MiB.

[Repair manifest](../spec/process/evidence/health-audit-20261107/repairs/manifest.json) SHA:
`c245f4e3684239d02fbbe2bc4bc6c976f0a61766ce29e0e036dfc0dae5998fd1`.

16 JSON сохраняют 119 originals / 1813814 B, включая полные RED logs; roundtrip 119/119, expected mismatches/unresolved refs 0. Четыре aliases разрешены явно, исходные JSON сохранены. Один Temp checker имеет только current capture hash, не historical expected hash. Node_modules/build bundles не скопированы.

Из корня checkout:

```sh
node spec/process/evidence/health-audit-20261107/measurement/harness/evidence-archiver.mjs verify --archive spec/process/evidence/health-audit-20261107/measurement --manifest-sha d6346a4afe203568d0238455a425cbe042fc43351a1d07a632114812bfdbc426
```

Для повторного measurement восстановить harness вне измеряемого Git worktree, использовать сохранённые args/config, чистый exact SHA и внешний output. Нужные inputs восстанавливаются без прежних Temp paths. Frozen `acceptedBaseline:false`/`auditAccepted:false` сохранены; решение контролёра отдельно в разделе 1.

#170 — immutable reference, #177 — reuse после exact review, #179 — отдельный Drawing/schema candidate. Fusion Draft #204–#207 не слиты автоматически; installer и пользовательские документы/8099 не изменялись.

U2: Line/Rectangle/Circle/Arc, числовой ввод и Sketch-in-Viewport через существующие commands. Acceptance: Part → XY → Sketch → Rectangle 60×40 → Undo/Redo → Save/Open → те же intent/IDs. К1/U1 не реализуются заново; разрешение следующего checkpoint не означает его выполнение.
