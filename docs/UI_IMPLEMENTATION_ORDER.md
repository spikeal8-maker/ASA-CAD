# ASA-CAD UI implementation order

This file gives the practical order for building the permanent ASA UI without creating a large shell full of dead controls.

## Phase 0 — reference and contracts (M1/M1U)

Before permanent UI wiring:

- finish stable `CadApplication` command IDs for the protected Part workflow;
- validate command registry entries;
- populate M2 visual reference records;
- define registry-v2 order/collapse/mobile metadata;
- keep visible Toubkal UI only as a diagnostic/reference surface.

## Phase 1 — shell skeleton (M2)

Build ASA-owned reusable shell components:

1. AppFrame
2. MainMenu + QuickAccess
3. DocumentTabs
4. WorkspaceTabs
5. CommandGroup renderer
6. LeftDock / DocumentTree
7. WorkArea host
8. RightDock / ParameterPanel
9. StatusBar
10. CommandSearch
11. overflow and responsive layout engine
12. UI Scale tokens/settings

No CAD command is considered visually implemented merely because its button exists.

## Phase 2 — protected Part vertical slice (M2)

Wire only the commands needed for the protected Part workflow:

- New/Open/Save
- Undo/Redo/Rebuild
- standard views/Fit
- Create Sketch
- Line/Rectangle/Circle as required
- driving dimensions required by fixture
- Finish Sketch
- Extrude
- Cut Extrude
- Fillet

For each command complete:

`API -> params -> button -> active-command state -> preview -> confirm/cancel -> fixture -> browser test -> responsive test`.

## Phase 3 — interaction/responsive acceptance (M2I/M2A/M2R/M2V)

Before expanding command count:

- mouse/navigation/selection stable;
- shortcuts stable;
- HD/FHD/2K/4K/ultrawide layout stable;
- tablet/phone shell stable;
- visual reference baseline approved;
- command overflow works;
- browser zoom/DPI tests pass.

## Phase 4 — Sketch completion (M3)

Fill the already-defined Sketch groups without reworking the shell.

## Phase 5 — Part Design completion (M4)

Fill solid features/arrays/datum/measurements/diagnostics without reworking the shell.

## Phase 6 — Assembly (M4A)

Reuse the same shell and Part editor for contextual component editing. Add Assembly-specific groups/tree/mate parameter panels.

## Phase 7 — standalone beta (M4B)

Freeze first stable command/layout registry version and browser/device matrix.

## Phase 8 — ASA Lab integration (M5)

Integrate the same `asa-cad-web` release. Do not redesign the CAD shell during integration.

## Phase 9 — documentation workspaces (M6/M6A)

Add Drawing/Fragment 2D canvas and Specification/Text work areas into the already stable shell.

## Rule

Never solve lack of screen space by simply reducing all fonts/icons. Use command prioritization, grouping, overflow, drawers and layout mode changes first.