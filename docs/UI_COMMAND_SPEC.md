# ASA-CAD UI command specification

This document is the binding UI/UX implementation contract for the ASA-CAD product shell.

It answers four questions for every product control:

1. **what the user sees**;
2. **what the control does**;
3. **when it becomes available**;
4. **which ASA-owned command/API it calls**.

The goal is a KOMPAS-oriented engineering workflow without coupling the visible product to the imported ToubkalCAD UI.

## 1. UI implementation decision

### Do not reskin ToubkalCAD into the final product

The imported ToubkalCAD shell remains a temporary diagnostic/reference surface only while ASA-owned APIs are extracted.

Do **not** progressively repaint vendor components until they look like KOMPAS. That would couple the final interface to vendor Zustand stores, events, component paths and layout assumptions and would make upstream updates difficult.

### Build a new ASA shell over `CadApplication`

The permanent direction is:

```text
ASA-owned UI
    |
    v
CommandRegistry / CadApplication
    |
    v
ASA adapters
    |
    v
Toubkal-derived runtime / OpenCascade / solvers
```

The vendor shell may remain reachable in development until the protected Part workflow works completely through the ASA shell. After that it is removed from the production bundle and kept only as source/reference under `vendor/toubkal`.

### Vertical-slice rollout

Do not create a hundred fake buttons first.

For each milestone:

1. add the ASA command/API;
2. add its parameter model;
3. add the visible control;
4. add the deterministic demo fixture;
5. add browser/visual regression;
6. only then mark the command `implemented`.

A command that is planned but not implemented may be shown in **development fixtures** as disabled with a roadmap marker. Production UI should not contain controls that appear usable but do nothing.

---

## 2. Permanent application shell

The desktop shell is composed of reusable ASA components:

