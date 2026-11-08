# ASA-CAD — актуальное состояние

Снимок: 2026-11-08 UTC. Live GitHub и machine pointer имеют приоритет.

## Действующая точка

**U2 IN_PROGRESS после технической приёмки этого Full Repository Health Audit.** Решение **YELLOW_ACCEPTED** на audited `b8f700bb6e455582db18df8d0ba43a2bfbdcc68b` вступает в силу после exact CI, независимого review и merge audit PR. [Отчёт](FULL_REPOSITORY_HEALTH_AUDIT.md) и immutable evidence сохраняют raw false/PENDING. U2 целиком не принят.

#222 Numeric Line, #223 CI/build Node и #224 Rectangle приняты; cadence после #221 достиг 3/3. Этот audit закрывает gate при своей приёмке; затем счёт новых accepted slices начинается заново. Milestone boundary также требует Full Repository Health Audit.

Свежий run на b8: 9/9 PASS; full web 190 raw roots / 188 physical, 0 diagnostics; native lifetime 14 PASS, 699 created / 0 live; npm audit total 0; import graph 223 / unresolved 0. STANDARD 106 measured + 20 warmups, без failed/unattempted. Node22.23.3→22.23.4 и отдельные cohorts не дают причинного performance verdict; часть медиан выросла, числа сохранены в отчёте.

## Продуктовый proof

Numeric Line использует прежний `sketch.line`, один CadDocument/history. X/Y, длина и абсолютный угол от +X работают до/после anchor; locks временные, persistent constraints — U3. Commit оставляет инструмент для новой первой точки. Keyboard/caret/Tab, invalid input, decimal comma, Undo/Redo, Save/Open и IDs проверены. Composing Enter покрыт synthetic DOM flag, OS IME не заявлен.

Rectangle ordinary Part → XY → Sketch → 60×40 → Undo/Redo → Save/Open: одна проекция из десяти intent-полей, live Sketch/support/entity IDs и solved bounds совпадают; DOM counts 0/4/4. Это не сравнение всего CadPartDocument. Latest #224 CI 3 workflows/5 jobs и post-merge 4 workflows/6 jobs SUCCESS на exact checkout; исходный docs-marker failure сохранён.

Matched numeric before/after и Node20→Node22 comparison переиспользованы по точным hashes; этот audit UI не меняет. **Owner visual verdict PENDING**; ожидающая Numeric область без него не меняется.

## Канон и границы

- одна продуктовая оболочка `src/web/kompas`; typed actions → CadApplication/CadDocument → ASA adapters → PlaneGCS/OpenCascade B-Rep; Three.js — отображение.
- Six document kinds: Part, Assembly, Drawing, Fragment, Specification, Text: готовность различается.
- Main `1f8d2627da7ddfa63b31876d46347d0b8080c154`; main/production отдельно.
- Frozen #170: `ui-reference-20261004`, `88c535c652dac8b04f0d68fa144cf8486afdc926`.

U1A/U1B/U1C приняты #195/#196, responsive KOMPAS #202, LEGACY-CLEANUP-202 #208. K1/U1 повторно не реализуются. #177 — reuse после exact review; #179/Fusion #204–#207 отдельно.

## Долги

WEB-TYPES, VENDOR-LIFETIME, DEPENDENCIES закрыты #218–#220. Старый `NODE_TOOLCHAIN_EOL_AND_SECURITY_PATCH_GAP` закрыт только для CI/build #223 и выбранного D2 ASA runtime **Node22.23.4/npm10.9.9** с Windows proof. Global/default Node и прежние процессы не объявляются обновлёнными.

Новый **NODE_SECURITY_RELEASE_20261111_PENDING — OPEN**: официальный анонс Node от 03.11 планирует security release 22.x с highest HIGH на/после 11.11; target patch/CVE ещё не названы, ASA exploit не доказан. Owner — technical controller /root. Published fix/reachability и reviewed applicable update обязательны до U2 technical acceptance / следующей milestone boundary, если раньше, и до beta. Exposure не растёт; задержка release не даёт auto-PASS, новая D2 установка отдельно. Npm audit=0 этот follow-up не закрывает.

14 frozen и 6 grandfathered ceilings сохранены; 8 source owners выше soft target. LICENSE/THIRD_PARTY_NOTICE — pre-beta. `DETECT_ONLY` / `ADMIN_BRANCH_PROTECTION_NOT_ENFORCED` — KNOWN_RISK.

`OWNER_APPROVED_CONTINUOUS_ROADMAP_20261008`: Draft PR → exact CI/ordinary proof/independent review → technical integration merge. Main, production и final visual parity — решение владельца. Исторические #217/#221 evidence, пользовательские документы и порты 8094/8098/8099 сохранены.
