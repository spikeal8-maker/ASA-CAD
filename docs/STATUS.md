# ASA-CAD — актуальное состояние

Снимок: 2026-11-07 UTC. Live GitHub и machine pointer имеют приоритет.

## Действующая точка

**Checkpoint = U2. Full Repository Health Audit = YELLOW_ACCEPTED.** Переход этого пакета вступает в силу после exact CI, независимого review и технического merge в integration. Основание: [единый отчёт](FULL_REPOSITORY_HEALTH_AUDIT.md), audited SHA `128480e1a150253359ce44158d5588f6b08f27b8`. Контролёр приёмки — ChatGPT `/root`; owner product acceptance остаётся PENDING.

U2: настоящий Sketch-in-Viewport, Line/Rectangle/Circle/Arc и числовой ввод через существующие product commands. Acceptance: Part → XY → Sketch → Rectangle 60×40 → Undo/Redo → Save/Open → те же intent/IDs. Затем U3 → U4 → U5. Работающие К1/U1 заново не реализуются.

## Канон и принятая база

- Integration: `128480e1a150253359ce44158d5588f6b08f27b8` — одна продуктовая оболочка `src/web/kompas` для desktop/tablet/phone, без legacy fallback.
- Main: `1f8d2627da7ddfa63b31876d46347d0b8080c154`, прежняя версия без текущих repairs. Main/production не обновлены.
- Frozen reference #170: tag `ui-reference-20261004`, SHA `88c535c652dac8b04f0d68fa144cf8486afdc926`; UI/UX reference, не второе CAD-ядро.
- CadDocument/CadApplication/history → typed actions/ASA adapters → PlaneGCS/solved profile/OpenCascade B-Rep; Three.js отображает результат.
- six document kinds: Part, Assembly, Drawing, Fragment, Specification, Text. Реальная готовность редакторов различается.

| Принято | Результат |
| --- | --- |
| #195/#196, U1A/U1B/U1C | Общий U1 технически интегрирован; final visual acceptance отдельно |
| #202 / `1be7bdb` | Общий responsive KOMPAS |
| #209 / `169cb83` | Совместимый CI browser runner |
| #208 / `4381141` | LEGACY-CLEANUP-202 |
| #210 / `03b7956` | Семантическая проверка constraint refs |
| #211 / `82f0146` | Async document/history/render/OCC ownership |
| #212 / `75d5d6e` | Snapshot/atomic recovery acknowledgement |
| #214 / `4af80b6` | Stable topology и временные ASA handles |
| #215 / `d9484da` | Current solved profiles/shared solver lifecycle |
| #216 / `128480e` | Fixed ownership/StrictMode/late result |

Каждый repair принят после exact CI и независимого read-only review. Последний #216: 9/9 PR jobs и 8/8 post-merge jobs SUCCESS; ordinary Fixed и Protected Part/Docker PASS. Четыре actual PNG before/after пары одинаковы. Полная visual/theme parity этим не принята. #213 закрыт как предшественник #215; история сохранена.

## Аудит и обязательный долг

STANDARD measurement на общей базе: 10 phases, 106 samples, 20 warmups, correctness PASS. Raw evidence и воспроизводимый harness сохранены в отчёте. Browser cold-start, SLO и native-heap cleanliness не заявляются.

Три OPEN долга, ответственный ChatGPT `/root`; устранить до технической приёмки U2 / следующей milestone boundary:

- Toolchain: 16 affected package entries / 21 GHSA. Static runtime intersection 0 не закрывает High findings.
- Full-web: 8 прежних diagnostics, новых 0; это не полный typecheck PASS.
- Vendor StableRef lifetime P2: owning Current/FindKey wrappers. Дополнительный gate — до расширения соответствующих paths. ASA cleanup не закрывает vendor leak.

Frozen owners не растут; новый долг/ответственность сверх pressure policy запрещены. LICENSE/THIRD_PARTY_NOTICE остаётся pre-beta gate. `DETECT_ONLY` / `ADMIN_BRANCH_PROTECTION_NOT_ENFORCED` — `KNOWN_RISK`, не ENFORCED и по действующему разрешению не запрет U2.

## Очередь и полномочия

#177 — reuse после exact review; #179 — отдельный Drawing/schema candidate; #204–#207 — отдельная Fusion Draft очередь. Installer не запускался, пользовательские документы/8099 не изменены.

Действует `OWNER_APPROVED_CONTINUOUS_ROADMAP_20261008`: Draft PR в integration, exact CI, ordinary-user proof, независимый review, затем технический merge без повторного разрешения. Integration → main, production, final visual parity и изменение продуктовой цели требуют отдельного решения владельца.