```text
AppFrame
|- MainMenu / application menu
|- QuickAccessBar
|- DocumentTabs
|- WorkspaceTabs
|  `- CommandGroups / CommandButton / SplitButton / Dropdown
|- LeftDock
|  `- DocumentTree
|- Center
|  `- 3D viewport / 2D sheet / table / text page
|- RightDock
|  `- ParameterPanel / PropertiesPanel
|- ContextToolbar
|- StatusBar
|- CommandSearch
`- Notifications / diagnostics
```

The shell is the same product for all six document kinds. The active document kind changes workspace tabs, command groups, tree semantics and center editor.

### Target document kinds

- `part` — Деталь;
- `assembly` — Сборка;
- `drawing` — Чертеж;
- `fragment` — Фрагмент;
- `specification` — Спецификация;
- `text` — Текстовый документ.

---

## 3. Control contract

Every visible command must have a stable registry entry with at least:

```ts
interface UiCommandDefinition {
  id: string;
  labelRu: string;
  documentKinds: CadDocumentKind[] | ['all'];
  workspace: string;
  group: string;
  control: 'button' | 'split-button' | 'dropdown' | 'toggle';
  milestone: string;
  backendCommand?: string;
  enableWhen: string;
  parameterPanel?: string;
  status: 'planned' | 'implemented' | 'deferred';
}
```

The registry is product authority for button names and placement. UI components should render from or validate against this registry rather than inventing labels independently.

Machine-readable initial registry: `spec/ui/command-registry.v1.json`.

---

# 4. Common/system controls

These controls exist regardless of engineering document kind unless noted.

| ID | Visible label | Control | Location/group | Behavior | Milestone |
|---|---|---|---|---|---|
| `system.new` | Новый | split-button | Quick access / Файл | Primary action opens new-document dialog. Dropdown contains six document kinds. | M2 |
| `system.open` | Открыть | button | Quick access / Файл | Standalone: local/native file picker. ASA Lab: project picker/navigation. | M2/M5 |
| `system.save` | Сохранить | button | Quick access / Файл | Saves current native `CadDocument` through host. | M2 |
| `system.saveAs` | Сохранить как | button | Файл | Standalone native ASA document copy/download; ASA Lab creates copy/new project version as defined by host. | M2/M5 |
| `system.export` | Экспорт | split-button | Файл | Context-specific export menu. Never replaces native save. | M4/M6/M6A |
| `system.undo` | Отменить | button | Quick access | `CadApplication.undo()`. | M2 |
| `system.redo` | Повторить | button | Quick access | `CadApplication.redo()`. | M2 |
| `system.rebuild` | Перестроить | button | Quick access / Диагностика | Recompute active engineering document. | M2 |
| `system.search` | Поиск команд | input/button | Main menu | Search ASA command registry by Russian command name. | M2 |
| `system.settings` | Настройки | button | Main menu | Opens application/user settings. | M2/M7 |
| `system.documentSettings` | Параметры документа | button | Файл/Документ | Units, precision, standards/profile, document-specific settings. | M2+ |
| `system.help` | Справка | button | Main menu | ASA documentation/tutorial help. | M2 |
| `system.closeDocument` | Закрыть | button | Document tab | Close with unsaved/recovery handling. | M2 |

## New-document split menu

`Новый` dropdown order is fixed:

1. **Деталь**;
2. **Сборка**;
3. **Чертеж**;
4. **Фрагмент**;
5. **Спецификация**;
6. **Текстовый документ**.

Each row shows the ASA-owned icon, name and short explanation. Icons are recreated for ASA; do not copy proprietary KOMPAS artwork.

---

# 5. Common viewport/navigation controls

Visible for Part/Assembly and where relevant for associative Drawing view inspection.

| ID | Label | Type | Group | Behavior | Milestone |
|---|---|---|---|---|---|
| `view.fit` | Показать всё | button | Вид | Fit model/document to work area. | M2 |
| `view.front` | Спереди | button/dropdown child | Ориентация | Standard front view. | M2 |
| `view.top` | Сверху | child | Ориентация | Standard top view. | M2 |
| `view.left` | Слева | child | Ориентация | Standard left view. | M2 |
| `view.right` | Справа | child | Ориентация | Standard right view. | M2 |
| `view.bottom` | Снизу | child | Ориентация | Standard bottom view. | M2 |
| `view.back` | Сзади | child | Ориентация | Standard back view. | M2 |
| `view.iso` | Изометрия | button | Ориентация | Standard isometric view. | M2 |
| `view.projection` | Проекция | dropdown | Вид | Orthographic / perspective. | M2 |
| `view.display` | Отображение | dropdown | Вид | Shaded, shaded with edges, wireframe/hidden-line modes as supported. | M2 |
| `view.section` | Сечение модели | button | Вид | Temporary inspection section, not Part feature. | M4/M7 |
| `view.measure` | Измерить | split-button | Измерения | Distance/angle/radius/area/etc. as supported. | M4 |

Mouse/keyboard navigation is configured centrally; individual feature code must not implement its own camera scheme.

---

# 6. Part / Деталь UI

## Workspace tabs

Initial Part desktop tabs:

1. **Твердотельное моделирование**;
2. **Эскиз** — contextual, only while editing a sketch;
3. **Каркас и поверхности** — later wave;
4. **Проверка / Измерения**;
5. **Вид**.

## 6.1 Part — primary modeling group

| ID | Label | Control | Group | Parameter panel / action | Milestone |
|---|---|---|---|---|---|
| `part.sketch.create` | Создать эскиз | button | Эскиз | Choose XY/XZ/YZ plane or planar face; enter sketch mode. | M2/M3 |
| `part.extrude` | Элемент выдавливания | button | Элементы тела | Profile, direction, distance, symmetric/two-side, draft where supported, target body/scope. | M1/M2 |
| `part.cutExtrude` | Вырезать выдавливанием | button | Элементы тела | Profile, direction, depth/through-all, scope. | M1/M2 |
| `part.revolve` | Элемент вращения | button | Элементы тела | Profile, axis, angle, direction. | M4 |
| `part.cutRevolve` | Вырезать вращением | button | Элементы тела | Profile, axis, angle, scope. | M4 |
| `part.hole` | Отверстие | split-button | Элементы тела | Primary = simple hole; dropdown contains hole forms. | M4 |
| `part.fillet` | Скругление | button | Элементы тела | Select edges/faces, radius, propagation where reliable. | M1/M2/M4 |
| `part.chamfer` | Фаска | button | Элементы тела | Edge selection; distance/distance or distance/angle. | M4 |
| `part.shell` | Оболочка | button | Элементы тела | Faces to remove, thickness, direction. | M4 |
| `part.rib` | Ребро жесткости | button | Элементы тела | Sketch/curve, thickness, direction. | M4 |
| `part.draft` | Уклон | button | Элементы тела | Faces, neutral plane, angle. | M4 |
| `part.sweep` | По траектории | button | Элементы тела | Section + path + orientation. | M4 second wave |
| `part.loft` | По сечениям | button | Элементы тела | Ordered sections, guides where supported. | M4 second wave |

### Hole split menu

The `Отверстие` split button is designed to match the KOMPAS mental model. Initial dropdown:

- `Отверстие простое`;
- `Отверстие с зенковкой`;
- `Отверстие с цековкой`;
- `Отверстие с зенковкой и цековкой`;
- `Отверстие коническое`;
- `Отверстие из библиотеки` — **deferred** until ASA has its own library/template model.

The first implemented form may be `Отверстие простое`; unavailable forms remain hidden in production until implemented.

## 6.2 Part — arrays and transformations

| ID | Label | Type | Group | Milestone |
|---|---|---|---|---|
| `part.pattern.linear` | Линейный массив | dropdown child/button | Массив | M4 |
| `part.pattern.circular` | Круговой массив | child/button | Массив | M4 |
| `part.pattern.mirror` | Зеркальный массив | child/button | Массив | M4 |
| `part.transform.move` | Переместить тело | button | Преобразования | M7 |
| `part.transform.copy` | Копировать тело | button | Преобразования | M7 |

## 6.3 Part — datum/reference geometry

`Вспомогательная геометрия` split/dropdown:

- `Плоскость`;
- `Ось`;
- `Точка`;
- later advanced coordinate systems/curves.

Initial stable IDs:

- `part.datum.plane`;
- `part.datum.axis`;
- `part.datum.point`.

Milestone: M4 second wave / M7 advanced variants.

## 6.4 Part diagnostics

- `part.check.geometry` — **Проверка геометрии**;
- `part.check.interference` — **Проверка коллизий** where multiple bodies/components make sense;
- `part.variables` — **Переменные**;
- `part.properties` — **Свойства**.

Milestone: M4/M7.

---

# 7. Sketch / Эскиз contextual UI

The Sketch workspace appears only while a sketch is active. Entering sketch mode changes the tree/context and shows `Завершить эскиз` prominently.

## 7.1 Sketch geometry

| ID | Label | Control | Group | Milestone |
|---|---|---|---|---|
| `sketch.line` | Отрезок | split-button | Геометрия | M2/M3 |
| `sketch.polyline` | Ломаная | button | Геометрия | M3 |
| `sketch.circle` | Окружность | split-button | Геометрия | M2/M3 |
| `sketch.arc` | Дуга | split-button | Геометрия | M3 |
| `sketch.rectangle` | Прямоугольник | split-button | Геометрия | M1/M2/M3 |
| `sketch.polygon` | Многоугольник | button | Геометрия | M3 |
| `sketch.trim` | Усечь | button | Редактирование | M3 |
| `sketch.extend` | Удлинить | button | Редактирование | M3 |
| `sketch.offset` | Эквидистанта | button | Редактирование | M3 |
| `sketch.fillet` | Скругление | button | Редактирование | M3 |
| `sketch.chamfer` | Фаска | button | Редактирование | M3 |
| `sketch.project` | Спроецировать объект | button | Проекция | M3 |
| `sketch.construction` | Вспомогательная геометрия | toggle | Геометрия | M3 |

The exact variants inside line/circle/arc/rectangle split menus are added only when their command implementation exists. Primary controls always use the most common creation method.

## 7.2 Sketch constraints

| ID | Label | Milestone |
|---|---|---|
| `constraint.coincident` | Совпадение | M3 |
| `constraint.horizontal` | Горизонтальность | M3 |
| `constraint.vertical` | Вертикальность | M3 |
| `constraint.parallel` | Параллельность | M3 |
| `constraint.perpendicular` | Перпендикулярность | M3 |
| `constraint.tangent` | Касание | M3 |
| `constraint.concentric` | Концентричность | M3 |
| `constraint.equal` | Равенство | M3 |
| `constraint.symmetric` | Симметрия | M3 |
| `constraint.fixed` | Фиксация | M3 |
| `constraint.pointOnCurve` | Точка на кривой | M3 |

Controls are enabled from current selection types. For example, `Параллельность` requires two compatible line-like entities; `Концентричность` requires compatible circles/arcs.

## 7.3 Sketch dimensions

- `dimension.linear` — **Линейный размер**;
- `dimension.horizontal` — **Горизонтальный размер**;
- `dimension.vertical` — **Вертикальный размер**;
- `dimension.angular` — **Угловой размер**;
- `dimension.radius` — **Радиальный размер**;
- `dimension.diameter` — **Диаметральный размер**.

Milestone: M3.

## 7.4 Sketch lifecycle

- `sketch.finish` — **Завершить эскиз**;
- `command.cancel` — **Отмена**;
- `sketch.solveStatus` — visible under/fully constrained indicator;
- conflict/redundancy diagnostics in status/right panel.

---

# 8. Assembly / Сборка UI

## Workspace tabs

1. **Сборка**;
2. **Редактирование компонента** — contextual;
3. **Проверка / Измерения**;
4. **Вид**.

## 8.1 Components group

| ID | Label | Control | Behavior | Milestone |
|---|---|---|---|---|
| `assembly.component.insert` | Добавить компонент | button/split | Select existing ASA Part/subassembly. | M4A |
| `assembly.component.createPart` | Создать деталь | button | Create external Part project/document and enter in-context Part editing. | M4A |
| `assembly.component.createAssembly` | Создать сборку | button | Create subassembly and enter contextual editing. | M4A |
| `assembly.component.createLocalPart` | Создать локальную деталь | dropdown child | Optional local-only component; deferred until external-component semantics are stable. | M7 |
| `assembly.component.edit` | Редактировать компонент | button | Enter selected component context. | M4A |
| `assembly.component.finishEdit` | Завершить редактирование | button | Return to parent Assembly. | M4A |
| `assembly.component.replace` | Заменить компонент | button | Pick new source while preserving compatible occurrence/mates where possible. | M4A |
| `assembly.component.update` | Обновить версию | button | Explicitly move occurrence to newer source revision/version. | M4A/M5 |
| `assembly.component.duplicate` | Копировать компонент | button | New occurrence with same pinned source. | M4A |
| `assembly.component.suppress` | Подавить | toggle | Exclude occurrence from solve/display as defined. | M4A |
| `assembly.component.visibility` | Скрыть/Показать | toggle | Display only. | M4A |

## 8.2 Placement and mates

| ID | Label | Group | Milestone |
|---|---|---|---|
| `assembly.move` | Переместить компонент | Размещение компонентов | M4A |
| `assembly.rotate` | Повернуть компонент | Размещение компонентов | M4A |
| `assembly.fix` | Зафиксировать | Размещение компонентов | M4A |
| `assembly.unfix` | Снять фиксацию | Размещение компонентов | M4A |
| `assembly.mate.coincident` | Совпадение | Сопряжения | M4A |
| `assembly.mate.concentric` | Соосность/Концентричность | Сопряжения | M4A |
| `assembly.mate.parallel` | Параллельность | Сопряжения | M4A |
| `assembly.mate.perpendicular` | Перпендикулярность | Сопряжения | M4A |
| `assembly.mate.distance` | Расстояние | Сопряжения | M4A |
| `assembly.mate.angle` | Угол | Сопряжения | M4A |

Parameter panel for a mate always shows selected object A/B, orientation/flip where applicable, numeric value where applicable, solve state, confirm/cancel.

## 8.3 Assembly later tools

- `assembly.pattern.linear` — Линейный массив компонентов;
- `assembly.pattern.circular` — Круговой массив компонентов;
- `assembly.pattern.mirror` — Зеркальное отражение компонентов;
- `assembly.explode` — Разнесенный вид;
- `assembly.interference` — Проверка коллизий;
- `assembly.bom` — Создать/обновить спецификацию.

Milestone: M7 except diagnostics that may arrive earlier.

---

# 9. Drawing / Чертеж UI

Drawing uses a 2D sheet work area, not the 3D viewport.

## Workspace tabs

1. **Черчение**;
2. **Виды**;
3. **Размеры**;
4. **Обозначения**;
5. **Листы / Оформление**;
6. **Вид**.

## 9.1 Sheet/document group

- `drawing.sheet.add` — **Добавить лист**;
- `drawing.sheet.remove` — **Удалить лист**;
- `drawing.sheet.format` — dropdown **Формат**: A4/A3/A2/A1/A0/Пользовательский;
- `drawing.sheet.orientation` — **Ориентация**: книжная/альбомная;
- `drawing.sheet.scale` — **Масштаб**;
- `drawing.sheet.frame` — **Рамка и основная надпись**;
- `drawing.layers` — **Слои**.

Milestone: M6.

## 9.2 Associative views

- `drawing.view.base` — **Главный/базовый вид**;
- `drawing.view.projected` — **Проекционный вид**;
- `drawing.view.isometric` — **Изометрический вид**;
- `drawing.view.section` — **Разрез/сечение**;
- `drawing.view.detail` — **Местный/детальный вид** — later M7;
- `drawing.view.update` — **Обновить виды**;
- `drawing.view.source` — source Part/Assembly + pinned/tracked version policy in parameter panel.

Milestone: M6.

## 9.3 2D geometry

Drawing and Fragment share these ASA commands:

- `draft.line` — Отрезок;
- `draft.polyline` — Ломаная;
- `draft.circle` — Окружность;
- `draft.arc` — Дуга;
- `draft.rectangle` — Прямоугольник;
- `draft.polygon` — Многоугольник;
- `draft.trim` — Усечь;
- `draft.extend` — Удлинить;
- `draft.offset` — Эквидистанта;
- `draft.hatch` — Штриховка;
- `draft.text` — Текст.

Milestone: M6.

## 9.4 Drawing dimensions

- `draft.dimension.linear` — Линейный размер;
- `draft.dimension.angular` — Угловой размер;
- `draft.dimension.radius` — Радиальный размер;
- `draft.dimension.diameter` — Диаметральный размер;
- grouped/baseline dimension variants later M7.

## 9.5 Drawing annotations

First wave:

- `drawing.annotation.centerline` — Осевая линия;
- `drawing.annotation.centermark` — Обозначение центра;
- `drawing.annotation.leader` — Линия-выноска;
- `drawing.annotation.text` — Текст;
- `drawing.annotation.roughness` — Шероховатость;
- `drawing.annotation.requirements` — Технические требования.

Later M7:

- geometric tolerance;
- datum designation;
- weld symbols;
- advanced standards-oriented callouts.

---

# 10. Fragment / Фрагмент UI

Fragment deliberately reuses the same 2D controls as Drawing but omits sheet/view-generation controls.

Workspace tabs:

1. **Черчение**;
2. **Размеры**;
3. **Обозначения**;
4. **Слои**;
5. **Вид**.

Primary controls are `draft.*` plus reusable insertion/import/export commands.

- `fragment.insert` — Вставить фрагмент/reference;
- `fragment.exportSvg` / DXF via common Export menu.

Milestone: M6.

---

# 11. Specification / Спецификация UI

The center work area is a structured engineering table, not a canvas.

Workspace tabs:

1. **Спецификация**;
2. **Данные изделия**;
3. **Оформление**;
4. **Вид**.

Initial commands:

| ID | Label | Milestone |
|---|---|---|
| `spec.generate` | Создать по сборке | M6A |
| `spec.refresh` | Обновить по сборке | M6A |
| `spec.linkSource` | Связать со сборкой/чертежом | M6A |
| `spec.section.add` | Добавить раздел | M6A |
| `spec.row.add` | Добавить строку | M6A |
| `spec.row.delete` | Удалить строку | M6A |
| `spec.position.assign` | Расставить позиции | M6A |
| `spec.sort` | Сортировка | M6A |
| `spec.group` | Группировка | M6A |
| `spec.diff` | Изменения источника | M6A |

Export menu: PDF, XLSX, CSV.

---

# 12. Text document / Текстовый документ UI

The center work area is page-based text/document editing.

Workspace tabs:

1. **Текст**;
2. **Вставка**;
3. **Оформление**;
4. **Страница**.

Initial controls:

- paragraph/style dropdown;
- bold/italic/underline if required by ASA engineering text profile;
- text alignment;
- engineering symbol insertion;
- table insertion/editing;
- page break;
- header/footer;
- frame/title-block profile;
- link to Part/Assembly/Drawing/Specification;
- PDF export.

Stable command IDs use `text.*`, for example `text.table.insert`, `text.symbol.insert`, `text.pageBreak`, `text.linkDocument`.

Milestone: M6A.

---

# 13. Parameter panel contract

A KOMPAS-oriented command is not only a toolbar button. Most engineering commands open a right-side/contextual **Панель параметров**.

Permanent lifecycle:

```text
click command
-> command becomes active
-> parameter panel opens
-> selection prompts/fields become active
-> live preview when safe
-> Создать/Применить
-> command may stay active for repeated creation
-> Завершить or Esc
```

Every command implementation must define:

- required selections;
- numeric/text fields;
- toggle/dropdown choices;
- default values;
- live-preview behavior;
- validation errors;
- `Создать объект` / `Применить` behavior;
- `Отмена` / `Завершить` behavior.

Example `Элемент выдавливания` panel:

```text
Профиль          [Эскиз 1]
Направление      [Прямое v] [сменить]
Расстояние       [10.00 mm]
Вторая сторона   [off]
Симметрично      [off]
Операция         [Новое тело / Объединить]
Область          [Авто / выбранные тела]

