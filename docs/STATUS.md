# ASA-CAD — актуальное состояние

Снимок: 2026-11-25 UTC. Live GitHub и machine pointer имеют приоритет.

## Действующая точка

**U2 IN_PROGRESS.** Full Repository Health Audit #236 технически принят как **YELLOW_ACCEPTED**, verified merge `4729222d055b70a43ef0a2a3eaa59c6a83365999`; 4/4 применимых PR checks и независимое review APPROVE. После merge все три push workflows PASS, включая integration guard. Измеренная продуктовая база остаётся a08b17c. [Отчёт](FULL_REPOSITORY_HEALTH_AUDIT.md).

Cadence после аудита #236: **0/3**. Он закрыл четыре permanent slices после #225 (#226/#231/#228/#234); #230 — operational maintenance. NEXT: [Fusion ТЗ/очередь #237](https://github.com/spikeal8-maker/ASA-CAD/issues/237), R01 → пилот Circle → камера/точный ввод → ViewCube/меню. [ТЗ](FUSION_BROWSER_SPEC.md), [протокол бота](FUSION_AGENT_WORKFLOW.md), [реестр](../spec/process/fusion-tasks.v1.json). Выполнение только по живой READY-карточке контролёра; постановка задач не доказывает продукт и не увеличивает cadence.

## Выпущено и проверено

**THREE-MODE-LAUNCHER-001 RELEASED_TO_MAIN:** #228/#233; top bar #234/#235. Actual main **`9ea217f253b3348d34638841936fa79b75f95fa2`**, integration после audit #236 **`4729222`**. Главная — KOMPAS/Fusion/Vassalite; Vassalite явно недоступен без исходников. Выход через метку ASA CAD и dirty guard, смена оболочки через лаунчер. Релиз владельца не равен полной visual parity.

Аудит a08b17c: process/architecture/schema/budgets PASS; web types 0 diagnostics; launcher 65 PASS; Protected Part/runtime/lifetime PASS (699 wrappers, 0 live); STANDARD 10 phases/106 samples/20 warmups PASS; fresh npm audit 0, imports 288/0 unresolved. Среда измерения отличается от прошлой; сравнение скорости не заявлено.

U2 Arc #226, Circle #231 и Rectangle #224 технически доказаны отдельно. Numeric Line/Arc/Circle visual acceptance **PENDING**. Fusion Circle numeric draft — известное UX-расхождение, не закрыто аудитом. Полный Sketch, ViewCube/marking-menu parity и U2 целиком не приняты.

## Канон и ограничения

KOMPAS `src/web/kompas`, Fusion `src/web/fusion`; **один владелец состояния**, CadApplication/CadDocument/history/persistence; typed actions → ASA adapters → PlaneGCS/OpenCascade B-Rep; Three.js — отображение. Six document kinds: Part, Assembly, Drawing, Fragment, Specification, Text; готовность различается. U1A/U1B/U1C приняты #195/#196; legacy cleanup #208. Frozen #170: `ui-reference-20261004`.

**FUSION_OWNER_PRESSURE_20261125:** 41 source owner ≥85% target, 20 выше target. Owner /root; до новой ответственности — focused extraction/review, frozen owners не растут; применимый долг закрыть до следующей milestone boundary. Лимиты не повышать.

WEB-TYPES/VENDOR-LIFETIME/DEPENDENCIES закрыты #218–#220. NODE_SECURITY_RELEASE_20261111_PENDING закрыт #230 для CI/build Node22.23.5; остальные runtime отдельно. LICENSE/THIRD_PARTY_NOTICE — pre-beta. DETECT_ONLY / ADMIN_BRANCH_PROTECTION_NOT_ENFORCED — KNOWN_RISK.

OWNER_APPROVED_CONTINUOUS_ROADMAP_20261008: PR → exact CI/ordinary proof/independent review → technical integration merge. Main/production/final visual parity требуют решения владельца. Новый checkpoint публикует ТЗ/очередь; пользовательские документы и установленное приложение не меняются.
