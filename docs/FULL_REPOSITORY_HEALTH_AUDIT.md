# Full Repository Health Audit — 08.11.2026 после Rectangle

## 1. Техническое решение и точная база

**YELLOW_ACCEPTED — prospective решение ChatGPT technical controller `/root`** по `OWNER_APPROVED_CONTINUOUS_ROADMAP_20261008`. Оно вступает в силу только после exact-head CI, независимого review отчёта/state/evidence и merge этого audit PR в integration. В рассмотренном объёме новых подтверждённых product/runtime/compatibility blockers не найдено. Новый upstream follow-up остаётся OPEN с owner/gate раздела 6. Owner product/visual acceptance — **PENDING**; U2 целиком не принят.

- Audited product: `b8f700bb6e455582db18df8d0ba43a2bfbdcc68b` (#224), tree `ccb7c9b0afb8b1c1ad1d40beba8d73d45de3e2e4`.
- Измерялся чистый checkout audited SHA. Будущий commit docs/evidence имеет другой SHA и не называется измеренным продуктом.
- После #221 приняты три permanent slices: #222 Numeric Line, #223 CI/build Node, #224 Rectangle acceptance. Принятие этого полного аудита закрывает cadence 3/3 и возвращает U2; следующий audit — после трёх следующих accepted slices либо на milestone boundary.

[Evidence index](../spec/process/evidence/health-audit-rectangle-20261108/acceptance-index.json) связывает оригиналы, hashes, CI и reviews. Raw `acceptedBaseline:false`, `technicalAcceptance:PENDING` и `ownerProductAcceptance:PENDING` не изменены: инструмент не принимает собственный результат. Acceptance этого PR отдельно от успешного measurement.

История сохранена: [#221 на принятом 9608395](https://github.com/spikeal8-maker/ASA-CAD/blob/96083954f0180720e7a51616bc6039bde75fa683/docs/FULL_REPOSITORY_HEALTH_AUDIT.md) и [#217 на принятом 20603c3](https://github.com/spikeal8-maker/ASA-CAD/blob/20603c34f277dc9f0cf2696f5bd3971dd7645678/docs/FULL_REPOSITORY_HEALTH_AUDIT.md), включая исходные RED/GREEN receipts. Их прежние outcomes не переписаны.

## 2. Принятые deltas и обычный маршрут

| Slice | Техническая приёмка | Что доказано |
| --- | --- | --- |
| [#222 Numeric Line](https://github.com/spikeal8-maker/ASA-CAD/pull/222) | Merge `a62a5b50c002e1ea9137a3741942d7349d3303a7`; latest PR 9/9, post-merge 8/8 SUCCESS | Frozen #170 numeric UX подключён к прежнему `sketch.line`; временные locks, keyboard/focus, repeat с новой первой точкой, Undo/Redo и Save/Open IDs. Persistent constraints этим не вводились. |
| [#223 Node toolchain](https://github.com/spikeal8-maker/ASA-CAD/pull/223) | Merge `5781e3930cd08d9bada0e0b921ddf28e8a83dcbc`; latest PR 9/9, post-merge 8/8 SUCCESS | CI/Docker builders pin 22.23.4, включая обе стороны visual builds. Own engines согласованы; package versions/resolved/integrity сохранены. Отдельная разрешённая Windows проверка нового portable runtime прошла. |
| [#224 Rectangle acceptance](https://github.com/spikeal8-maker/ASA-CAD/pull/224) | Merge `b8f700b`; latest PR 3 workflows / 5 jobs, post-merge 4 workflows / 6 jobs SUCCESS, attempt 1 | Test-only усиление ordinary Part → XY → Sketch → Rectangle 60×40 → Undo/Redo → Save/Open. Product/UI bytes не менялись. |

Raw CI/checkout/tree receipts сохранены в `acceptance/pr222.json`, `pr223.json`, `pr224.json`; это product proof, не новый browser run этого audit PR. Первый #224 failure по Six document kinds marker сохранён: исправлен STATUS, assertion не ослаблен.

Rectangle proof сравнивает до Undo, после Redo и после Open десять полей: `documentId, kind, schemaVersion, engineVersion, units, sketches, constraints, dimensions, features, stableReferences`. Это выбранная проекция intent, а не побайтное сравнение всего CadPartDocument. Одновременно проверены live SVG entity IDs, Sketch/support и solved bounds на трёх стадиях; DOM counts **0/4/4**. Наблюдаемые размеры **60.00000652782419 × 39.99999755206592 мм** сохранены в raw JSON. Invalid/ghost/touch assertions retained; предмет создаётся обычными действиями без скрытой мутации fixture.

Windows proof на `5781e393`: fresh private dependencies, npm run check, checkpoint/canonical и три Line browser entrypoints PASS; source unchanged, owned resources закрыты. `acceptance/windows.json` сохраняет receipts, все 16 validation streams и browser checks. Закрыты CI/build и выбранный portable ASA **22.23.4/npm10.9.9**, без заявления об обновлении global/default Node или прежних процессов.

UI не меняется: новые captures **N/A**. Применимые #222/#223 matched evidence и Node20→Node22 comparison сохранены по hashes/CI links; ZIP не дублируются. Root просмотрел actual numeric PNG; Numeric Line owner visual verdict и общая parity **PENDING**.

## 3. Свежая проверка общей базы

[Run receipt](../spec/process/evidence/health-audit-rectangle-20261108/run.json): **09:16:54.229–09:18:23.490 UTC**, один запуск, **9/9 phases PASS**. Все 11 final guards true: исходники, Node/npm, frozen tools и собственные physical dependencies неизменны; checkout clean; все worker processes закрылись; timeout/interruption отсутствуют. Wrapper не открывал browser/server.

| Область | Факт на b8f700b |
| --- | --- |
| Full web + UI fixtures | **0 diagnostics/errors**, TS 5.9.3. 188 configured roots; frozen exact-string Set даёт 190, но **188 физических файлов**. Два aliases — те же Fixed/Profile fixtures с разными разделителями пути. |
| Native lifetime | **14 PASS / 0 FAIL**, **699 owning wrappers created / 0 live до cleanup**. Current/FindKey observations непустые; success/error paths проверены. |
| Fresh npm audit | 09:18:17.691 UTC, registry.npmjs.org, exit 0, vulnerabilities пусты; severity counts все 0. Effective omit пуст, NODE_ENV не задан: dev scope включён. |
| Dependency/import graph | **223 unique source files**, **6 runtime npm roots**, unresolved literal imports **0**, affected entries/advisories/reachable affected nodes **0**. |
| STANDARD correctness | **10 phases / 16 cases / 106 measured samples / 20 warmups**; failed и unattempted = 0. |
| Lossless archive | **73 originals / 3 427 072 B**, 11 archive files; каждый original восстановлен и побайтно совпал с original и roundtrip. |

Npm metadata: prod 20 / dev 264 / optional 43 / peer 60 / peerOptional 0 / total 283. Категории пересекаются и не являются числом физических пакетов Windows. Runtime roots: PlaneGCS, OpenCascade, React, React DOM, Three.js, Zustand. Статический graph не разрешает произвольные nonliteral imports.

Frozen tools сохраняют исторические literals: classifier — `ANALYZED_FINDINGS_REMAIN_OPEN`; archive/archiver — прежнюю OPEN limitation vendor lifetime. Это неизменённые исторические literals, а не текущие ненулевые counts. Disposition определяется новыми данными и review. Npm audit не проверяет Node runtime; native corpus доказывает scoped wrapper cleanup, не чистоту или bounded heap всего WASM/vendor.

Независимый `health_audit_review` проверил raw и все 73 originals без rerun. [Physical roots](../spec/process/evidence/health-audit-rectangle-20261108/analysis/physical-roots.json) — config parse + realpath grouping, без повторной компиляции.

## 4. Performance: наблюдения и пределы сравнения

[Numeric summary](../spec/process/evidence/health-audit-rectangle-20261108/analysis/numeric-summary.json) содержит **53 case-metric rows + 4 cold aggregates**, n/min/median/max, measured и warmups отдельно. [Comparison с #221](../spec/process/evidence/health-audit-rectangle-20261108/analysis/comparison.json) сохраняет обе выборки, raw pointers, observed differences/ratios и environment identities.

Windows 10.0.26300 x64, i5-13400 / 16 logical CPU, RAM 68 384 935 936 B, Node **22.23.4**, npm **10.9.9**. STANDARD: sizes 8/32/128, 10 measured + 2 warmups на обычный case; три свежих процесса на каждый cold backend без warmup.

Текущие медианы, **ms**, округление до трёх знаков:

| Метрика | 8 entities | 32 entities | 128 entities |
| --- | ---: | ---: | ---: |
| PlaneGCS solve | 0.757 | 1.602 | 10.207 |
| History execute batch | 1.479 | 13.146 | 179.333 |
| History undo batch | 2.989 | 33.904 | 439.801 |
| History redo batch | 2.588 | 32.684 | 445.727 |
| Serialize | 0.099 | 0.151 | 0.360 |
| Parse | 0.083 | 0.163 | 0.433 |
| Memory host Save/Load roundtrip | 0.154 | 0.317 | 0.724 |

History batches имеют 24/96/384 frames. `PerCommandMs` = batch duration / frames внутри каждого sample, затем статистика этих средних; это не медиана отдельных command latencies.

Часть наблюдаемых медиан выросла:

| Метрика, ms | #221, Node22.23.3 | Текущий, Node22.23.4 |
| --- | ---: | ---: |
| Protected rebuild60, n=10 | 68.210 | 92.676 |
| Protected rebuild80, n=10 | 81.686 | 91.966 |
| Reopened recompute, n=10 | 74.724 | 90.185 |
| Cold OCC init, n=3 | 5151.470 | 5557.609 |
| Cold OCC first recompute, n=3 | 31.470 | 35.617 |
| Cold PlaneGCS init, n=3 | 15.414 | 14.705 |
| Cold PlaneGCS first solve, n=3 | 14.098 | 12.997 |

Cold aggregates объединяют существующие samples, не добавляют попыток. Internal performance duration **52 907.5314 → 59 611.001 ms** отличается от длительности worker process и внешнего wrapper. Эти наблюдения не скрываются и не получают автоматический «no regression» или «faster» verdict.

С #221 совпадают frozen tools/protocol, fixture recipe/counts и serialized DTO sizes, пять installed package identities и 19 runtime assets. **Source files 411 → 416**, source fingerprint и lock hash различаются; единственная semantic lock delta — own `packages[""].engines.node`. Остальные 283 non-root records и поля lock совпадают. Node **22.23.3 → 22.23.4** и его component versions изменились. Все 16 fixture pairs имеют разные UUID/raw hashes; serializedBytes не включает конечный LF, physical fixture file на 1 B больше.

Free RAM: **24 498 601 984 → 22 406 881 280 B**. CPU affinity/frequency, внешняя нагрузка, GC и OS cache не контролировались. Это разные observational cohorts, не причинный эксперимент: изменения медиан нельзя приписать одному repair, Node patch или UI. Latency SLO, browser cold-start, cache-hit, disk/network Save/Open и native heap/RSS не измерены.

Независимая проверка derived stats/comparisons/pointers/corpus/roots: mismatch 0. Повторных измерений нет. Этот run становится наблюдаемой baseline только после условий раздела 1, без SLO-обещания.

## 5. Архитектура, owners и совместимость

[Independent architecture review](../spec/process/evidence/health-audit-rectangle-20261108/reviews/independent-architecture-review.json): APPROVE, новых blocking findings 0; exact b8f700b против audited 7bf71e2.

- Product delta — только 11 `src/web` owners. Application 17 / contracts 17 / host 6 / runtime 7 / browser 7 и vendor src 158 файлов неизменны.
- Numeric Line хранит один transient draft, pure projection и использует прежний `sketch.line`. Flight/epoch/document ownership не создают вторую document/history/storage/solver model.
- Canonical wrappers всегда ведут в `src/web/kompas`; breakpoint меняет layout. Legacy parameter prop не восстанавливает альтернативную оболочку.
- CadApplication/CadDocument → ASA runtime/общий PlaneGCS → solved DTO/profile → OpenCascade B-Rep → render. Three.js отображает результат; отдельные test/native instances не становятся authoritative models.
- Schema v1/v2/v3, migrations, release schema, host persistence и stable-reference semantics не менялись. Existing Protected Part и Save/Open evidence остаются применимы; готовность Part не означает готовности всех шести редакторов.

Все **14 frozen** owners без роста, **6 grandfathered** ceilings сохранены. Три ratchets уменьшены: App −59 B, ParameterPanel −992 B, EditingController −9 B. **20 source owners ≥85% target, 8 выше soft target**; CadApplicationImpl **12 274 / 12 288 B**, осталось 14 B. Новая responsibility требует extraction, не повышения ceiling.

На audited b8f700b: 520 first-party files; forbidden artifacts, hard >2 MiB и current src/build/tests exact duplicates — 0. Historical archive/image/vendor duplicates сохранены. PR: 5 canonical + 44 evidence = 49 paths; большой generated footprint/файлы >512 KiB требуют независимого review, hard 2 MiB не повышается.

## 6. Новый открытый follow-up

**NODE_SECURITY_RELEASE_20261111_PENDING — OPEN_PENDING_UPSTREAM_RELEASE, scoped YELLOW.** Owner: ChatGPT technical controller `/root`. [Official Node announcement](https://nodejs.org/en/blog/vulnerability/november-2026-security-releases?trk=public_post_comment-text), обновлённый **03.11.2026**, объявляет security releases 22.x/24.x/26.x на **11.11.2026 или вскоре после**; highest severity для 22.x — **HIGH**. Конкретные CVE и target patch version не названы. [Официальный archive](https://nodejs.org/en/download/archive/v22) на момент проверки показывает 22.23.4. [Source review](../spec/process/evidence/health-audit-rectangle-20261108/reviews/upstream-source-review.json) — structured paraphrase с URLs/date/ограничениями, не raw HTML.

Прежний `NODE_TOOLCHAIN_EOL_AND_SECURITY_PATCH_GAP` остаётся **CLOSED_FOR_SELECTED_ASA_PROJECT_TOOLCHAIN** после #223 и отдельного Windows proof. Новый follow-up не переписывает старое закрытие. ASA-specific exploit reachability **NOT_ESTABLISHED**; npm audit=0 не доказывает безопасность Node runtime или всей машины.

**Gate:** после публикации supported fix проверить release/reachability и выполнить применимый отдельно reviewed toolchain update **до технической приёмки U2 или следующей milestone boundary, если раньше, и до beta**. До этого не увеличивать Node exposure. Если fix не опубликован к gate, долг остаётся OPEN и требуется явная evidence-based disposition; дата 11 ноября не даёт автоматический PASS. Новая установка D2 runtime не считается разрешённой для ещё неизвестной версии. Автоматическая установка/напоминание не создавались.

YELLOW имеет явный owner/gate без нового подтверждённого hard/frozen/correctness violation. Отдельно сохраняются LICENSE/THIRD_PARTY_NOTICE pre-beta, `DETECT_ONLY` / `ADMIN_BRANCH_PROTECTION_NOT_ENFORCED` как KNOWN_RISK, owner acceptance и main/production gates.

## 7. Сохранность evidence и продолжение

[Measurement manifest](../spec/process/evidence/health-audit-rectangle-20261108/measurement/manifest.json):
`1b665718dea5953e0bb446a132ed1a9395c12bdcdd7b7ba9907feee81a0cbda7`.
11 файлов скопированы verbatim; **73/73 originals / 3 427 072 B** независимо декодированы и сравнены с original/roundtrip. Raw performance — **1 508 686 B**, ниже hard 2 MiB.

Publication: **44 evidence files / 85 explicit originals**. Каждый base64/gzip+base64 payload сверяется по length/SHA и bytes с original. Сохранены 10 setup streams (5 пустых stderr) и все 16 Windows validation streams. Cache/node_modules/build/ZIP/binaries и дубли raw performance/roundtrip исключены. Nested source/build/binary/ZIP references остаются provenance; полный closure окружения не заявляется.

Локальный `.gitattributes` задаёт `** -text`; physical CRLF в опубликованных originals отсутствует, дополнительное whitespace-исключение не вводится. Исторические #217/#221 evidence не менялись. Проверка текущей копии из корня checkout:

```sh
node spec/process/evidence/health-audit-rectangle-20261108/measurement/harness/evidence-archiver.mjs verify --archive spec/process/evidence/health-audit-rectangle-20261108/measurement --manifest-sha 1b665718dea5953e0bb446a132ed1a9395c12bdcdd7b7ba9907feee81a0cbda7
```

Далее — незавершённый U2 через existing commands/frozen #170. Numeric/Rectangle proof не завершает Line/Rectangle/Circle/Arc numeric UX. Ожидающая Numeric область — после visual verdict. K1/U1 не повторяются; #177 требует exact review, #179/Fusion отдельно. Пользовательские документы, установленный Fusion и порты 8094/8098/8099 сохранены.