[Создать объект] [Отмена]
```

Example `Совпадение` Assembly panel:

```text
Объект 1         [выбрать]
Объект 2         [выбрать]
Ориентация       [совпадает / противоположная]
Состояние        [решено / конфликт]

[Создать] [Отмена]
```

---

# 14. Context sensitivity and enabling rules

Buttons must not all be permanently enabled.

Examples:

- `Создать эскиз` enabled when Part document is editable;
- `Элемент выдавливания` enabled when a suitable closed sketch/profile exists or is selected;
- `Скругление` enabled when valid edges/faces are selected;
- `Совпадение` enabled in Assembly with compatible selected references or while mate command is selecting them;
- `Проекционный вид` enabled when a valid source view exists;
- `Обновить по сборке` enabled when Specification has a source link;
- save/export disabled during destructive transient states where serialization is unsafe.

The enable predicate belongs to ASA application/view-model logic, not arbitrary React components.

---

# 15. Tree/context menus

Toolbar parity alone is insufficient. The tree must expose context actions.

## Part tree context menu

Depending on selected object:

- Редактировать;
- Переименовать;
- Подавить/Включить;
- Скрыть/Показать;
- Перестроить отсюда / diagnostics where supported;
- Удалить;
- Свойства.

## Assembly tree context menu

- Редактировать компонент;
- Открыть компонент;
- Заменить;
- Обновить версию;
- Зафиксировать/Снять фиксацию;
- Подавить/Включить;
- Скрыть/Показать;
- Удалить occurrence;
- Свойства.

## Drawing tree context menu

- Активировать лист/вид;
- Обновить вид;
- Изменить масштаб;
- Скрыть/Показать;
- Удалить;
- Свойства.

---

# 16. Implementation order for the UI

## M1 — command architecture, no final shell yet

- define `CadDocument` union;
- define `CadApplication`;
- define stable command IDs and registry schema;
- implement protected Part workflow through commands;
- no permanent ASA toolbar may call vendor internals.

## M2 — shell + first working vertical slice

Build the new shell from zero with reusable components:

- main/application menu;
- quick access bar;
- document tabs;
- workspace tabs/group renderer;
- model tree;
- parameter panel;
- viewport host;
- status bar;
- command search;
- save/rebuild indicators;
- new-document dialog.

First **active** button set:

- Новый/Открыть/Сохранить;
- Undo/Redo/Rebuild;
- Create Sketch;
- line/rectangle/circle required by protected workflow;
- core dimension required by protected workflow;
- Finish Sketch;
- Extrude;
- Cut Extrude;
- Fillet;
- viewport standard views/fit.

This is the first page the owner reviews visually.

## M2A — owner review fixtures

Add stable URLs/fixtures for the shell states. Every subsequent UI milestone uses them.

## M3 — complete Sketch groups

Implement full first-wave geometry, constraints, dimensions and sketch diagnostics.

## M4 — complete Part Design groups

Add remaining first-wave features, arrays, references, diagnostics and parameters.

## M4A — Assembly groups

Add Components, Placement/Mates and in-context Part editing. Do not fork a second Part editor; contextual editing uses the same Part command surface.

## M4B — standalone beta

Freeze the public shell/command registry version, browser E2E and compatibility fixtures.

## M5 — ASA Lab integration

The same shell runs behind `/cad/*`. Add ASA project/class/save/submit host behavior; do not redesign CAD buttons during integration.

## M6 — Drawing + Fragment

Introduce shared 2D engine and the Drawing/Fragment command groups.

## M6A — Specification + Text

Introduce structured table/text work areas and their command groups.

## M7 — parity expansion

Add advanced KOMPAS-oriented commands, patterns, surface modeling, advanced drafting symbols, templates, settings, exchange and workflow refinements.

---

# 17. Vendor-shell retirement gate

The old visible Toubkal shell can be removed from the normal standalone/product entry point when all of these are true:

1. ASA shell boots independently;
2. protected Part workflow is possible without vendor UI;
3. save/reopen works through ASA document host;
4. browser E2E covers that workflow;
5. no ASA shell component imports vendor UI/store/event internals.

Before this gate, vendor UI is a temporary fallback/reference only. After this gate, product development happens exclusively in ASA-owned UI.

---

# 18. KOMPAS reference policy

We use current official KOMPAS-3D documentation to validate command terminology, grouping and command lifecycle. Examples confirmed in official help include:

- `Системная -> Открыть / Сохранить как`;
- `Твердотельное моделирование -> Элементы тела -> Отверстие ...`;
- `Инструменты эскиза -> Геометрия -> Отрезок`;
- `Инструменты эскиза / Черчение -> Размеры -> Линейный размер`;
- `Сборка -> Компоненты -> Создать деталь / Создать сборку`;
- `Сборка -> Компоненты -> Заменить компоненты`;
- `Сборка -> Размещение компонентов -> Совпадение / фиксация`;
- `Черчение -> Виды -> Проекционный вид`;
- `Черчение -> Обозначения -> Шероховатость`.

Reference baseline: KOMPAS-3D v25 official help at `https://help.ascon.ru/KOMPAS/25/ru-RU/`.

We reproduce workflow/organization with ASA-owned implementation and ASA-owned visual assets. Exact proprietary icons/artwork are not imported.

---

# 19. Definition of UI-spec completeness

A command is not considered fully specified until the command registry records:

- stable ID;
- Russian label;
- document kind;
- workspace tab;
- command group;
- button/dropdown type;
- enable predicate;
- parameter panel contract;
- application command/API mapping;
- milestone;
- implementation status;
- at least one behavior test when implemented.

This file defines the first complete product command surface. The machine-readable registry is versioned and extended as M7 adds advanced KOMPAS-oriented coverage.