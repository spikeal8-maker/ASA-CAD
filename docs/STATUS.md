# ASA-CAD — актуальное состояние

Снимок: 2026-11-08 UTC. Live GitHub и machine pointer имеют приоритет.

## Действующая точка

**U2 IN_PROGRESS.** Full Repository Health Audit #225 технически принят как **YELLOW_ACCEPTED**: audited b8f700b, merge `ae3f713f81d405733b887deaad0050f28f33af0b`. Exact PR CI — 2 workflows/4 jobs, post-merge — 3 workflows/5 jobs SUCCESS; независимый review APPROVE. [Отчёт](FULL_REPOSITORY_HEALTH_AUDIT.md), raw false/PENDING и история #217/#221 сохранены. U2 целиком не принят.

#222 Numeric Line, #223 CI/build Node и #224 Rectangle завершили cadence 3/3 после #221; #225 закрыл обязательный аудит. До текущего Arc slice счёт после #225 — 0/3, после его CI/review/merge — 1/3. Milestone boundary также требует Full Repository Health Audit.

## Текущий срез и продуктовый proof

**THREE-MODE-LAUNCHER-001 — IN_PROGRESS**, по отдельному заданию владельца 08.11.2026. Главная `/`, локальные проекты `/cad/{kompas|fusion}/{id}`, общий App/document/history, внешняя сессия ASA Lab `three-d`. Selective reuse UI #207; его неподтверждённые angle-driving/atomic-line/native-parity возможности не заявлены. Исходный integration `6a2159f25efd5203f83a385461c4aaae92f2fabd`, installed D2 8099 `c1959b1e84a7c38288022622a9585a38c07d3f7e`. Установка только после реального browser backup, проверки прежних проектов и rollback. Draft/CI не означают готовность; release в main требует отдельного полного dependency/security audit.

Третий редактор проверен через штатную сессию: новый проект `three-d`, параллелепипед 40×20×12, autosave, список → reopen → F5. Launcher-to-Lab переход и CAD-сценарии в этой сборке ещё требуют browser proof. Локальная сборка, typecheck, storage/route и M1B/M2O checks пройдены; independent review нашёл startup/keyboard/history риски, исправления должны пройти повторную проверку.

**U2-ARC-NUMERIC-20261108:** левая Parameters связывает X/Y и временный радиус с одним Arc draft. Радиус доступен между центром и началом; Enter в нём не выбирает точку, Enter в X/Y продвигает построение. Readonly sweep, CW/CCW, большие дуги и wrap используют одну canonical pair для ghost и прежней команды sketch.arc. UI отвергает abs(sweep)<0.001 rad и ограничивает накопление ±(2π−0.01); core/сохранённые дуги неизменны. Commit — одна команда/history frame, затем новый центр; persistent constraints не добавлены. Exact CI, ordinary proof и matched before/after — в PR/#184; technical merge не равен visual approval.

Numeric Line #222: прежний sketch.line, один CadDocument/history, X/Y и временные length/absolute-angle locks, repeat с новой первой точкой. Keyboard/invalid/comma/Undo/Redo/Save/Open/IDs проверены; IME proof — synthetic DOM flag, не OS IME. **Owner visual verdict Numeric области PENDING; Line/общие Frame/CSS в Arc slice не меняются.**

Rectangle #224: обычный Part → XY → Sketch → 60×40 → Undo/Redo → Save/Open сохраняет выбранную проекцию из десяти intent-полей, live Sketch/support/entity IDs и solved bounds; DOM counts 0/4/4. Это не сравнение всего CadPartDocument. Arc и весь U2 требуют отдельной приёмки; полная parity не заявлена.

## Канон и границы

- Компас: каноническая оболочка src/web/kompas; Fusion: выборочно адаптированная src/web/fusion. В активном редакторе один владелец состояния; typed actions → CadApplication/CadDocument → ASA adapters → PlaneGCS/OpenCascade B-Rep; Three.js — отображение.
- Six document kinds: Part, Assembly, Drawing, Fragment, Specification, Text: готовность различается.
- Main `1f8d2627da7ddfa63b31876d46347d0b8080c154`; main/production отдельно.
- Frozen #170: ui-reference-20261004, `88c535c652dac8b04f0d68fa144cf8486afdc926`.

U1A/U1B/U1C приняты #195/#196, responsive KOMPAS #202, LEGACY-CLEANUP-202 #208. K1/U1 повторно не реализуются. #177 — reuse после exact review; #179/Fusion #204–#207 отдельно.

## Долги

WEB-TYPES, VENDOR-LIFETIME, DEPENDENCIES закрыты #218–#220. NODE_TOOLCHAIN_EOL_AND_SECURITY_PATCH_GAP закрыт только для CI/build #223 и выбранного D2 ASA runtime Node22.23.4/npm10.9.9 с Windows proof. Global/default Node и прежние процессы не объявляются обновлёнными.

**NODE_SECURITY_RELEASE_20261111_PENDING — OPEN:** официальный анонс Node от 03.11 планирует security release 22.x с highest HIGH на/после 11.11; target patch/CVE не названы, ASA exploit не доказан. Owner — technical controller /root. Published fix/reachability и reviewed applicable update обязательны до U2 technical acceptance / следующей milestone boundary, если раньше, и до beta. Exposure не растёт; задержка release не даёт auto-PASS, новая D2 установка отдельно. Npm audit=0 этот follow-up не закрывает.

Frozen ceilings не растут; App/editing ratchets снижены до actual bytes. LICENSE/THIRD_PARTY_NOTICE — pre-beta. DETECT_ONLY / ADMIN_BRANCH_PROTECTION_NOT_ENFORCED — KNOWN_RISK.

OWNER_APPROVED_CONTINUOUS_ROADMAP_20261008: Draft PR → exact CI/ordinary proof/independent review → technical integration merge. THREE-MODE-LAUNCHER-001 разрешает отдельный проверенный release в main и D2 8099 после обязательных gates; final visual parity остаётся решением владельца. Пользовательские документы и порты 8094/8098/8099 сохранены.
