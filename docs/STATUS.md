# ASA-CAD — текущее состояние и каноничный следующий путь

Снимок: 2026-10-04.

## Источник истины

- Центральная задача объединения: **#184 / UI-CORE-UNIFICATION-001**.
- Каноничная integration-ветка: **`integration/ui-core-unification`**.
- Каноничный UI/UX reference: **PR #170 / `prototype/kompas-shell-reference` / HEAD `88c535c652dac8b04f0d68fa144cf8486afdc926`**.
- Каноничное продуктовое ядро: только обычный ASA-CAD в `src/**`: `CadDocument`, `CadApplication`, typed commands, persistence/history, PlaneGCS/solver, OpenCascade/B-Rep и runtime adapters.
- Внутренние `doc/history/sketcher/snap/THREE.ExtrudeGeometry` из прототипа #170 **НЕ являются продуктовой архитектурой** и не переносятся как второй CAD engine.

## Текущий продукт

Текущий `main`:
`cda903d762b7e52e9345fe09e6dfa0be508a0d6a`

Принятые permanent product slices включают:
- KOMPAS-SHELL-ADOPTION-001 — Part top shell;
- V6C / CAD-VIS-006C — Sketch hierarchy + dimension ownership.

Текущая cadence после V6C: **2/3**.
Следующая принятая permanent product slice поднимает cadence до **3/3** и требует Full Repository Health Audit до следующего permanent product slice.

Honesty boundaries:
- FULL_TREE_PARITY = **NOT ACCEPTED**;
- FULL_M2V = **NOT ACCEPTED**;
- FULL_KOMPAS_PARITY = **NO**;
- ~90% learner-facing visual + functional/workflow identity = **TARGET / NOT CURRENT ACCEPTANCE**.

## Почему изменён путь

В проекте разошлись две линии:
1. #170 дал существенно лучший KOMPAS-oriented UI/UX, но с самостоятельной демонстрационной моделью и упрощённой математикой.
2. Основной ASA-CAD содержит настоящие document/application/solver/OpenCascade/persistence контракты, но пользовательский интерфейс заметно хуже.

Продолжать их отдельно запрещено. Цель — **один интерфейс + одна модель документа + одна история + один solver path + один exact-geometry path**.

## Роли существующих PR

- **#170** — CANONICAL UI/UX REFERENCE. Продолжать визуальную сверку можно; новую CAD-математику в prototype HTML не добавлять.
- **#182** — CLOSED / ARCHIVED / DO NOT CONTINUE. Полезные решения C1 можно извлекать точечно из архивного SHA.
- **#177** — TECHNICAL RECOVERY SOURCE / HOLD. Использовать проверенную геометрию и регрессии; UI не считать целевым.
- **#179** — Drawing candidate / HOLD. Не является основой текущего UI-core объединения.
- **#180** — SUPERSEDED by #184.
- **#181** — отдельный dev-tooling fix; не определяет продуктовую архитектуру.
- **#183** — отдельная cleanup-maintenance; не определяет продуктовую архитектуру.

## NEXT

### U0 — governance / contract synchronization
Только документация и состояние проекта:
- этот STATUS;
- ROADMAP;
- SYSTEM_SPEC;
- ARCHITECTURE;
- VISUAL_REFERENCE_SPEC;
- AGENTS;
- #184 как центральная задача.

После U0 продуктовый код ещё не считается объединённым.

### U1 — canonical shell over real product state
Первый implementation slice:
- внешний вид/компоновка из #170;
- обычный product route;
- настоящее дерево/selection/application state;
- реальный empty Part WorkArea;
- без prototype document/state engine.

Acceptance:
`open Part -> select XY/XZ/YZ -> scene/tree/parameters show one real application selection`.

Дальше строго по #184:
U2 real Sketch -> U3 real constraints/dimensions -> U4 real OpenCascade Extrude -> U5 protected Part route.

## Git contract

```text
main
  |
  +-- integration/ui-core-unification
         |
         +-- slice U1 branch -> PR back to integration
         +-- slice U2 branch -> PR back to integration
         +-- slice U3 branch -> PR back to integration
         +-- ...
```

Не делать один гигантский copy/paste PR из prototype HTML.
Не вливать #170 напрямую в `main`.
Финальный integration -> main допускается только после законченного принятого маршрута, required audit/gates и owner acceptance.
