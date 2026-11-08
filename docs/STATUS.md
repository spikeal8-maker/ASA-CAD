# ASA-CAD — актуальное состояние

Снимок: 2026-11-08 UTC. Live GitHub и machine pointer имеют приоритет.

## Действующая точка

**Checkpoint = U2, IN_PROGRESS** после exact CI, независимого review и merge этого audit PR. Повторный **Full Repository Health Audit = YELLOW_ACCEPTED** контролёром ChatGPT `/root`; до его приёмки feature gate остаётся закрыт. [Единый отчёт](FULL_REPOSITORY_HEALTH_AUDIT.md) фиксирует условия и OPEN Node debt.

Audited product `7bf71e2ee8ece045fb69620c657570ce7be9294f` (#220), tree `899f3a888a0c14173b6117cf8ea52ab4d6f4b40c`. #218–#220 дали cadence 3/3; принятие повторного аудита начинает новый отсчёт. Исторический #217 (audited `128480e`, merge `20603c3`) и его raw evidence сохранены.

U2: настоящий Sketch-in-Viewport, Line/Rectangle/Circle/Arc, числовой ввод через product commands. Acceptance: Part → XY → Sketch → Rectangle 60×40 → Undo/Redo → Save/Open → те же intent/IDs. Затем U3 → U4 → U5.

## Канон и проверенная база

- Integration: одна продуктовая оболочка `src/web/kompas` для desktop/tablet/phone, общий document/history/action path.
- Main `1f8d2627da7ddfa63b31876d46347d0b8080c154`; main/production отдельно.
- Frozen #170: `ui-reference-20261004`, `88c535c652dac8b04f0d68fa144cf8486afdc926`; UI/UX reference.
- CadDocument/CadApplication → ASA adapters → PlaneGCS/OpenCascade B-Rep; Three.js отображает результат.
- Six kinds: Part, Assembly, Drawing, Fragment, Specification, Text; готовность редакторов различается.

U1A/U1B/U1C приняты #195/#196, responsive KOMPAS #202, LEGACY-CLEANUP-202 #208. Repairs #210–#216 сохранены в историческом audit report. Работающие K1/U1 не реализуются повторно.

## Результаты и долги

- WEB-TYPES закрыт #218: 8 → 0 diagnostics; свежий full-web check также 0, 183 physical roots.
- VENDOR-LIFETIME закрыт #219: actual OCC corpus14, 451 live owning wrappers → 0. Свежий запуск: 699 created / 0 live до cleanup; bounded native heap не заявляется.
- DEPENDENCIES закрыт #220: 16 affected entries / 21 GHSA → свежий npm audit 0, включая dev. Lint: 154 unique files, 0 errors, 43 warnings; CI guard проверяет полный inventory.
- #220 product CI 9/9, post-merge 8/8. Повторный audit wrapper 9/9; STANDARD 10 phases / 16 cases / 106 samples / 20 warmups, failures 0. Новые raw/derived данные независимо сверены.
- Архив: 73 originals, lossless roundtrip; старые 76 measurement и 119 repair originals сохранены. Actual visual before/after четыре пары идентичны; owner parity отдельно.

`NODE_TOOLCHAIN_EOL_AND_SECURITY_PATCH_GAP` — OPEN/YELLOW: CI/Docker build Node 20.19.0 после EOL, D2 22.23.3 раньше security patch 22.23.4. Owner `/root`; reviewed repair обязателен **до технической приёмки U2 / следующей milestone boundary / beta**, exposure не увеличивать. ASA exploit reachability не доказана; npm audit=0 не закрывает Node. Установка нового runtime на D2 — отдельное разрешение по quality gates §5.

Frozen owners не растут. LICENSE/THIRD_PARTY_NOTICE — pre-beta gate. `DETECT_ONLY` / `ADMIN_BRANCH_PROTECTION_NOT_ENFORCED` остаётся KNOWN_RISK.

## Очередь и полномочия

Numeric Line candidate с ordinary-user/actual before-after evidence ожидает отдельный feature PR после аудита. #177 — reuse после review; #179 — Drawing candidate; #204–#207 — отдельная Fusion Draft очередь. Installer, пользовательские документы и порты 8094/8098/8099 не изменены.

`OWNER_APPROVED_CONTINUOUS_ROADMAP_20261008`: Draft PR в integration → exact CI/ordinary-user proof/независимый review → технический merge. Integration → main, production, final visual parity и смена продуктовой цели требуют решения владельца; owner acceptance PENDING.
