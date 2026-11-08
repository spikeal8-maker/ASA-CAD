# Full Repository Health Audit — 08.11.2026

## 1. Техническое решение

**YELLOW_ACCEPTED — решение ChatGPT technical controller `/root`** по `OWNER_APPROVED_CONTINUOUS_ROADMAP_20261008`. Оно вступает в силу после exact-head CI, независимого review этого отчёта/состояния/evidence и merge audit PR в integration. В проверенном объёме новых подтверждённых runtime/compatibility blockers нет; отдельный Node toolchain debt остаётся OPEN с gate раздела 6. Owner product/visual acceptance — PENDING.

- Audited product: `7bf71e2ee8ece045fb69620c657570ce7be9294f` (#220); tree `899f3a888a0c14173b6117cf8ea52ab4d6f4b40c`.
- Проверенный main: `1f8d2627da7ddfa63b31876d46347d0b8080c154`; перенос repairs в main/production требует решения владельца.
- Измерялся чистый checkout audited SHA. Позднейший commit отчёта/evidence имеет другой SHA; измерения ему не приписываются.
- #218, #219, #220 дали 3/3 accepted slices после #217. Принятие этого повторного Full Repository Health Audit закрывает cadence и возвращает checkpoint U2. Следующие accepted slices считаются от этой точки; milestone boundary всё равно требует аудит.

[Evidence index](../spec/process/evidence/health-audit-repeat-20261108/acceptance-index.json) связывает raw receipts, hashes, CI и независимые reviews. Исходные `acceptedBaseline:false` / `technicalAcceptance:PENDING` сохранены: инструмент не принимает собственный результат. Решение контролёра задаётся этим разделом и точной приёмкой PR.

## 2. Долги предыдущего аудита закрыты

| Finding | Принятый repair | Проверенный результат |
| --- | --- | --- |
| HA-20261107-WEB-TYPES | [#218](https://github.com/spikeal8-maker/ASA-CAD/pull/218), merge `6efe79c` | Full web 8 → 0 diagnostics; 183 физических roots/fixtures. Постоянный `typecheck:web` в M2; PR 9/9, post-merge 8/8. |
| HA-20261107-VENDOR-LIFETIME | [#219](https://github.com/spikeal8-maker/ASA-CAD/pull/219), merge `8684b56` | Тот же actual OCC corpus: 0 PASS / 14 FAIL → 14 PASS / 0 FAIL; 451 live owning wrappers → 0. PR 5/5, post-merge 6/6. |
| HA-20261107-DEPENDENCIES | [#220](https://github.com/spikeal8-maker/ASA-CAD/pull/220), merge `7bf71e2` | 16 affected entries / 21 GHSA → свежий npm audit total 0. PR 9/9, post-merge 8/8; clean install/build/полный lint PASS. |

#218 сохранил strict checks и runtime semantics. #219 ограничен ownership/cleanup в StableRef, без замены matching/tolerances/schema. #220 меняет 13 dev package records: 12 обновлений и одно добавление; 23 других direct pins, runtime assets и platform optional records сохранены. Pinned vendor не заменялся и не обновлялся автоматически.

Новый lint guard сверяет фактически обработанный ESLint набор с независимым Git inventory. Windows до/после: побайтно одинаковый raw output; Linux exact CI artifact: те же **154 unique files, 0 errors/fatal, 43 warnings (17 fixable)**. Шесть отрицательных guard cases отвергают missing/duplicate/empty/outside/ignored/error результаты. Package/lock delta теперь запускает существующие browser/visual jobs.

Первый #220 M2 shell CI отклонил отсутствие слова «продуктовая» в STATUS. Исправлена только строка документа; assertion не ослаблен, полный applicable CI повторён. Исходный failure сохранён вместе с успешными receipts.

## 3. Свежая проверка общей базы

[Run receipt](../spec/process/evidence/health-audit-repeat-20261108/run.json): 08.11.2026 00:11:05.673–00:12:21.153 UTC, **9/9 phases PASS**, без timeout/truncation/spawn error. Source fingerprint до/после одинаков; исходники, Node/npm, frozen tools и собственный physical node_modules не менялись во время измерения. Все созданные worker processes закрылись; wrapper не открывал browser/server.

| Область | Результат на `7bf71e2` |
| --- | --- |
| Full web + UI fixtures | **0 errors/diagnostics**, TS 5.9.3; 185 raw root paths = 183 физических файла, два fixture aliases различаются разделителями пути. |
| Native lifetime | **14 PASS / 0 FAIL; 699 созданных owning wrappers, 0 live до test cleanup**. Проверены success/error paths и non-empty Current/FindKey observations. |
| Fresh npm audit | 00:12:17.848 UTC, registry.npmjs.org, exit 0, vulnerabilities пусты, все severity counts 0. `omit:''`, NODE_ENV не задан: dev dependencies включены. |
| Dependency graph | 218 unique source files, 6 runtime npm roots, 0 unresolved literal imports, 0 affected entries/advisories/reachable affected nodes. |
| STANDARD | 10 phases, 16 cases, 106 measured samples, 20 отдельных warmups; failed/unattempted = 0. |

Npm graph metadata: prod 20 / dev 264 / optional 43 / peer 60 / peerOptional 0 / total 283. Категории пересекаются; это не число физических пакетов конкретной платформы. Шесть roots: PlaneGCS, OpenCascade, React, React DOM, Three.js, Zustand. Статический graph не разрешает произвольные nonliteral imports.

Frozen classifier сохраняет строку `ANALYZED_FINDINGS_REMAIN_OPEN` и старые limitation strings даже при нулевых counts; текущая disposition определяется фактическими данными и контролёром. Npm audit не проверяет Node runtime; native corpus проверяет определённые handle lifetimes, без вывода о bounded heap всего WASM/vendor.

### Correctness и обычный пользовательский маршрут

Для #220 проверены candidate `dda21b6d57c3907d88fb374032f8ea108de9c453`, synthetic checkout `fcdc2189209c2a577fd0a625c066382c4385b2d8` и merge `7bf71e2`: их продуктовый tree совпадает. **9 PR jobs SUCCESS**, затем **8 post-merge jobs SUCCESS** на фактическом merge checkout. Полные raw CI receipts и IDs сохранены в evidence index.

M1/M1b/M2/M3 покрывают architecture, contracts/migrations, history/recovery, solver, actual OCC, ordinary mouse/touch, Save/Open, responsive/UI Scale и selection. Docker проверяет release metadata, lazy root/`/cad` и Protected Part:
Sketch 60×40 → Extrude 10 → Ø12 Cut → Fillet R1 → width 60→80 → rebuild → Save/Open → edit again. Browser после открытия меняет Ø12→Ø14; performance после открытия делает recompute — эти покрытия различаются.

Actual #220 visual ZIP сохранён: 15 image hashes/dimensions проверены; четыре matched before/after пары побайтно одинаковы. Новый Part, light, UI Scale 100%, исходные camera/tree; 360×640, 768×1024, 844×390, 1600×900. Root просмотрел и показал desktop/phone PNG. Это сохранение этих состояний, не final visual parity.

Собственный CI audit PR проверяет docs/evidence/state на новом commit. Его результаты не заменяют перечисленные product/browser/Docker runs и не выдаются за новые browser measurements.

## 4. Performance-база

Контролёр принимает STANDARD run на audited SHA как наблюдаемую базу после выполнения условий раздела 1. [Полная статистика](../spec/process/evidence/health-audit-repeat-20261108/analysis/numeric-summary.json) содержит 53 case-metric rows и 4 cold aggregates, n/min/median/max для measured и warmups раздельно. [Сравнение с #217](../spec/process/evidence/health-audit-repeat-20261108/analysis/comparison.json) сохраняет обе выборки и raw JSON pointers.

Windows 10.0.26300 x64, i5-13400 / 16 logical CPU, RAM 68 384 935 936 B; Node 22.23.3/npm 10.9.9. Тот же STANDARD: sizes 8/32/128, 10 samples + 2 warmups на обычный case; три свежих процесса на каждый cold backend, без warmup.

Медианы, **ms**, округление до трёх знаков:

| Метрика | 8 entities | 32 entities | 128 entities |
| --- | ---: | ---: | ---: |
| PlaneGCS solve | 0.615 | 1.719 | 9.979 |
| History execute batch | 1.488 | 11.281 | 165.258 |
| History undo batch | 3.086 | 32.084 | 415.774 |
| History redo batch | 2.934 | 32.803 | 397.720 |
| Serialize | 0.076 | 0.141 | 0.305 |
| Parse | 0.067 | 0.151 | 0.406 |
| Memory host Save/Load roundtrip | 0.101 | 0.256 | 0.732 |

History batches содержат 24/96/384 command frames. `*PerCommandMs` в JSON — batch duration / frames внутри sample, затем медиана этих средних; это не p50 отдельных command latencies.

Protected Part, n=10: rebuild60 **68.210 ms**, rebuild80 **81.686 ms**, reopened recompute **74.724 ms**. Cold Node, n=3: PlaneGCS init **15.414 ms**, first solve **14.098 ms**; OCC init **5151.470 ms**, first recompute **31.470 ms**. Cold aggregates объединяют уже учтённые samples, не добавляют их.

С #217 совпадают protocol/cohorts, четыре frozen performance tools, полный Node versions, OS/CPU, пять package identities и 19 GCS/OCC/loader assets. Recipe/counts/serialized sizes одинаковы; generated IDs и hashes всех 16 fixture pairs различаются. Corpus сопоставим, но не побайтно одинаков. Product source/lock изменились; tracked source files 409 → 411.

CPU affinity/frequency, GC и OS cache не контролировались. Free RAM 27 984 961 536 → 24 498 601 984 B; elapsed 55 371.3731 → 52 907.5314 ms — два наблюдения, без доказательства ускорения/регрессии или причинного эффекта repairs. Browser cold-start, cache-hit, сетевой/дисковый Save/Open, native heap cleanliness и latency SLO не измерены.

Независимый `health_audit_review` пересчитал raw и derived: 342 stat objects, 228 differences/ratios, 118 pointers и 108 normalizations; mismatch 0. Performance harness и данные не изменялись ради результата.

## 5. Архитектура, owners и совместимость

Архитектурная база [#217](https://github.com/spikeal8-maker/ASA-CAD/blob/20603c34f277dc9f0cf2696f5bd3971dd7645678/docs/FULL_REPOSITORY_HEALTH_AUDIT.md) сохраняется с независимо рассмотренными deltas #218–#220:

- `build/rspack.asa.config.cjs → src/web/index.tsx → App → src/web/kompas`: одна продуктовая оболочка desktop/tablet/phone, общие typed actions.
- CadApplication/CadDocument владеют authoritative intent/history; presentation store, shared UI selection и snapshots не создают второй CAD model.
- UI → ASA application/runtime → shared PlaneGCS/solved DTO → OpenCascade B-Rep → render. Three.js отображает результат; это не утверждение о единственном native instance во всех fixtures/processes.
- Host/session/recovery сохраняют serializable intent. Schema/миграции, matching contract и supported six document kinds не изменены. Готовность Part не означает готовности всех редакторов.

14 frozen и 6 grandfathered ограничений сохранены; ceilings не повышались. `CadApplicationImpl` близок к target: новая responsibility требует extraction. Не все owners ниже soft target. Этот PR меняет только canonical docs/state и evidence, не продуктовые owners/registry/schema. Большой generated footprint и файлы >512 KiB требуют отдельного независимого review при сохранении hard 2 MiB; сырой evidence не заменяет такой review.

## 6. Открытый долг и отдельные gates

**NODE_TOOLCHAIN_EOL_AND_SECURITY_PATCH_GAP — OPEN, scoped YELLOW.** Ответственный: ChatGPT technical controller `/root`. По [официальному Node schedule](https://raw.githubusercontent.com/nodejs/Release/main/schedule.json) Node 20 завершил поддержку 30.04.2026; CI и Docker build pinned на 20.19.0. D2 использует 22.23.3, раньше [security release 22.23.4 от 21.10.2026](https://nodejs.org/en/blog/release/v22.23.4). Поддержка ветки Node 22 продолжается до 30.04.2027.

ASA-specific exploit reachability **NOT_ESTABLISHED**; support/patch gap подтверждён. Node используется в build/test/dev/static test server, поэтому его нельзя считать повсеместно build-only. Финальный Docker image содержит Caddy, не Node build runtime. Это ограничивает deployment scope, но не закрывает finding.

**Gate: отдельный reviewed toolchain repair с exact CI/compatibility/browser/Docker proof до технической приёмки U2 или следующей milestone boundary, если она раньше; также до beta.** Последующие slices не вправе увеличивать exposure/долг. Новая установка runtime на D2 требует отдельного разрешения по DEVELOPMENT_QUALITY_GATES §5; repo/CI подготовка и разрешённая U2 работа могут продолжаться. Npm audit=0 этот debt не закрывает.

Классификация YELLOW соответствует §6 quality gates: явный owner/gate, без роста и нового hard/frozen/runtime violation в проверенном объёме. Upstream severity не выдаётся ни за доказанную ASA exploitation, ни за отсутствие риска.

Отдельно остаются: LICENSE/THIRD_PARTY_NOTICE pre-beta gate; `DETECT_ONLY` / `ADMIN_BRANCH_PROTECTION_NOT_ENFORCED` как KNOWN_RISK; owner product/final theme/visual parity PENDING; integration → main/production по решению владельца.

## 7. Сохранность и продолжение

[Measurement manifest](../spec/process/evidence/health-audit-repeat-20261108/measurement/manifest.json) SHA256:
`f7edbe5b7d8418a4d5c3572e1f3a8c7f5612ae0d3848639b7458f2802b27cd22`.

11 archive files восстанавливают **73/73 originals / 3 425 509 B**. `line_contract_003` независимо декодировал каждый original без запуска архиватора, сверил bytes/length/hash с originals и roundtrip: missing/extra/mismatch 0, 42 references разрешены. Raw performance report 1 509 336 B, ниже hard 2 MiB.

Исторический #217 архив (76 originals) и repair архив (119 originals, включая RED) не изменены. Разница 76→73: три orchestration/preflight receipts перенесены из performance в новые run/commands/setup; два dependency payloads переименованы и обновлены. Cases/fixtures/samples не исчезли. Setup сохраняет все шесть raw streams, включая пустые stderr, в обратимом JSON-контейнере. Cache/node_modules/build bundles не копируются.

Из корня checkout:

```sh
node spec/process/evidence/health-audit-repeat-20261108/measurement/harness/evidence-archiver.mjs verify --archive spec/process/evidence/health-audit-repeat-20261108/measurement --manifest-sha f7edbe5b7d8418a4d5c3572e1f3a8c7f5612ae0d3848639b7458f2802b27cd22
```

Исторический полный отчёт остаётся доступен по immutable #217 ссылке раздела 5; текущий canonical файл заменяет его актуальную disposition, а не переписывает старые raw results.

Далее U2: Line/Rectangle/Circle/Arc и numeric-entry UX #170 через existing product commands; acceptance Part → XY → Sketch → Rectangle 60×40 → Undo/Redo → Save/Open → те же intent/IDs. Numeric Line candidate подготовлен, его отдельная приёмка впереди. K1/U1 повторно не реализуются. #177 — reuse после exact review, #179 и Fusion #204–#207 — отдельные candidates. Пользовательские документы, installer и порты 8094/8098/8099 не затрагивались.
