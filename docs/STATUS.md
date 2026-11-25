# ASA-CAD — актуальное состояние

Снимок: 2026-11-25 UTC. Live GitHub и machine pointer имеют приоритет.

## Действующая точка

**Full Repository Health Audit — IN_REVIEW; U2 IN_PROGRESS, новые функции BLOCKED до приёмки аудита.** Измерен integration `a08b17c99bf8b3343008810ab5f9f398bd7a139d`. Предложен YELLOW; обязательны exact-head CI, независимый review и merge audit PR. [Отчёт](FULL_REPOSITORY_HEALTH_AUDIT.md) и [evidence](../spec/process/evidence/health-audit-fusion-20261125/summary.json). Measurement PASS не является технической приёмкой.

После принятого #225 (`ae3f713`) приняты #226 Arc, #231 Circle, #228 launcher, #234 top bar: **4 permanent slices**. #230 — operational maintenance. Прежнее 2/3 устарело; триггеры cadence/integration/release закрывает этот аудит. Счёт станет **0 только после технической приёмки и merge**, затем NEXT=U2/Fusion Sketch/navigation.

## Выпущено и проверено

**THREE-MODE-LAUNCHER-001 RELEASED_TO_MAIN:** #228/#233; top bar #234/#235. Actual main **`9ea217f253b3348d34638841936fa79b75f95fa2`**, integration **`a08b17c`**. Главная — KOMPAS/Fusion/Vassalite; Vassalite явно недоступен без исходников. Выход через метку ASA CAD и dirty guard, смена оболочки через лаунчер. Релиз владельца не равен полной visual parity.

Аудит a08b17c: process/architecture/schema/budgets PASS; web types 0 diagnostics; launcher 65 PASS; Protected Part/runtime/lifetime PASS (699 wrappers, 0 live); STANDARD 10 phases/106 samples/20 warmups PASS; fresh npm audit 0, imports 288/0 unresolved. Среда измерения отличается от прошлой; сравнение скорости не заявлено.

U2 Arc #226, Circle #231 и Rectangle #224 технически доказаны отдельно. Numeric Line/Arc/Circle visual acceptance **PENDING**. Fusion Circle numeric draft — известное UX-расхождение, не закрыто аудитом. Полный Sketch, ViewCube/marking-menu parity и U2 целиком не приняты.

## Канон и ограничения

KOMPAS `src/web/kompas`, Fusion `src/web/fusion`; **один владелец состояния**, CadApplication/CadDocument/history/persistence; typed actions → ASA adapters → PlaneGCS/OpenCascade B-Rep; Three.js — отображение. Six document kinds: Part, Assembly, Drawing, Fragment, Specification, Text; готовность различается. U1A/U1B/U1C приняты #195/#196; legacy cleanup #208. Frozen #170: `ui-reference-20261004`.

**FUSION_OWNER_PRESSURE_20261125:** 41 source owner ≥85% target, 20 выше target. Owner /root; до новой ответственности — focused extraction/review, frozen owners не растут; применимый долг закрыть до следующей milestone boundary. Лимиты не повышать.

WEB-TYPES/VENDOR-LIFETIME/DEPENDENCIES закрыты #218–#220. NODE_SECURITY_RELEASE_20261111_PENDING закрыт #230 для CI/build Node22.23.5; остальные runtime отдельно. LICENSE/THIRD_PARTY_NOTICE — pre-beta. DETECT_ONLY / ADMIN_BRANCH_PROTECTION_NOT_ENFORCED — KNOWN_RISK.

OWNER_APPROVED_CONTINUOUS_ROADMAP_20261008: PR → exact CI/ordinary proof/independent review → technical integration merge. Main/production/final visual parity требуют решения владельца. Пользовательские документы и установленное приложение не меняются этим audit PR.
