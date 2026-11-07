# ASA-CAD — актуальное состояние

Снимок: 2026-11-07 UTC. Live GitHub и machine pointer имеют приоритет.

## Действующая точка

**Checkpoint = U2, IN_PROGRESS. Full Repository Health Audit = YELLOW_ACCEPTED** после #217, merge `20603c34f277dc9f0cf2696f5bd3971dd7645678`: 4/4 PR и 5/5 post-merge jobs SUCCESS. [Единый отчёт](FULL_REPOSITORY_HEALTH_AUDIT.md) фиксирует audited product `128480e`. Контролёр — ChatGPT `/root`; owner product acceptance PENDING.

U2: настоящий Sketch-in-Viewport, Line/Rectangle/Circle/Arc и числовой ввод через существующие product commands. Acceptance: Part → XY → Sketch → Rectangle 60×40 → Undo/Redo → Save/Open → те же intent/IDs. Затем U3 → U4 → U5. Работающие К1/U1 заново не реализуются.

## Канон и принятая база

- Принятая integration-база: `20603c34f277dc9f0cf2696f5bd3971dd7645678` — одна продуктовая оболочка `src/web/kompas` для desktop/tablet/phone, без legacy fallback.
- Main: `1f8d2627da7ddfa63b31876d46347d0b8080c154`, прежняя версия без текущих repairs. Main/production не обновлены.
- Frozen reference #170: tag `ui-reference-20261004`, SHA `88c535c652dac8b04f0d68fa144cf8486afdc926`; UI/UX reference, не второе CAD-ядро.
- CadDocument/CadApplication/history → typed actions/ASA adapters → PlaneGCS/solved profile/OpenCascade B-Rep; Three.js отображает результат.
- six document kinds: Part, Assembly, Drawing, Fragment, Specification, Text. Реальная готовность редакторов различается.

U1A/U1B/U1C объединены в #195/#196; #202 закрепил responsive KOMPAS. Приняты #209 (CI runner), #208 (LEGACY-CLEANUP-202), #210–#216 (refs, async/recovery, topology, solved profiles и Fixed). Подробные результаты и hashes сохранены в canonical audit report.

Repairs приняты после exact CI и независимого review. #216: 9/9 PR и 8/8 post-merge jobs SUCCESS; ordinary Fixed и Protected Part/Docker PASS, четыре пары PNG одинаковы. Final visual/theme parity PENDING. #213 — закрытый предшественник #215.

## Аудит и обязательный долг

STANDARD measurement на общей базе: 10 phases, 106 samples, 20 warmups, correctness PASS. Raw evidence и воспроизводимый harness сохранены в отчёте. Browser cold-start, SLO и native-heap cleanliness не заявляются.

Full-web debt закрывается этим пакетом после exact CI, независимого review и merge: прежние 8 ошибок устранены, постоянный `typecheck:web` проверяет все 183 roots (182 исходных + typed workspace owner), включая fixtures. M2 CI запускает gate также при изменении импортируемого vendor source/типов. Frozen budgets понижены без роста owners.

Остаются два OPEN долга, ответственный ChatGPT `/root`; устранить до приёмки U2 / следующей milestone boundary:

- Toolchain: 16 affected package entries / 21 GHSA. Static runtime intersection 0 не закрывает High findings.
- Vendor StableRef lifetime P2: owning Current/FindKey wrappers. Дополнительный gate — до расширения соответствующих paths. ASA cleanup не закрывает vendor leak.

Frozen owners не растут; новый долг/ответственность сверх pressure policy запрещены. LICENSE/THIRD_PARTY_NOTICE остаётся pre-beta gate. `DETECT_ONLY` / `ADMIN_BRANCH_PROTECTION_NOT_ENFORCED` — `KNOWN_RISK`, не ENFORCED и по действующему разрешению не запрет U2.

## Очередь и полномочия

#177 — reuse после exact review; #179 — отдельный Drawing/schema candidate; #204–#207 — отдельная Fusion Draft очередь. Installer не запускался, пользовательские документы/8099 не изменены.

Действует `OWNER_APPROVED_CONTINUOUS_ROADMAP_20261008`: Draft PR в integration, exact CI, ordinary-user proof, независимый review, затем технический merge без повторного разрешения. Integration → main, production, final visual parity и изменение продуктовой цели требуют отдельного решения владельца.