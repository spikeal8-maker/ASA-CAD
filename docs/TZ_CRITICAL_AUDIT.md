# ASA-CAD critical UI/UX specification audit

This document is the gap analysis of the ASA-CAD product specification. It prevents the project from being declared fully specified while layout, interaction, responsive or validation details remain implicit.

## Current verdict

The specification is now **sufficiently structured to proceed with M1 and then permanent M2 UI implementation without re-inventing the product architecture or responsive model**.

The previous blocking specification gaps have been converted into binding contracts and machine-readable registries. This does **not** mean the UI itself is implemented or visually accepted; it means the implementation target is now defined and testable.

## Resolved blocker map

### 1. Physical resolution vs effective UI size — RESOLVED IN SPEC

Binding contract: `docs/DISPLAY_LAYOUT_SPEC.md`.

Rules now include:

- use effective CSS viewport width + height for layout decisions;
- treat physical resolution/DPR/OS scale/browser zoom as regression metadata;
- support ASA UI Scale separately;
- never use a whole-app transform that breaks CAD pointer/picking coordinates;
- validate HD/FHD/2K/4K/ultrawide and representative HiDPI cases.

Implementation tracked by #18 M2R.

### 2. Width-only responsive breakpoints — RESOLVED IN SPEC

`DISPLAY_LAYOUT_SPEC.md` now defines both width and height classes, including compact-height behavior for 720/768px displays, top-chrome budgets and work-area protection.

### 3. Command list lacked deterministic composition — RESOLVED IN SPEC

`spec/ui/layout-registry.v2.json` now defines the first deterministic layout contract:

- workspace order;
- group order;
- command order;
- collapse priority;
- overflow behavior;
- mobile placement;
- management-panel behavior;
- shell composition.

`docs/UI_COMMAND_SPEC.md` remains the behavioral command contract.

### 4. No canonical KOMPAS visual reference manifest — RESOLVED FOR REFERENCE BASELINE

`spec/ui/visual-reference-manifest.v1.json` now binds official KOMPAS v25 help references to structural states including:

- management panels;
- graphical Quick Access;
- Part/Sketch/feature states;
- Assembly;
- Drawing;
- Specification/Text;
- advanced surface/sheet-metal workspaces.

Owner screenshots remain useful/required for exact visual tuning to a particular installed KOMPAS appearance, but the absence of such screenshots no longer blocks structural implementation.

Implementation-time visual acceptance remains tracked by #19 M2V.

### 5. Workspace/picking/navigation semantics were implicit — RESOLVED IN SPEC

`docs/WORKSPACE_INTERACTION_SPEC.md` defines:

- 3D/2D work areas;
- selection/preselection;
- typed picking;
- candidate selection;
- tree synchronization;
- orbit/pan/zoom;
- preview/phantom behavior;
- Sketch and Assembly interaction semantics.

### 6. Keyboard model missing — RESOLVED IN SPEC

`docs/SHORTCUTS_SPEC.md` defines centralized shortcuts, browser conflicts, focus rules and remapping requirements.

### 7. Phone/tablet model too vague — RESOLVED IN SPEC

`docs/MOBILE_RESPONSIVE_SPEC.md` defines:

- desktop/tablet/phone shell variants;
- touch gestures;
- Tree/Parameters/Tools drawers/sheets;
- touch target sizes;
- software keyboard/safe-area behavior;
- command-discovery parity;
- capability tiers;
- portrait/landscape persistence.

Implementation tracked by #17 M2I.

### 8. KOMPAS command inventory incomplete — BASELINE RESOLVED

`spec/ui/kompas-command-inventory.v25.json` now provides a maintained KOMPAS v25 baseline with **211 classified command/control rows** across:

- system/common;
- view/selection;
- Sketch;
- Part/solid modeling;
- Assembly;
- Drawing/Fragment;
- Specification/Text;
- Wireframe/Surfaces;
- Sheet Metal.

Advanced surface, sheet-metal, Boolean and mate families are explicitly retained rather than silently omitted.

The inventory is versioned/maintained: future KOMPAS versions or intentionally adopted application/plugin command sets may add rows without invalidating the current baseline.

### 9. Default shell drifted toward a generic web dashboard — RESOLVED IN SPEC

`docs/KOMPAS_SHELL_LAYOUT_SPEC.md` now defines the binding default desktop composition:

- Main Menu/search/system state;
- document tabs;
- instrument/workspace area;
- management-panel rail/block;
- large work area;
- graphical Quick Access Bar;
- status/diagnostics.

Idle Part/Assembly defaults to Tree; parameterized commands automatically show Parameters and restore the previous panel after command completion/cancel unless deliberately pinned otherwise.

## Acceptance architecture

M2 is deliberately split into coordinated tracks:

- **#3 M2** — permanent ASA shell + protected Part vertical slice;
- **#15 M2A** — deterministic fixtures/owner review loop;
- **#17 M2I** — workspace/mouse/keyboard/touch/mobile/hybrid input;
- **#18 M2R** — HD/FHD/2K/4K/DPI/zoom/UI Scale;
- **#19 M2V** — KOMPAS reference mapping and actual visual acceptance.

M2 cannot be called visually complete until applicable subtrack gates pass.

## What is deliberately not claimed as done

The audit closes specification gaps; it does not claim implementation that does not exist.

Still implementation work:

- protected ASA Part CI/browser flow (M0/M0D);
- `CadDocument` / `CadApplication` boundary (M1);
- permanent ASA UI (M2);
- deterministic visual fixtures and screenshots;
- browser/device regression;
- Part/Assembly/2D/document feature implementation;
- ASA Lab integration.

Also, exact pixel/spacing matching to the owner's local KOMPAS installation can only be finalized for a state after an owner screenshot/reference for that exact state is supplied or explicitly waived. Structural/behavioral reference mapping is already available from official help.

## Final audit conclusion

There are no remaining **known architecture-level UI specification blockers** preventing M1/M2 implementation.

Any new gap discovered during implementation must be added to this audit or the relevant binding contract rather than being solved ad hoc inside a React component.
