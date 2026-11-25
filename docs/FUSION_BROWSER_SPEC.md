# ASA CAD: браузерный профиль Fusion

План 2026-11-25, база `a08b17c99bf8b3343008810ab5f9f398bd7a139d`; исполнять на live HEAD. [Реестр](../spec/process/fusion-tasks.v1.json): ID/DAG/срезы; статус/evidence — Issue; [workflow](FUSION_AGENT_WORKFLOW.md): выдача задач. Checkpoint: active-work/STATUS/#184.

## 1. Scope и parity

Профиль: Sketch, navigation, selection, parametric Part через Fusion shell. Command ID, ядро и работающий UI проверяются отдельно. R01: версия/язык Fusion, настройки, браузеры/viewport/DPR/тема/состояния; R02 связывает каждое видимое действие/вариант с командой и сценарием.

**Parity** — согласованный закрытый набор поведения/вида, не весь Autodesk Fusion и любые браузеры/входы. Несогласованные обязательные отличия исключают PARITY. Autodesk reference и ASA baseline сравниваются отдельно.

| Канонический этап | Обязательный результат |
|---|---|
| U2 — Real Sketch | Line/Rectangle/Circle/Arc, pointer/numeric через общий draft/commands. XY → Rectangle60×40 → Undo/Redo → Save/Open: те же intent/IDs. |
| U3 — Constraints / Dimensions | Постоянные размеры/constraints, реальный solver, DoF/диагностика; governing edit → recompute → reopen сохраняет intent. |
| U4 — Extrude | Solved Sketch → validated profile → OpenCascade B-Rep → render. |
| U5 — Protected Part | 60×40 → Extrude10 → Ø12 cut → FilletR1 → width80 → rebuild → Save/Open → edit again. |

F04 требует **R01/R02/P03/A08/B05/M04/SEL02/SEL03/S05/S06/C05/E03/F03** и их зависимостей. Protected Part без camera/menu/selection/поддержанной плоской грани недостаточен.

## 2. Порядок исполнения

G00: принятый/слитый аудит, exact-head CI и independent review. ТЗ не снимает product gate. Первые срезы: T01/P01–P03 → A01–A08 (с A06A/A06B) → B01–B05 → audit → M01–M04 → SEL01–SEL03. Далее S01–S04 → S06 → C05 → E03 → F01–F03; S05 и обязательные ветви сходятся в F04. DAG — в реестре.

Контролёр выдаёт одну READY-карточку: контракт/owners/tests. Один writer на owner; «Блок» декомпозировать под прежним ID. Helper не требует отдельного merge; проверка карточки ≠ приёмка/merge среза. Full Audit — после трёх принятых permanent slices и применимых границ. Совпавшие триггеры совмещаются; перегруппировка не сбрасывает cadence.

## 3. Архитектура и camera bridge

Typed actions → CadApplication/CadDocument → ASA adapters → solver/OpenCascade. Fusion/KOMPAS: один документ/history/solver/persistence. Без raw OCC/vendor state в UI; Three не заменяет B-Rep. Сохраняется intent; schema change требует проверенной migration. Неоднозначный StableRef отклоняется.

Menu/ribbon/search/shortcut: один handler/draft, без пустых активных кнопок. Launcher меняет оболочку того же проекта. Undo/Redo — в сессии, перенос history через Save/Open не обещан. Camera/selection не создают CAD history/dirty. При ≥85% target — extraction до новой ответственности; frozen owners не растут.

| Карточки | Обязательный контракт |
|---|---|
| A01–A04 | Одна фактическая камера и matrices, общий origin/u/v/normal, readiness. Для XY/XZ/YZ точки (0,0), (20,10), (−15,25) проходят plane→screen→plane в заданном tolerance. |
| A05–A06 | Drawing/selection/drag/profile hit: общий inverse, точные coordinates/IDs после наклона. Старый плоский picking запрещён. Renderer bridge выбирает A01; CSS matrix3d не предписан. |
| A06A–A06B | Numeric anchors читаемы/доступны, snap учитывает экранный масштаб. Edge-on/blur/pointercancel/release вне canvas не дают commit/stuck drag. Draft сохраняется, Look At восстанавливает ввод. Обязательно до A08. |
| A07–A08 | Cube/Fit/Look At синхронны; ввод после поворота → Finish → Extrude → Save/Open; без регрессии KOMPAS. |
| B01–B05 | Перспектива, near-plane/точки за камерой, anchors/snap, мышь/wheel, lifecycle. Нет NaN/огромных координат/stale handlers после re-entry; Home отличается от Look At. |

Runtime не пересоздаётся ради вида. S05: StableRef→frame для supported planar face; до него ограничение явно. F04 с origin-only не принимается.

## 4. Сценарии Q01–Q16

Маршрут: launcher → `/cad/fusion/:id`, чистый проект. Edits: cancel/invalid без повреждения, Undo/Redo, Save/Open с теми же intent/IDs, повторный edit. Проверять geometry/параметры; tolerance задать заранее.

