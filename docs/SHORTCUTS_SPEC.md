# ASA-CAD keyboard and shortcuts specification

This document defines the keyboard interaction contract for desktop/laptop use and the rules for remappable shortcuts.

The goal is a KOMPAS-oriented workflow while respecting browser constraints.

## 1. General rules

- Every shortcut maps to a stable ASA command ID; React components must not own ad-hoc key handlers for engineering commands.
- Shortcuts are resolved by a central `ShortcutRegistry` using current document kind, workspace, active command and text-input focus.
- Text fields, numeric fields and the Text document editor retain normal typing/editing behavior unless a shortcut is explicitly safe there.
- Browser-critical combinations such as `Ctrl+R`, `Ctrl+L`, `Ctrl+T`, `Ctrl+W`, `Alt+Left/Right` are not repurposed.
- User shortcut remapping is a target feature. KOMPAS-like defaults are preferred where they do not create unacceptable browser conflicts.
- Tooltips/menu entries show the assigned shortcut.

## 2. Initial default shortcuts

| Shortcut | ASA command / behavior | Stage |
|---|---|---|
| `Ctrl+S` | Save current native document | M2 |
| `Ctrl+Z` | Undo | M2 |
| `Ctrl+Y` | Redo where platform/browser permits | M2 |
| `Ctrl+Shift+Z` | Alternate Redo | M2 |
| `Esc` | Cancel current selection/substep; repeated Esc exits current command when applicable; otherwise clear selection | M2 |
| `Delete` | Delete selected supported object(s), with confirmation where destructive semantics require it | M2/M3+ |
| `Ctrl+Enter` | Commit/Create/Apply current operation when a valid preview/result exists | M2 |
| `F5` | Rebuild active Part/Assembly/Drawing when editor owns keyboard focus | M2 |
| `Ctrl++` / `Ctrl+=` | Zoom in | M2 |
| `Ctrl+-` | Zoom out | M2 |
| Arrow keys | Pan work area in screen direction when not editing text/value | M2 |
| `F` | Fit / focus selected or Fit All according to selection state | M2 |
| `0` | Isometric view | M2 candidate; configurable |
| `1` | Front view | M2 candidate; configurable |
| `2` | Top view | M2 candidate; configurable |
| `3` | Left view | M2 candidate; configurable |
| `Space` | Temporary navigation/orientation helper only if it does not conflict with active editor; final binding validated in M2 | M2 audit |

`F5` mirrors the KOMPAS rebuild mental model, but ASA-CAD must intercept it only while the CAD editor owns focus. The product must still provide a visible Rebuild button because browser/OS environments may reserve keys differently.

## 3. Selection modifiers

Desktop pointer modifiers:

- `Ctrl` + click — add/toggle compatible object selection;
- `Shift` + click — add/toggle compatible selection according to active selection mode;
- selection rectangle left-to-right — enclosing selection;
- selection rectangle right-to-left — crossing selection;
- `Esc` — clear current selection or cancel current selection substep.

Exact multi-selection semantics must remain consistent between viewport, sketch canvas and tree.

## 4. Command lifecycle keys

A command may have several nested selection/parameter steps. Keyboard behavior is stateful:

1. `Esc` first cancels the active pick/subprocess or preview;
2. another `Esc` exits the active command if nothing deeper remains;
3. `Ctrl+Enter` commits when validation passes;
4. `Enter` commits the currently focused numeric/text field and moves to the next logical field/step where appropriate;
5. `Tab` / `Shift+Tab` moves between parameter controls without changing geometry;
6. arrow keys inside numeric inputs edit/nudge values according to control semantics rather than panning the viewport.

## 5. Sketch keyboard behavior

Initial sketch-specific targets:

- `Esc` — end current repeated entity creation step, then exit tool on repeated press;
- `Delete` — delete selected sketch entities/constraints/dimensions;
- `Enter` — accept edited dimension/value;
- `Ctrl`/`Shift` — selection modifiers;
- temporary snapping overrides may be added only after the snap system is defined and documented;
- direct single-key aliases for Line/Circle/Rectangle are optional M3 productivity features and must be visible/remappable rather than hidden magic.

## 6. Assembly keyboard behavior

- `Delete` — remove selected occurrence/mate with appropriate confirmation and dependency diagnostics;
- `Esc` — cancel current mate/placement step;
- `Ctrl+Enter` — commit mate/placement when solved/valid;
- standard navigation shortcuts remain active while no text/numeric field owns focus;
- future nudge/move shortcuts must not bypass mate solving.

## 7. Drawing/Fragment keyboard behavior

- common save/undo/redo/delete/cancel/commit mappings remain consistent;
- arrow keys pan only when no 2D text/table/input editor owns focus;
- 2D drafting command aliases are added in M6 after the shared 2D command registry is stable;
- copy/paste shortcuts may operate on supported 2D objects only after stable serialization/clipboard rules exist.

## 8. Text/Specification focus rules

When focus is inside text/table editing:

- normal `Ctrl+C/X/V/A`, arrows, Home/End, Delete/Backspace, Enter and Tab behave as editor controls;
- global CAD shortcuts must not steal them;
- `Ctrl+S` remains document Save;
- `Esc` closes transient dialogs/menus before affecting the document command state.

## 9. Shortcut settings UI

Target settings page:

`Настройки -> Клавиатура`

Features:

- searchable command list;
- current shortcut(s);
- assign/change/remove shortcut;
- collision detection;
- reset one command;
- reset all to ASA defaults;
- optional preset `КОМПАС-подобная`;
- import/export user shortcut profile later;
- keyboard layout-independent storage based on physical/logical key policy defined during implementation.

A user setting changes only invocation; stable ASA command IDs do not change.

## 10. Browser conflict policy

ASA-CAD is a browser application, therefore exact desktop-CAD shortcuts are not blindly copied.

Do not override:

- browser address/tab/window navigation shortcuts;
- OS-level reserved combinations;
- accessibility/browser zoom shortcuts unless behavior is deliberately scoped to focused CAD work area and tested.

Potential conflicts must be listed in the command inventory and receive an ASA-specific alternative.

## 11. Implementation order

### M1
- stable command IDs support shortcut binding metadata.

### M2
- central ShortcutRegistry;
- Save/Undo/Redo/Esc/Delete/Ctrl+Enter/F5;
- navigation basics;
- shortcut hints in UI/tooltips.

### M2A
- keyboard E2E fixtures;
- focus/input conflict tests;
- browser conflict regression.

### M3/M4/M4A
- workspace-specific sketch/Part/Assembly bindings.

### M6/M6A
- Drawing/Fragment/Specification/Text bindings.

### M7
- user remapping UI and KOMPAS-like preset refinement.

## 12. Acceptance

No engineering shortcut is considered implemented until:

- it maps to a stable ASA command or documented interaction state;
- it behaves correctly with/without text-input focus;
- it is shown in tooltip/menu/help where relevant;
- it has browser E2E coverage;
- browser/OS conflicts have been intentionally resolved.