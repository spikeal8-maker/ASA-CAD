# ASA-CAD KOMPAS-oriented shell layout specification

This document is the binding **default desktop composition** for the ASA shell. It refines generic `AppFrame` diagrams in older documents when exact placement matters.

## 1. Reference principle

The target is not a generic web dashboard with a ribbon placed above three permanent columns.

The default desktop composition follows the KOMPAS-3D v25 mental model:

- main menu/search/system controls at the top;
- document tab strip;
- instrument/workspace area with command groups;
- a large graphical/work area;
- a management-panel rail/block (Tree, Parameters, Variables, Layers and other document-specific panels);
- a contextual quick-access bar attached to the graphical area;
- status/diagnostic feedback;
- context menus/context panels.

ASA may adapt details for browser/responsive use, but deliberate deviations must be recorded in the visual reference manifest.

## 2. Desktop default structure

```text
┌──────────────────────────────────────────────────────────────┐
│ Main menu / Search / global application state               │
├──────────────────────────────────────────────────────────────┤
│ Document tabs                                                │
├──────────────────────────────────────────────────────────────┤
│ Workspace / Instrument area + command groups                │
├────┬─────────────────────────────────────────────────────────┤
│ P  │  Management panel     │                                │
│ a  │  Tree / Parameters /  │   Graphical / work area       │
│ n  │  Variables / Layers   │                                │
│ e  │                       │  [Viewport Quick Access]       │
│ l  │                       │                                │
│    │                       │                                │
├────┴───────────────────────┴────────────────────────────────┤
│ Status / selection / solve / rebuild / save feedback        │
└──────────────────────────────────────────────────────────────┘
```

`Panel rail` is a narrow vertical switcher. The active management panel is adjacent to it.

## 3. Management panel model

Default panel buttons depend on document kind.

### Part / Assembly
Initial rail:
- `Параметры`;
- `Дерево`;
- `Переменные` when implemented;
- document-specific panels later.

### Drawing / Fragment
Initial rail:
- `Параметры`;
- `Дерево`;
- `Слои`;
- additional document panels later.

### Specification
- document/tree/sections;
- parameters/properties as needed.

### Text
- document structure/tree;
- formatting/properties as needed.

Rules:

1. `Дерево` is the normal/default management panel for an idle Part/Assembly.
2. Starting a command that requires engineering parameters automatically opens `Параметры`.
3. When the command finishes/cancels, the previous management panel is restored unless the user explicitly pinned another layout.
4. Only one panel from the default panel block is shown at a time in the baseline KOMPAS-like layout.
5. Later, advanced docking may allow multiple blocks/panels simultaneously; this is optional, not required for first M2 release.
6. A panel may be collapsed completely to maximize work area.
7. Panel width is resizable and follows `DISPLAY_LAYOUT_SPEC.md` min/default/max rules.
8. On compact-height/small-width desktop the panel may overlay rather than permanently consume the work area.

This replaces the assumption that Tree must always be permanently open on the left while Parameters is always permanently open on the right.

## 4. Viewport Quick Access Bar

ASA has a distinct `ViewportQuickAccessBar` attached to the upper edge of the graphical/work area.

It is **not the same thing** as the application Main Menu or instrument/workspace command groups.

Initial responsibilities:
- viewport/navigation actions appropriate to current document;
- context-dependent confirmation/finish controls during active operations;
- other high-frequency context actions admitted by KOMPAS reference audit.

Rules:

- horizontal;
- positioned inside/at the top edge of the graphical work area;
- does not permanently consume a full additional global header row;
- contents change by document/command context;
- `Создать/Применить`, `Отмена`, `Завершить` may also be mirrored in ParameterPanel where required for touch/accessibility, but desktop KOMPAS-oriented flow exposes the quick-access/context action area clearly;
- no important command exists only as an unlabeled mystery icon without tooltip/search path.

## 5. Instrument/workspace area

The top engineering command area contains document/workspace-specific command groups, not global project/storage navigation mixed arbitrarily with modeling commands.

Examples:

Part:
- Твердотельное моделирование;
- contextual Эскиз;
- Каркас и поверхности later;
- Проверка/Измерения;
- Вид.

Assembly:
- Сборка;
- contextual Редактирование компонента;
- Проверка/Измерения;
- Вид.

Drawing:
- Черчение;
- Виды;
- Размеры;
- Обозначения;
- Листы/Оформление;
- Вид.

Exact group/command order is registry-v2 data, not hardcoded independently by components.

## 6. Full-screen/maximize-work-area mode

ASA-CAD must support a workspace-maximize mode that hides/collapses nonessential panels/chrome while keeping a path back to commands.

Target behavior:
- collapse management panel;
- collapse instrument area where supported;
- retain minimum document/global access and a compact way to restore panels/commands;
- preserve active command/document/runtime state;
- no B-Rep recompute merely because UI chrome was hidden.

Shortcut is selected during shortcut audit; do not steal browser-reserved keys.

## 7. Large-display behavior

On 2K/4K/ultrawide:
- management panel does not grow indefinitely;
- instrument groups stay content-sized/bounded;
- graphical area receives most additional space;
- optional second panel block is a later user preference, not automatic clutter;
- UI Scale may increase chrome/text independently from geometry units.

## 8. Small desktop behavior

On 1280x720 / 1366x768:
- panel rail remains reachable;
- active management panel clamps toward minimum width or overlays;
- low-priority command groups collapse/overflow;
- ViewportQuickAccessBar remains usable;
- top chrome compacts by height rules;
- text is not shrunk below readability floor.

## 9. Tablet/phone derivation

The desktop panel model maps to:
- Tree/Parameters/Tools bottom sheets or drawers;
- compact command workspace selector;
- active-command sheet;
- quick-access/confirm actions reachable by touch.

Phone does not preserve the exact desktop physical placement; it preserves the same command/panel semantics.

## 10. KOMPAS-specific settings to track

KOMPAS v25 exposes interface settings such as theme, highlight color, size of icons/text, icon style, language, keyboard configuration, remembering the last command in a group, and tab-opening position.

ASA mapping:
- Theme -> M2/M7 setting;
- Highlight/selection theme -> M2/M7 tokens;
- Icon/text size -> ASA UI Scale in M2R;
- Keyboard -> `SHORTCUTS_SPEC.md`;
- Remember last group command -> registry/group behavior, M7 unless needed earlier;
- New tab position -> document-tab setting, M7 unless owner requests earlier.

## 11. Acceptance

Default desktop shell is not accepted until:
- visual references confirm Main Menu / document tabs / instrument area / management panels / graphical quick-access relationship;
- active command automatically exposes Parameters;
- idle Part/Assembly restores Tree by default;
- panel collapse/maximize increases work area without losing state;
- graphical quick-access is visually tied to the work area;
- compact and 4K layouts preserve the same hierarchy;
- deliberate differences from KOMPAS are recorded.
