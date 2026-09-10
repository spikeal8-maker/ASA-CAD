# ASA-CAD workspace and interaction specification

This document is the binding contract for the central working surface used to inspect, select, sketch, model, assemble and draft engineering documents.

It complements `docs/UI_COMMAND_SPEC.md`: buttons start commands; this document defines what happens in the working area once a command is active.

## 1. Work-area kinds

The shell hosts one of four work-area families depending on document kind:

- `ModelViewport3D` — Part and Assembly;
- `DraftCanvas2D` — Drawing and Fragment;
- `SpecificationGrid` — Specification;
- `TextPageEditor` — Text document.

The work area is an ASA-owned product surface. Vendor viewport implementation may be reused behind adapters, but product interaction semantics belong to ASA-CAD.

## 2. 3D model viewport

The Part/Assembly viewport contains:

- rendered model/body/component geometry;
- origin triad and datum geometry;
- optional grid/reference plane;
- preselection highlight;
- selection highlight;
- active-command preview/phantom geometry;
- orientation control;
- contextual quick-access controls;
- command prompts and diagnostics;
- optional transform manipulator for Assembly/component/body operations;
- optional temporary section/measurement graphics.

The viewport must consume derived tessellation/runtime state. It is not the authoritative document store.

## 3. Desktop mouse interaction

Reference desktop behavior is intentionally close to KOMPAS conventions where practical:

- left click — select/pick object;
- `Ctrl` or `Shift` + left click — add/toggle compatible objects in selection;
- drag left-to-right on empty area — enclosing selection rectangle;
- drag right-to-left on empty area — crossing selection rectangle;
- mouse wheel — zoom around cursor/focus point;
- press/drag middle mouse button/wheel — pan;
- press/drag right mouse button in 3D — orbit model;
- click empty area or `Esc` — clear ordinary selection / cancel current selection step according to command state;
- double click tree/object — edit/open default object action when safe;
- context menu/right-click without drag — contextual commands when not interpreted as orbit gesture.

Orbit-versus-context-menu behavior must use a movement threshold so a stationary right click opens the context menu while a drag rotates the model.

## 4. Selection model

Selection is typed and command-aware.

Selectable 3D categories include:

- body;
- component occurrence;
- face;
- edge;
- vertex;
- sketch;
- sketch entity;
- datum plane/axis/point;
- feature/tree node;
- mate/reference object where applicable.

Rules:

1. Hover/preselection must identify the candidate before selection on pointer devices.
2. The active command supplies an allowed-selection filter.
3. Invalid candidates do not become silently accepted.
4. When multiple objects overlap under the cursor, ASA-CAD provides a candidate-cycle/list mechanism rather than selecting an arbitrary hidden object.
5. Selection in tree and viewport stays synchronized.
6. Hidden/suppressed objects follow explicit selection rules and are not accidentally picked.
7. Stable logical object IDs, not Three.js mesh indices, are returned to product commands.

## 5. Navigation/orientation

Required commands/state:

- Fit / `Показать всё`;
- front/back/top/bottom/left/right;
- isometric orientation;
- orthographic/perspective switch where supported;
- shaded / shaded-with-edges / wireframe-hidden-line modes as implemented;
- center/focus on selection;
- previous/next view later if useful;
- orientation widget/control;
- named view state later.

Arrow-key panning and keyboard zoom/rotation mappings are defined in `docs/SHORTCUTS_SPEC.md`.

## 6. Sketch workspace behavior

Sketch mode uses the same viewport host but changes interaction semantics:

- camera aligns normal to sketch plane by default;
- grid/origin/axes become sketch references;
- snapping and inference are visible;
- active entity creation follows pointer position;
- dimensions/constraints are selectable/editable;
- under-/fully-constrained state is visible;
- geometry may be dragged only when the solver permits it;
- projected/reference geometry is visually distinct;
- `Esc` steps out of current creation/selection state before leaving Sketch mode;
- `Завершить эскиз` is explicit and prominent.

## 7. Assembly workspace behavior

Assembly mode adds:

- component occurrence selection;
- mate-reference selection;
- component transform/manipulator;
- fixed/suppressed/hidden visual states;
- active-component emphasis during in-context editing;
- surrounding components visible/read-only during contextual Part editing;
- mate solve/conflict feedback;
- explicit selection level when choosing component versus subshape.

Moving a component must never mutate its Part geometry. It changes occurrence placement only.

## 8. Command preview and parameter feedback

Operations that can be previewed safely show a transient phantom/result before commit.

Examples:

- extrusion/cut;
- revolve;
- fillet/chamfer;
- hole;
- component move/rotate;
- mate orientation;
- drawing projected view placement.

Preview geometry is disposable runtime state. It is not written to `CadDocument` until the command is committed.

## 9. 2D Drawing/Fragment work area

Required behavior:

- infinite/large drafting canvas for Fragment;
- sheet/page bounds for Drawing;
- pan/zoom;
- object snap/inference;
- enclosing/crossing selection;
- layers and visibility;
- 2D geometry creation/editing;
- dimensions/annotations;
- sheet/view boundaries and associative-view selection in Drawing;
- vector-quality rendering at any zoom.

Drawing and Fragment share the same 2D interaction engine where semantics overlap.

## 10. Visual states

The work area must have centralized design tokens for:

- background;
- grid;
- axes/origin;
- preselection;
- primary selection;
- secondary/multi-selection;
- active command input;
- preview/phantom;
- error/broken reference;
- suppressed/hidden state;
- sketch under-constrained / fully constrained / conflicting;
- active Assembly component / contextual reference;
- dimension/annotation colors.

Feature code must not hard-code these colors independently.

## 11. Performance rules

- camera navigation must not trigger full CAD recompute;
- selection uses already-built picking structures;
- large models may reduce rendering/tessellation quality without changing authoritative geometry;
- pointer interaction should remain responsive while heavy recompute runs;
- long recompute shows explicit busy/progress state and may move to worker execution when runtime architecture supports it;
- renderer/resource cleanup is mandatory when closing documents or switching heavy fixtures.

## 12. Persistence boundary

Engineering intent is saved in `CadDocument`.

Optional session/view state may include:

- camera/orientation;
- selected display mode;
- panel sizes;
- active sheet/view;
- grid visibility.

Transient selection, hover and preview state are not authoritative project geometry.

## 13. Implementation order

### M2
- permanent 3D viewport host;
- selection/preselection;
- orbit/pan/zoom;
- Fit + standard views;
- origin/axes/grid basics;
- protected Part workflow interaction;
- centralized selection/view state.

### M2A
- deterministic viewport fixtures;
- interaction E2E and visual regressions.

### M3
- complete Sketch pointer/snapping/constraint interaction.

### M4
- advanced Part selection, measurement, section/display tools and stable subshape reference diagnostics.

### M4A
- Assembly occurrence manipulation, mate picking, contextual Part-edit viewport states.

### M6
- shared Drawing/Fragment 2D canvas and drafting interaction.

## 14. Acceptance

The workspace contract is accepted when the same ASA-owned interaction layer can drive deterministic test fixtures without direct UI dependency on vendor stores/events, and selection/navigation/preview behavior is covered by real-browser tests.