# ASA-CAD — актуальное состояние

Снимок: 2026-11-27, Москва. Live GitHub и `spec/process/active-work.v1.json` имеют приоритет.

## Действующая точка

**U2 IN_PROGRESS.** Full Repository Health Audit #236 принят как **YELLOW_ACCEPTED**, merge `4729222d055b70a43ef0a2a3eaa59c6a83365999`; применимые CI, independent review и post-merge gates PASS. Результаты измерений и ограничения сравнения: [отчёт аудита](FULL_REPOSITORY_HEALTH_AUDIT.md).

Canonical `integration/ui-core-unification`: **`2fedba7b41e31c7dcf5808649e78a7e74026b52f`**. R01/R02 приняты в #301; Circle T01/P01/P02/P03 — в #303. Cadence после #236: **1/3**. Считать только фактически принятые permanent slices, не helpers/commits.

**Circle #303 ACCEPTED:** выбранный центр (20,10), Ø12, preview R6, без лишнего driving dimension; numeric/comma/first-key, pointer/repeat, invalid, cancel/Esc, Undo/Redo и Save/Open PASS. Exact PR CI9/9, post-merge6/6; Docker8090 опубликован. Owner visual acceptance — **PENDING**.

**Текущий repair #304 — Fusion «Показать всё».** Реальный browser RED: после wheel zoom ортографический масштаб не сбрасывается и тело обрезано. Общий typed view.fit получает сброс через существующую camera.fitScale; frozen CadViewport уменьшается. Приёмка требует exact CI, независимого review, обычного 3D/browser proof и verified merge; только затем cadence1→2. A01/A02 work_verified, A03 WIP сохранён на отдельной ветке; вращение внутри Sketch ещё не реализовано и этим repair не принимается.

Очередь: [#237](https://github.com/spikeal8-maker/ASA-CAD/issues/237), [ТЗ](FUSION_BROWSER_SPEC.md), [протокол](FUSION_AGENT_WORKFLOW.md), [реестр](../spec/process/fusion-tasks.v1.json). Камера/проекция/ввод и ViewCube — по актуальным READY-контрактам. Полный Sketch/U2 и visual parity не приняты.

## Выпущено

Launcher #228/#233 и top bar #234/#235 — **RELEASED_TO_MAIN**, main **`9ea217f253b3348d34638841936fa79b75f95fa2`**. Главная: KOMPAS/Fusion/Vassalite; Vassalite недоступен без исходников. Смена оболочки через лаунчер; выход по ASA CAD с dirty guard. Релиз владельца не означает full visual parity.

Arc #226, Circle #231 и Rectangle #224 технически доказаны отдельно. Numeric Line/Arc/Circle visual acceptance PENDING. Полный Sketch, ViewCube/marking-menu parity и U2 целиком не приняты.

## Канон и ограничения

KOMPAS `src/web/kompas`, Fusion `src/web/fusion`; **один владелец состояния**, CadApplication/CadDocument/history/persistence; typed actions → ASA adapters → PlaneGCS/OpenCascade B-Rep; Three.js — отображение. Six document kinds: Part, Assembly, Drawing, Fragment, Specification, Text; готовность различается. U1A/U1B/U1C приняты #195/#196; legacy cleanup #208. Frozen #170: `ui-reference-20261004`.

**FUSION_OWNER_PRESSURE_20261125:** owner /root; 41 source owner ≥85% target, 20 выше target по аудиту. До новой ответственности — focused extraction/review; frozen owners не растут, бюджеты не повышаются. Применимый долг закрыть до следующей milestone boundary. Каждый permanent slice проходит quality gate; после трёх accepted slices и на обязательных границах — Full Audit.

WEB-TYPES/VENDOR-LIFETIME/DEPENDENCIES закрыты #218–#220. NODE_SECURITY_RELEASE_20261111_PENDING закрыт #230 для CI/build Node22.23.5; остальные runtime отдельно. LICENSE/THIRD_PARTY_NOTICE — pre-beta. DETECT_ONLY / ADMIN_BRANCH_PROTECTION_NOT_ENFORCED — KNOWN_RISK.

OWNER_APPROVED_CONTINUOUS_ROADMAP_20261008: PR → exact CI/ordinary proof/independent review → technical integration merge. Main/production/final visual parity требуют решения владельца. Сохранять совместимость пользовательских документов и protected Part regression; U3–U5 только после своих prerequisite gates. Проверенный merge SHA записывается в #184; machine pointer/STATUS согласуются на границе среза.
