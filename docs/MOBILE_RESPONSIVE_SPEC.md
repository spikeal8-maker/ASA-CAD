# ASA-CAD mobile and responsive specification

This document defines how the same ASA-CAD product/document/runtime behaves on desktop, tablet and phone.

The mobile UI is not a separate simplified project format. Supported devices use the same `CadDocument`, command IDs and client-side computation model.

## 1. Product rule

Desktop is the reference layout for KOMPAS-oriented teaching parity.

Tablet and phone adapt the shell to smaller screens without creating a different CAD semantics layer.

```text
same CadDocument
same CadApplication commands
same local browser CAD runtime
same save/version model
     |
     +-- desktop shell
     +-- tablet shell
     `-- phone shell
```

Unsupported hardware may open read-only/safe mode, but ASA-CAD does not silently move geometry computation to the server.

## 2. Responsive classes

Initial CSS/layout targets:

- `desktop`: width >= 1200 px;
- `compact-desktop/tablet-landscape`: 900–1199 px;
- `tablet/large-phone-landscape`: 600–899 px;
- `phone`: < 600 px.

These are implementation defaults, not document-format boundaries. Device capability probe and actual available viewport size both matter.

## 3. Desktop reference

```text
┌──────────────────────────────────────────────────────────┐
│ Menu / quick access / document tabs                     │
├──────────────────────────────────────────────────────────┤
│ Workspace tabs + command groups                         │
├────────────┬──────────────────────────┬──────────────────┤
│ Tree       │ 3D/2D work area          │ Parameters       │
│            │                           │                  │
├────────────┴──────────────────────────┴──────────────────┤
│ Status / solve / save / rebuild                         │
└──────────────────────────────────────────────────────────┘
```

## 4. Tablet layout

Tablet keeps the main work area visible and moves secondary panels into collapsible docks/drawers.

Target:

```text
┌───────────────────────────────────────┐
│ compact top bar + document title      │
├───────────────────────────────────────┤
│ horizontally scrollable command groups│
├───────────────────────────────────────┤
│                                       │
│          3D / 2D work area            │
│                                       │
├───────────────────────────────────────┤
│ Tree | Parameters | Status drawers    │
└───────────────────────────────────────┘
```

A side drawer may be used in landscape when there is sufficient width.

## 5. Phone layout

Phone prioritizes the work area and current command.

Target portrait shell:

```text
┌─────────────────────────────┐
│ Back  Document  Save/More   │
├─────────────────────────────┤
│ context/workspace selector  │
├─────────────────────────────┤
│                             │
│      3D / 2D work area      │
│                             │
│                             │
├─────────────────────────────┤
│ active command / quick tools│
├─────────────────────────────┤
│ Tree | Params | Tools       │
└─────────────────────────────┘
```

Rules:

- no permanently open left/right desktop docks;
- Tree, Parameters and extended Tools open as bottom sheets/full-height drawers;
- active command parameters can occupy a resizable bottom sheet;
- primary confirm/cancel controls remain reachable with one thumb;
- command groups become a compact searchable palette/category sheet instead of squeezing desktop ribbon groups into tiny icons;
- touch targets are at least 44x44 CSS px; 48x48 is preferred for primary CAD controls;
- destructive actions are not placed adjacent to common confirm/navigation controls without separation/confirmation.

## 6. Touch gestures — 3D

Default touch interaction:

- tap — select candidate/object;
- tap empty area — clear ordinary selection when command state permits;
- one-finger drag on empty/non-editable area — orbit model;
- two-finger drag — pan;
- pinch — zoom;
- double tap selected/model area — focus/fit selection according to context;
- long press — context actions / candidate list when several selectable objects overlap;
- orientation widget tap — standard view/orientation action.

When an active tool needs one-finger geometry dragging, its command state takes precedence and navigation remains available with two fingers.

## 7. Touch gestures — Sketch/2D

Sketch/Drawing/Fragment require different gesture arbitration:

- tap — place/select point/object;
- one-finger drag while an edit/manipulation tool owns the pointer — move sketch point/object as solver allows;
- two-finger drag — pan canvas;
- pinch — zoom;
- long press — context menu/candidate list;
- a visible `Навигация` temporary mode may be provided if precise editing conflicts with gesture recognition;
- snapping/inference indicators must be large enough to read without relying on hover.

Mobile must never require mouse-hover to discover essential state. Hover-only desktop affordances need a tap/long-press equivalent.

## 8. Selection on touch devices

Because touch has no precise hover/preselection:

- selection tolerance is device-aware but must not select arbitrary nearby topology;
- ambiguous hits open a candidate chooser (`Грань`, `Ребро`, `Компонент`, etc.);
- selection filters are accessible from the active command sheet;
- selected objects receive persistent visible highlight;
- small edges/vertices may expose magnifier/precision pick assistance later;
- Assembly lets the user explicitly switch selection level between component and subshape where ambiguity is high.

## 9. Mobile parameter panel

Desktop right-side `ParameterPanel` becomes a bottom sheet on phone.

States:

- collapsed — shows active command name + validation/solve status + primary value;
- half — common fields and selection registrators;
- full — all sections/advanced parameters.

Persistent actions at sheet edge:

- `Создать` / `Применить`;
- `Отмена`;
- `Завершить` when command supports repeated creation.

Opening an on-screen keyboard for numeric/text entry must not cover the active field or primary action controls.

## 10. Mobile tree

The model/assembly/drawing tree opens as a drawer or full-height sheet.

It must support:

- expand/collapse;
- select/synchronize with viewport;
- context actions through visible overflow/long press;
- edit/rename/hide/suppress actions;
- search/filter later for large assemblies;
- clear active-item/rebuild-error indicators.

When the tree is open on a phone, the 3D viewport may remain partially visible in landscape or be temporarily obscured in portrait; document state is unchanged.

## 11. Command discovery on phone

Desktop ribbon groups are not reproduced literally at phone width.

Phone command access uses:

- compact current-workspace bar;
- bottom `Инструменты` sheet grouped using the same registry workspace/group metadata;
- command search;
- recently used/favorites later;
- context-aware filtering so impossible commands do not flood the list.

Labels and command IDs stay identical to desktop. Only presentation changes.

## 12. Phone/Tablet Drawing and documents

Drawing/Fragment:
- pinch zoom + two-finger pan;
- bottom-sheet dimensions/annotations;
- sheet navigator in a drawer;
- landscape encouraged for complex drafting but portrait remains navigable.

Specification/Text:
- standard responsive table/page editing patterns;
- horizontal table scrolling where unavoidable;
- sticky row/section controls;
- software keyboard-safe forms;
- no OpenCascade runtime should load merely for a standalone Text/Specification document unless linked 3D preview is opened.

## 13. Performance/capability tiers

Capability is measured, not inferred only from screen width.

### Full
- editing enabled;
- normal tessellation/visual quality;
- Part/Assembly operations within supported complexity.

### Constrained
- same document/commands;
- reduced tessellation/display quality;
- conservative model/assembly complexity thresholds;
- explicit warning before operations likely to exceed memory/time budgets.

### Read-only/safe
- document metadata/tree and cached preview where available;
- no silent server compute fallback;
- clear explanation that device/browser cannot safely initialize required local runtime.

## 14. Orientation and device changes

- portrait/landscape transition preserves active document/command/selection;
- panels reflow rather than restarting the runtime;
- WASM kernel is not reinitialized merely due to orientation change;
- viewport resizes without recomputing B-Rep geometry;
- unsaved command state is protected during browser resize/virtual keyboard changes.

## 15. Accessibility/usability

- touch targets >=44 CSS px;
- text does not rely on hover tooltips only;
- active/disabled states remain visually distinguishable;
- screen-reader labels for shell controls where practical;
- gesture-only action must also have a visible command path when important;
- high precision operations can use numeric entry instead of requiring exact finger placement.

## 16. Implementation order

### M2
- responsive shell foundations;
- desktop/tablet/phone AppFrame variants;
- phone command/tool drawer;
- mobile Tree/ParameterPanel sheets;
- base 3D orbit/pan/zoom/select gestures;
- protected Part shell reachable on phone.

### M2A
- deterministic responsive fixtures at representative widths;
- portrait/landscape visual regression;
- touch browser E2E for navigation/selection/basic command lifecycle.

### M3/M4
- every Sketch/Part command added must receive a usable phone/tablet control path, even when desktop remains reference for teaching.

### M4A
- Assembly mobile component/mate interaction and ambiguous-selection UI.

### M4B
- real-device/capability matrix and memory/performance acceptance before standalone beta.

### M5
- verify identical responsive shell under ASA Lab `/cad/*` host/session.

### M6/M6A
- Drawing/Fragment/Specification/Text responsive work areas.

## 17. Acceptance

A phone-capable release is accepted only when a supported phone can:

1. open the same native Part document as desktop;
2. initialize CAD computation locally;
3. orbit/pan/zoom and select reliably;
4. open Tree and ParameterPanel without losing document state;
5. execute the implemented protected/basic commands through touch UI;
6. save and reopen through the same host contract;
7. rotate between portrait/landscape without document corruption;
8. fail explicitly into safe/read-only mode on unsupported hardware rather than switching to server geometry computation.