# UI_CORE_U1A_MAPPING

Статус: **CANONICAL U1A IMPLEMENTATION MAP**.
Источник UI: tag `ui-reference-20261004` -> `88c535c652dac8b04f0d68fa144cf8486afdc926`.
Target branch after preflight: `integration/ui-core-unification`.

## 1. Граница U1A

U1A переносит только верхнюю оболочку и её композицию:

- главное меню;
- вкладку документа;
- selector инструментальных областей;
- ribbon/group composition;
- поиск и global actions;
- shell spacing/geometry для desktop.

U1A **не включает**:

- дерево/Parameters/Status — это U1B;
- viewport/XY/XZ/YZ/selection — это U1C;
- Sketch geometry;
- constraints/dimensions;
- persistence model;
- solver;
- OpenCascade feature work;
- prototype `doc/history/sketcher`;
- dark-theme implementation.

### Theme contract

Frozen #170 имеет light + dark. Product runtime сейчас честно light-only (`color-scheme: light`). Поэтому U1A visual acceptance выполняется **только в light theme**.

Dark-theme parity = **DEFERRED_NOT_U1A**. В U1A запрещено имитировать её отдельной CSS-перекраской без настоящей product theme model. Frozen dark state сохраняется в visual evidence и должен быть реализован до заявления overall visual parity, отдельным последующим UI-parity решением.

## 2. Mapping: reference -> product owner

| Reference area №170 | Product owner | Настоящий state/action owner | Решение U1A | Acceptance |
|---|---|---|---|---|
| Главное меню / File entry | `src/web/CadShellTop.tsx` + `CadFileMenu.tsx` | `CadUiAction` / `getAction()` | ADAPT visual/layout only | File actions продолжают вызывать typed actions |
| Бренд / application menu geometry | `CadShellTop.tsx` | existing new-document action | PORT presentation | Нет отдельного prototype handler |
| Вкладка документа | `CadShellTop.tsx` | real `documentKind/documentTitle/dirty` | PORT visual hierarchy | Название/dirty берутся только из product document state |
| Твердотельное моделирование / Каркас и поверхности / Инструменты эскиза | `CadShellTop.tsx` | `activeWorkspace` | ADAPT | Одно workspace state, без duplicate store |
| Ribbon groups | `CadShellCommandGroups.tsx` | command registry + `CadUiAction` | RECOMPOSE | Ни одна кнопка не получает второй handler |
| Planned/reference groups | `CadShellReferenceGroups.tsx` | registry visibility contract | KEEP/RESTYLE | planned/deferred не выдаются за подключённые |
| Поиск команд | `CadShellTop.tsx` + `CadUiActionControls` | searchable typed actions | RESTYLE ONLY | Поиск остаётся на одном action model |
| Open/Save/Undo/Redo | `CadShellTop.tsx` | existing system actions | RESTYLE ONLY | Нет local prototype history |
| Верхняя геометрия shell | `src/web/styles/top-shell.css` | CSS only | ADAPT | 1600x900 + 1366x768 evidence |
| Ribbon geometry | `src/web/styles/ribbon.css` | CSS only | ADAPT | группы не режутся и не перекрывают work area |
| Responsive shell behavior | `src/web/styles/shell-responsive.css` | CSS only | ADAPT NARROWLY | desktop reference не ломает tablet/phone |

## 3. Frozen / pressured owners

### U1A: запрещено добавлять новую ответственность

- `src/web/App.tsx` — frozen; новая shell-разметка здесь запрещена.
- `src/web/CadViewport.tsx` — frozen; **U1A не трогает**.
- `src/web/ParameterPanel.tsx` — frozen; **U1A не трогает**.
- `src/web/responsive.css` — legacy/pressured; U1A не должен его увеличивать.

Если минимальная wiring-правка в `App.tsx` неизбежна:
- net byte growth = 0;
- новая ответственность вынесена в узкий owner;
- отдельное architecture-review evidence обязательно.

Предпочтительные owners U1A:
- `CadShellTop.tsx`;
- `CadFileMenu.tsx`;
- `CadShellCommandGroups.tsx` — только пока не превышен pressure ceiling;
- `CadShellReferenceGroups.tsx`;
- `styles/top-shell.css`;
- `styles/ribbon.css`;
- `styles/shell-responsive.css`.

### CadShellCommandGroups pressure gate

На момент контракта файл = **8350 bytes**. UI target = 10240 bytes. Policy pressure = 85%, то есть **8704 bytes**.

Если U1A требует роста `CadShellCommandGroups.tsx` выше 8704 bytes, запрещено продолжать добавлять группы в этот owner. Сначала обязательный extraction в узкий компонент. Возможные направления: `CadPartSolidGroups.tsx`, `CadSurfaceGroups.tsx`, `CadSketchGroups.tsx`, `CadViewGroups.tsx` — выбирать только реально необходимое, не создавать все заранее.

Machine-test контролирует ceiling 8704 bytes.

## 4. Visual evidence contract

U1A visual evidence сравнивает **не старый V6B baseline**, а:

```text
frozen reference:
ui-reference-20261004 / 88c535c...
        vs
candidate:
exact PR HEAD targeting integration/ui-core-unification
```

Workflow:
`.github/workflows/ui-core-u1-visual.yml`

Capture states:
- light / 1600x900 / solid toolset;
- light / 1600x900 / surfaces toolset;
- light / 1366x768 / solid toolset;
- dark / 1600x900 / solid toolset — **reference-only**, для сохранения deferred parity target.

Geometry сравнивается только по эквивалентным semantic regions:

| Semantic region | Frozen #170 | Product candidate |
|---|---|---|
| topShell | `.main-menu-bar` | `.main-menu-bar` |
| menuItems | `#menu` | `.main-menu-items` |
| commandSearch | `#searchWrap` | `.command-search-wrap` |
| documentTabs | `.document-tabs` | `.document-tabs` |
| activeDocumentTab | `#docTab` | `.document-tab.active` |
| instrumentArea | `.instrument-area` | `.instrument-area` |
| toolsets | `#toolsets` | `.workspace-tabs` |
| ribbon | `#ribbon` | `.command-ribbon` |
| contentArea | `#content` | `.content-area` |

`#menu` больше не сравнивается с полной `.main-menu-bar`. Prototype `.title-tools` также не считается эквивалентом product `.global-actions`, потому что наборы действий различаются.

Artifact должен содержать:
- reference screenshots;
- candidate screenshots;
- reference SHA/tag;
- candidate SHA;
- DOM region geometry;
- browser version;
- explicit `OWNER_ACCEPTANCE_REQUIRED`.

Автоматическая capture-проверка **не заявляет pixel parity**. Owner visual acceptance остаётся отдельным решением.

## 5. U1A acceptance

U1A считается checkpoint-complete только если:

1. ordinary product route открывает Part без fixture-only обхода;
2. верхняя оболочка визуально соответствует frozen reference в согласованных состояниях;
3. document tab использует real document title/dirty;
4. workspace selector использует единый product UI state;
5. ribbon использует existing typed actions/registry;
6. Open/Save/Undo/Redo не получают prototype-local history;
7. App/CadViewport/ParameterPanel не получают новую ответственность;
8. visual evidence artifact создан для exact HEAD;
9. focused shell/browser regression PASS;
10. owner принимает внешний вид.

`U1A_MERGED_TO_INTEGRATION` не означает `U1_ACCEPTED`.

U1 принимает владелец только после U1A + U1B + U1C и общего ordinary-route review.
