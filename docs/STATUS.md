# ASA-CAD — актуальное состояние

Снимок: 2026-11-27, Москва. Live GitHub и `spec/process/active-work.v1.json` имеют приоритет.

## Действующая точка

**U2 IN_PROGRESS.** Full Repository Health Audit #236 принят как **YELLOW_ACCEPTED**, merge `4729222d055b70a43ef0a2a3eaa59c6a83365999`; применимые CI, independent review и post-merge gates PASS. Результаты измерений и ограничения сравнения: [отчёт аудита](FULL_REPOSITORY_HEALTH_AUDIT.md).

Canonical `integration/ui-core-unification`: **`dc8c344b8f958a7a505399bce15ee79670a67135`**, reference R01/R02 приняты в #301. Cadence после #236: **0/3** до фактической приёмки нового permanent slice. Reference, helpers, число задач и commits cadence не увеличивают.

Текущий срез — **U2-FUSION-CIRCLE-NUMERIC**: T01 #241 → P01 #242 → P02 #243 → P03 #244, один общий PR. На candidate **`772eed0f573f444fc3095dc931523281044d9bd3`** Fusion Circle подключён к общему `circleInput`: обычный P01 подтвердил выбранный центр (20,10), Ø12, preview R6 и отсутствие лишнего driving dimension; T01 smoke 3/3 PASS. Исходный RED сохранён в P01.

**P03 browser proof 5/5 PASS:** numeric/comma/first-key, pointer/repeat, invalid, cancel/Esc, Undo/Redo и Save/Open; существующий KOMPAS Circle numeric regression PASS. Финальные CI, независимая приёмка всего среза, merge и публикация preview — **PENDING**; новый срез пока не ACCEPTED. Owner visual acceptance — **PENDING** отдельно. Это узкий пилот окружности, не завершение Sketch или U2.

Очередь: [#237](https://github.com/spikeal8-maker/ASA-CAD/issues/237), [ТЗ](FUSION_BROWSER_SPEC.md), [протокол](FUSION_AGENT_WORKFLOW.md), [реестр](../spec/process/fusion-tasks.v1.json). После Circle — камера/точный ввод, затем ViewCube/меню по зависимостям. Исполнение только по актуальному контракту контролёра, без отдельного merge каждого helper.

## Выпущено

Launcher #228/#233 и top bar #234/#235 — **RELEASED_TO_MAIN**, main **`9ea217f253b3348d34638841936fa79b75f95fa2`**. Главная: KOMPAS/Fusion/Vassalite; Vassalite недоступен без исходников. Смена оболочки через лаунчер; выход по ASA CAD с dirty guard. Релиз владельца не означает full visual parity.

Arc #226, Circle #231 и Rectangle #224 технически доказаны отдельно. Numeric Line/Arc/Circle visual acceptance PENDING. Полный Sketch, ViewCube/marking-menu parity и U2 целиком не приняты.

## Канон и ограничения

KOMPAS `src/web/kompas`, Fusion `src/web/fusion`; один CadApplication/CadDocument/history/persistence. Typed actions → ASA adapters → PlaneGCS/OpenCascade B-Rep; Three.js — отображение. U1A/U1B/U1C приняты #195/#196; legacy cleanup #208; frozen reference #170: `ui-reference-20261004`.

**FUSION_OWNER_PRESSURE_20261125:** owner /root; 41 source owner ≥85% target, 20 выше target по аудиту. До новой ответственности — focused extraction/review; frozen owners не растут, бюджеты не повышаются. Применимый долг закрыть до следующей milestone boundary. Каждый permanent slice проходит quality gate; после трёх accepted slices и на обязательных границах — Full Audit.

WEB-TYPES/VENDOR-LIFETIME/DEPENDENCIES закрыты #218–#220. NODE_SECURITY_RELEASE_20261111_PENDING закрыт #230 для CI/build Node22.23.5; остальные runtime отдельно. LICENSE/THIRD_PARTY_NOTICE — pre-beta. DETECT_ONLY / ADMIN_BRANCH_PROTECTION_NOT_ENFORCED — KNOWN_RISK.

OWNER_APPROVED_CONTINUOUS_ROADMAP_20261008: PR → exact CI/ordinary proof/independent review → technical integration merge. Main/production/final visual parity требуют решения владельца. Сохранять совместимость пользовательских документов и protected Part regression; U3–U5 только после своих prerequisite gates. Проверенный merge SHA записывается в #184; machine pointer/STATUS согласуются на границе среза.
