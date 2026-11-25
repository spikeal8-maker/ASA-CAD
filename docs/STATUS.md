# ASA-CAD — актуальное состояние

Снимок: 2026-11-25 UTC. Live GitHub и machine pointer имеют приоритет.

## Действующая точка

**U2 IN_PROGRESS.** Full Repository Health Audit #225 технически принят как **YELLOW_ACCEPTED**: audited b8f700b, merge `ae3f713f81d405733b887deaad0050f28f33af0b`. Exact PR CI — 2 workflows/4 jobs, post-merge — 3 workflows/5 jobs SUCCESS; независимый review APPROVE. [Отчёт](FULL_REPOSITORY_HEALTH_AUDIT.md), raw false/PENDING и история #217/#221 сохранены. U2 целиком не принят.

#222 Numeric Line, #223 CI/build Node и #224 Rectangle завершили cadence 3/3 после #221; #225 закрыл обязательный аудит. После #225: #226 Arc numeric = 1/3, #230 Node 22.23.5 security pin — operational maintenance, текущий Circle slice = 2/3 permanent slices. Третий permanent slice или milestone boundary требуют Full Repository Health Audit.

## Текущий срез и продуктовый proof

**THREE-MODE-LAUNCHER-001 — RELEASED в main** (integration #228 `db1256c`, main #233 `38b2d1a`, Docker 8088), по заданию владельца 08.11.2026. Главная `/` — карточки Kompas/Fusion/Vassalite (disabled-заглушка, без исходников); локальные проекты `/cad/{kompas|fusion}/{id}`; общий App/document/history/persistence. Решение владельца 2026-11-25 (после visual-проверки): в редакторе нет nav-полосы и селектора «Редактор»; выход на главную — по метке ASA CAD в топ-баре обоих шеллов (PR #234); смена оболочки — только через лаунчер (открытие того же проекта в другом редакторе). Draft/CI не означают готовность.

Launcher-проверка: 5 browser-сценариев (создание/открытие, dirty-guard через метку ASA CAD, save-and-leave, общий проект между шеллами, Back/Forward) — PASS; KOMPAS/Fusion shell, Protected Part regression — PASS.

**U2-CIRCLE-NUMERIC-20261125** (#231 merged, `6d11158`): X/Y + Диаметр одним Circle draft, диаметр до/после центра, fallback [0,0]+`dimension.diameter` (только контроллер), commit = одна `sketch.circle`; exact CI 9/9, review APPROVE. Детали — PR/#184.

**U2-ARC-NUMERIC-20261108:** левая Parameters связывает X/Y и временный радиус с одним Arc draft. Радиус доступен между центром и началом; Enter в нём не выбирает точку, Enter в X/Y продвигает построение. Readonly sweep, CW/CCW, большие дуги и wrap используют одну canonical pair для ghost и прежней команды sketch.arc. UI отвергает abs(sweep)<0.001 rad и ограничивает накопление ±(2π−0.01); core/сохранённые дуги неизменны. Commit — одна команда/history frame, затем новый центр; persistent constraints не добавлены. Exact CI, ordinary proof и matched before/after — в PR/#184; technical merge не равен visual approval.

Numeric Line #222: прежний sketch.line, один CadDocument/history, X/Y и временные length/absolute-angle locks, repeat с новой первой точкой. Keyboard/invalid/comma/Undo/Redo/Save/Open/IDs проверены; IME proof — synthetic DOM flag, не OS IME. **Owner visual verdict Numeric области PENDING; Line/общие Frame/CSS в Arc slice не меняются.**

Rectangle #224: обычный Part → XY → Sketch → 60×40 → Undo/Redo → Save/Open сохраняет выбранную проекцию из десяти intent-полей, live Sketch/support/entity IDs и solved bounds; DOM counts 0/4/4. Это не сравнение всего CadPartDocument. Arc и весь U2 требуют отдельной приёмки; полная parity не заявлена.

## Канон и границы

- Компас: каноническая оболочка src/web/kompas; Fusion: выборочно адаптированная src/web/fusion. В активном редакторе один владелец состояния; typed actions → CadApplication/CadDocument → ASA adapters → PlaneGCS/OpenCascade B-Rep; Three.js — отображение.
- Six document kinds: Part, Assembly, Drawing, Fragment, Specification, Text: готовность различается.
- Main `38b2d1a` (launcher #233); main/production отдельно.
- Frozen #170: ui-reference-20261004, `88c535c652dac8b04f0d68fa144cf8486afdc926`.

U1A/U1B/U1C приняты #195/#196, responsive KOMPAS #202, LEGACY-CLEANUP-202 #208. K1/U1 повторно не реализуются. #177 — reuse после exact review; #179/Fusion #204–#207 отдельно.

## Долги

WEB-TYPES, VENDOR-LIFETIME, DEPENDENCIES закрыты #218–#220. NODE_TOOLCHAIN_EOL_AND_SECURITY_PATCH_GAP закрыт только для CI/build #223 и выбранного D2 ASA runtime Node22.23.4/npm10.9.9 с Windows proof. Global/default Node и прежние процессы не объявляются обновлёнными.

**NODE_SECURITY_RELEASE_20261111_PENDING — CLOSED (repair PR):** security release **v22.23.5** опубликован 2026-11-11 (22.x highest HIGH: CVE-2026-123864/-123865/-123866/-123872 и др.). Operational pins 22.23.4 → **22.23.5**: CI setup-node, Dockerfile и NODE_IMAGE visual builds (index digest `be979e55…`), own engines. Win-x64 zip SHA256 `4a191082…` сверен с SHASUMS256.txt. Reachability: локальные серверы — HTTP/1.1 loopback, затронутые HTTP/2/TLS-поверхности не используются; браузерный WASM-рантайм независим от Node; exploit path NOT_ESTABLISHED, exposure не растёт. Portable D2 установка 22.23.5 — по отдельному разрешению §5, не выполнена этим срезом. Npm audit=0 этот follow-up не закрывает; evidence — `spec/process/evidence/node-security-release-20261125/upstream-release.json`.

Frozen ceilings не растут; App/editing ratchets снижены до actual bytes. LICENSE/THIRD_PARTY_NOTICE — pre-beta. DETECT_ONLY / ADMIN_BRANCH_PROTECTION_NOT_ENFORCED — KNOWN_RISK.

OWNER_APPROVED_CONTINUOUS_ROADMAP_20261008: Draft PR → exact CI/ordinary proof/independent review → technical integration merge. THREE-MODE-LAUNCHER-001 выпущен в main (Docker 8088) после обязательных gates; топ-бар редактора приведён по решению владельца 2026-11-25 (PR #234); final visual parity остаётся решением владельца. Пользовательские документы и порты 8094/8098/8099 сохранены.
