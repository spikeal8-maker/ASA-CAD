# KOMPAS v25 functional UI inventory for ASA-CAD

This document is the traceable reference inventory feeding ASA-CAD UI parity decisions.

It is **not** the ASA implementation spec. Commands admitted to ASA-CAD must also exist in `docs/UI_COMMAND_SPEC.md` and receive a stable entry in `spec/ui/command-registry*.json`.

Tracking issue: #16.

## Classification

- `core-now` — required for near-term protected workflows;
- `planned` — included in target ASA product, later milestone;
- `advanced` — broader parity after foundations;
- `not-in-ASA-scope` — explicitly excluded with a reason.

## Reference policy

Primary source is current official KOMPAS-3D v25 help:

`https://help.ascon.ru/KOMPAS/25/ru-RU/`

We record functional names/grouping/behavior. ASA uses its own implementation and icons/artwork.

## Inventory fields

Each completed row should eventually contain:

`KOMPAS name | document/workspace | group | control/variants | selection/parameters | ASA ID | classification | milestone | source`

---

## Verified seed inventory

| KOMPAS command | Workspace / group | Control/variants | ASA ID | Classification | Milestone | Official source |
|---|---|---|---|---|---|---|
| Открыть | Системная / Файл | button | `system.open` | core-now | M2 | `bm1510125.html` |
| Сохранить как | Системная / Файл | button | `system.saveAs` | core-now | M2 | `bm1510125.html` |
| Отрезок | Инструменты эскиза / Геометрия; Черчение / Геометрия | primary + related segment variants | `sketch.line` / `draft.line` | core-now/planned | M2/M3/M6 | KOMPAS help: Построение отрезков |
| Линейный размер | Инструменты эскиза / Размеры; Черчение / Размеры | parameter variants incl. parallel/horizontal/vertical placement | `dimension.linear` / `draft.dimension.linear` | core-now/planned | M2/M3/M6 | `cm_diml.html` |
| Отверстие простое | Твердотельное моделирование / Элементы тела | hole placement + diameter/depth/bottom | `part.hole.simple` | planned | M4 | `314_postroenie_kruglolgo_otv.html` |
| Отверстие с зенковкой | Твердотельное моделирование / Элементы тела | hole variant | `part.hole.countersink` | planned | M4 | `314_postroenie_kruglolgo_otv.html` |
| Отверстие с цековкой | Твердотельное моделирование / Элементы тела | hole variant | `part.hole.counterbore` | planned | M4 | `314_postroenie_kruglolgo_otv.html` |
| Отверстие с зенковкой и цековкой | Твердотельное моделирование / Элементы тела | hole variant | `part.hole.combo` | planned | M4 | `314_postroenie_kruglolgo_otv.html` |
| Отверстие коническое | Твердотельное моделирование / Элементы тела | hole variant | `part.hole.conical` | planned | M4 | `314_postroenie_kruglolgo_otv.html` |
| Отверстие из библиотеки | Твердотельное моделирование / Элементы тела | library-driven variant | `part.hole.library` | advanced | M7 | `314_postroenie_kruglolgo_otv.html` |
| Создать деталь | Сборка / Компоненты | button, create in place then edit | `assembly.component.createPart` | planned | M4A | KOMPAS help: Создание компонента «на месте» |
| Создать сборку | Сборка / Компоненты | button, create in place then edit | `assembly.component.createAssembly` | planned | M4A | KOMPAS help: Создание компонента «на месте» |
| Создать локальную деталь | Сборка / Компоненты | button | `assembly.component.createLocalPart` | advanced | M7 | KOMPAS help: Создание компонента «на месте» |
| Добавить компонент из файла | Сборка / Компоненты | button/split family | `assembly.component.insert` | planned | M4A | KOMPAS help: Добавление компонента из файла |
| Заменить компоненты | Сборка / Компоненты | button + selection/result tools | `assembly.component.replace` | planned | M4A | `cm_instance_change_sources.html` |
| Совпадение | Сборка / Размещение компонентов | mate command | `assembly.mate.coincident` | planned | M4A | `cm_mate_coincident.html` |
| Включить фиксацию | Сборка / Размещение компонентов | context/toolbar command | `assembly.fix` | planned | M4A | KOMPAS help: Включение фиксации |
| Проверка геометрии | Твердотельное моделирование / Диагностика; Сборка / Диагностика | button | `part.check.geometry` / assembly diagnostic | planned | M4/M4A | `cm_check_geometry.html` |
| Проверка коллизий | Твердотельное моделирование/Сборка / Диагностика | button | `assembly.interference` | planned/advanced | M4A/M7 | `cm_measure_interference_volumes.html` |
| Проекционный вид | Черчение / Виды | button, requires support view | `drawing.view.projected` | planned | M6 | `cm_create_projection_view.html` |
| Шероховатость | Черчение / Обозначения | button + parameter panel | `drawing.annotation.roughness` | planned | M6 | `cm_rough.html` |

---

## Workspace audit checklist

The following sections are not considered complete until issue #16 closes.

### System/common
- [ ] File/New/Open/Save/Save As/Print/export variants
- [ ] Undo/Redo/rebuild
- [ ] search/command discovery
- [ ] selection/context controls
- [ ] settings/document parameters
- [ ] navigation/view/display modes

### Part / solid modeling
- [ ] sketch creation/reference selection
- [ ] additive/cut feature families
- [ ] complete Hole family
- [ ] fillet/chamfer/shell/rib/draft
- [ ] pattern/mirror families
- [ ] datum geometry
- [ ] bodies/multibody operations
- [ ] diagnostics/measurements

### Sketch
- [ ] geometry families and split-menu variants
- [ ] editing tools
- [ ] constraints
- [ ] dimensions and dimension variants
- [ ] projection/reference tools
- [ ] command completion/cancel behavior

### Assembly
- [ ] component insertion/creation/local components
- [ ] context editing
- [ ] replacement/update/source operations
- [ ] movement/fixation
- [ ] mates and advanced mates
- [ ] component arrays/mirror
- [ ] diagnostics/exploded/interference

### Drawing
- [ ] sheet/document controls
- [ ] 2D geometry
- [ ] views and associative view variants
- [ ] dimensions and grouped variants
- [ ] annotations/symbols
- [ ] layers/styles
- [ ] print/export

### Fragment
- [ ] shared 2D geometry
- [ ] dimensions/annotations
- [ ] insertion/reuse
- [ ] import/export

### Specification
- [ ] source/association commands
- [ ] section/row/editing commands
- [ ] positions/sort/group
- [ ] formatting/export

### Text document
- [ ] text formatting
- [ ] table/symbol insertion
- [ ] page/header/footer/frame controls
- [ ] document links
- [ ] print/export

### Advanced workspaces
- [ ] Wireframe/surfaces
- [ ] Sheet metal
- [ ] other KOMPAS v25 workspaces discovered during audit

## Completion rule

No workspace can be marked audited merely because ASA-CAD has enough commands for its current milestone. The inventory must explicitly classify every discovered relevant KOMPAS command as `core-now`, `planned`, `advanced` or `not-in-ASA-scope`.