| ID · карточки | Действие и ожидаемый результат |
|---|---|
| Q01 · P01–P03 | Circle: центр вне origin, Ø12 → один R6 с тем же центром. Panel/ghost согласованы; cancel не создаёт entity. |
| Q02 · A01/A08/B05 | Orbit, pan/zoom, Look At: cube/scene синхронны; geometry в рабочей плоскости, revision/history неизменны. Camera persistence — отдельный контракт. |
| Q03 · A04/A06 | Выбрать/переместить entity после наклона: ожидаемые ID/plane coordinates, один edit; highlight/anchors совпадают. |
| Q04 · A06B/B02 | Вид ребром → Look At: неопределимый inverse блокирует ввод без commit; draft/валидность сохранены, причина видна. |
| Q05 · M01/M02 | ПКМ cube/canvas у четырёх краёв: правильный контекст, одно необрезанное меню, один dispatch; Esc закрывает нужный слой. |
| Q06 · SEL01/SEL02 | Click/Ctrl/Shift; рамка L→R — внутри, R→L — также пересечённые: точные IDs, canvas/tree/panel согласованы, без CAD undo. |
| Q07 · S01–S03 | Line/Rectangle60×40/Circle/Arc: pointer/numeric, repeat/cancel/invalid; координаты/размеры/типы/preview соответствуют результату. |
| Q08 · C01/C02 | Постоянные width60→80, Ø12→14: solved geometry/labels/единицы согласованы; intent сохранён. |
| Q09 · C03/C04 | Конфликт размера/constraint виден; последнее валидное решение сохранено, нет частичного объекта/чужого solve result. |
| Q10 · E01 | Замкнутый/открытый контур, отверстие, construction, самопересечение: заливка совпадает с profile; failure не портит features. |
| Q11 · E02 | Rectangle60×40 → Extrude10: bbox60×40×10, volume24000 мм³ до следующих операций; Circle→цилиндр, reverse/symmetric; cancel без body. |
| Q12 · F01 | Блок60×40×10, внутреннее Ø12 through-hole: до Fillet volume=24000−360π мм³; тело/направление верны, отмена сохраняет блок. |
| Q13 · F02/F03 | Protected Part: после R1/width80 опоры верны; Save/Open → Ø14 успешно; tree/panel/viewport показывают одну деталь. |
| Q14 · F03 | Fusion → Save → KOMPAS → Fusion: один document ID/geometry/параметры без скрытой конвертации/копии. |
| Q15 · A06A/A06B/SEL03/B04 | Resize/DPR, blur/pointercancel, text/numeric focus/composition: CSS/canvas pixels согласованы; нет stuck drag/двойного commit/shortcut; отказ save не «успех». |
| Q16 · R01/F04 | Одинаковые сцена/viewport/тема/DPI/состояние: Autodesk reference и ASA baseline отдельно; screenshot не заменяет geometry oracle и не меняет intent. |

## 5. Acceptance и выпуск

CORE/USER_PATH/DOCUMENT, VISUAL_DELTA/PARITY и PREVIEW точного SHA независимы. NOT_RUN/NOT_TESTED/BLOCKED не PASS. Новая операция: ≥2 допустимых класса, ≥1 недопустимого, topology corpus.

UI: реальный build, одинаковые ДО/ПОСЛЕ/crops, источник/отличия, SHA/browser evidence, artifacts ≥30 дней. Контролёр смотрит кадры, владелец даёт visual verdict. Без автоматической смены baseline, ослабления assertions, force-click и hidden app.execute/localStorage для предмета приёмки; читать документ/isolated fixtures можно.

Карточка: focused tests/typecheck/boundaries. Срез: browser flows, Protected Part по затронутой области, history/persistence/budgets/review. Конечный HEAD: все required CI; после правки проверить новый SHA. PR в integration, ≤6 review commits, без direct/force push. F04 требует все обязательные ветви, audits/gates и проверенный preview; main/deployment/final parity требуют отдельной приёмки владельца. Technical merge её не заменяет.

## 6. Расширения после F04

X01 Trim; X02 Extend/Split; X03 Offset; X04 Mirror/patterns; X05 Sketch Fillet/Chamfer; X06 Polygon/Ellipse/Point/Spline и варианты примитивов; X07 Project/ассоциативность; X08 повторные Extrude/несколько тел/Join/Cut/Intersect; X09 Revolve/Sweep/Loft; X10 полнота меню/вида, effects/pivot/touch; X11 другие среды Fusion/ASA Lab.

Все X после F04; X07 также S05, X10/X11 — R02. Детализировать варианты/входы/oracle/cancel/history/persistence; блоки не READY, весь Fusion не утверждён.

## 7. Источники

Канон: [quality gates](DEVELOPMENT_QUALITY_GATES.md), [U2–U5](UI_CORE_UNIFICATION_SPEC.md), [command registry](../spec/ui/command-registry.v1.json), AGENTS и machine contracts. Frozen ASA UX: `ui-reference-20261004`; Fusion references: `src/web/fusion/*reference*.json`.

Autodesk: [ViewCube](https://help.autodesk.com/cloudhelp/ENU/Fusion-GetStarted/files/GS-VIEWCUBE.htm), [Navigation](https://help.autodesk.com/cloudhelp/ENU/Fusion-GetStarted/files/GS-NAVIGATION-BAR.htm), [Sketch Palette](https://help.autodesk.com/cloudhelp/ENU/Fusion-Sketch/files/GUID-4183A4B7-E002-4396-AD5A-7FF3C8B2F33A.htm), [Marking menu](https://help.autodesk.com/cloudhelp/ENU/Fusion-GetStarted/files/GUID-6514ABC1-CB75-4F0B-AB0E-316FAD36BA93.htm), [Selection](https://help.autodesk.com/cloudhelp/ENU/Fusion-Model/files/SLD-SELECTION.htm), [Extrude](https://help.autodesk.com/cloudhelp/ENU/Fusion-Model/files/SLD-EXTRUDE-SOLID.htm). Проверки: [Playwright practices](https://playwright.dev/docs/best-practices), [visual comparisons](https://playwright.dev/docs/test-snapshots).
