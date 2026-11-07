# ASA-CAD — актуальное состояние

Снимок: 2026-11-07 UTC. Live GitHub и machine pointer имеют приоритет.

## Действующая точка

**Следующий checkpoint = Full Repository Health Audit, IN_PROGRESS.** Переключение в этом dependency PR вступает в силу после технической приёмки и merge: #218, #219 и этот repair дают 3/3 accepted slices после #217. До merge приняты 2/3. Новая U2 feature work ждёт повторного GREEN / явно принятого YELLOW.

#217 остаётся историческим YELLOW_ACCEPTED: audited product `128480e1a150253359ce44158d5588f6b08f27b8`, merge `20603c34f277dc9f0cf2696f5bd3971dd7645678`. [Единый отчёт](FULL_REPOSITORY_HEALTH_AUDIT.md) и raw evidence сохранены; текущий повторный аудит PENDING, старое принятие его не заменяет.

После аудита продолжается U2: настоящий Sketch-in-Viewport, Line/Rectangle/Circle/Arc и числовой ввод через product commands. Acceptance: Part → XY → Sketch → Rectangle 60×40 → Undo/Redo → Save/Open → те же intent/IDs. Затем U3 → U4 → U5.

## Канон и принятая база

- Integration: `8684b56aff2a24d46458741249d27dd08f59b292` (#219), одна оболочка `src/web/kompas` для desktop/tablet/phone.
- Main: `1f8d2627da7ddfa63b31876d46347d0b8080c154`; main/production отдельно.
- Frozen #170: `ui-reference-20261004`, `88c535c652dac8b04f0d68fa144cf8486afdc926`; UI/UX reference.
- CadDocument/CadApplication/history → typed actions/ASA adapters → PlaneGCS/OpenCascade B-Rep; Three.js отображает результат.
- Six kinds: Part, Assembly, Drawing, Fragment, Specification, Text; готовность редакторов различается.

U1A/U1B/U1C приняты #195/#196, responsive KOMPAS #202, LEGACY-CLEANUP-202 #208. Repairs #210–#216 и исходные findings сохранены в canonical audit report. Работающие K1/U1 не реализуются повторно.

## Maintenance и долги

- WEB-TYPES закрыт #218: 8 → 0 diagnostics, 183 physical roots/fixtures в постоянном `typecheck:web`; CI 9/9, post-merge 8/8.
- VENDOR-LIFETIME закрыт #219: один corpus14 на реальном OCC, 451 live owning wrappers → 0; mandatory M1 Protected Part, CI 5/5, post-merge 6/6. Это scoped proof; bounded native heap не заявляется.
- Этот npm repair закрывает HA-20261107-DEPENDENCIES после CI/review/merge: 16 affected entries / 21 GHSA → audit total 0. Чистая установка и сборки PASS; lint до/после побайтово одинаков: 154 файла, 0 ошибок, 43 предупреждения. Новый CI guard проверяет полный набор файлов; browser/visual jobs запускаются при package/lock delta.

Повторный аудит заново привяжет correctness, types, dependencies, native lifetime и STANDARD performance к принятому HEAD. Исторические 10 phases / 106 samples / 20 warmups не объявляются новым измерением. Browser cold-start и SLO не заявляются.

Отдельный OPEN finding: `NODE_TOOLCHAIN_EOL_AND_SECURITY_PATCH_GAP`. CI/Docker build используют Node 20.19.0 ([ветка EOL 30.04.2026](https://raw.githubusercontent.com/nodejs/Release/main/schedule.json)); D2 22.23.3 отстаёт от [security patch 22.23.4](https://nodejs.org/en/blog/release/v22.23.4). Ответственный ChatGPT `/root`; классификация и repair gate — в повторном аудите до возобновления U2. ASA-specific exploit reachability не доказана.

Frozen owners не растут. LICENSE/THIRD_PARTY_NOTICE — pre-beta gate. `DETECT_ONLY` / `ADMIN_BRANCH_PROTECTION_NOT_ENFORCED` остаётся KNOWN_RISK.

## Очередь и полномочия

Numeric Line draft с ordinary-user и actual before/after evidence сохранён; его feature PR ждёт аудита. #177 — reuse после review; #179 — отдельный Drawing candidate; #204–#207 — отдельная Fusion Draft очередь. Installer не запускался, пользовательские документы и порты 8094/8098/8099 не изменены.

`OWNER_APPROVED_CONTINUOUS_ROADMAP_20261008`: Draft PR в integration → exact CI/ordinary-user proof/независимый review → технический merge. Во время Full Audit разрешены только подтверждённые P0/RED fixes и essential regression repairs. Integration → main, production, final visual parity и смена продуктовой цели требуют решения владельца; owner acceptance PENDING.
