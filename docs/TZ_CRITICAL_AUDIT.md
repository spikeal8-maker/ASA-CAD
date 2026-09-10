# ASA-CAD critical UI/UX specification audit

This document is a gap analysis of the current ASA-CAD product specification. It exists to prevent the project from being declared "fully specified" while important layout, interaction, responsive or validation details are still implicit.

## Audit verdict

The architecture, document family, command naming, local-compute rule, Docker model and first command registry are strong enough to proceed with M1.

The specification was **not yet complete enough to start broad permanent M2 UI implementation safely** because several visual/layout contracts were underspecified.

The blocking gaps identified by this audit are addressed by new/updated contracts:

- `docs/DISPLAY_LAYOUT_SPEC.md` — effective-resolution, DPI, zoom, typography, panel geometry and collapse rules;
- `docs/VISUAL_REFERENCE_SPEC.md` — how KOMPAS visual references are captured and mapped to ASA components;
- `spec/ui/viewport-matrix.v1.json` — machine-readable viewport/DPI/zoom regression matrix;
- `docs/WORKSPACE_INTERACTION_SPEC.md` — central work-area behavior;
- `docs/SHORTCUTS_SPEC.md` — centralized keyboard model;
- `docs/MOBILE_RESPONSIVE_SPEC.md` — touch/mobile/tablet behavior;
- `docs/UI_COMMAND_SPEC.md` — command/button/group contract;
- `docs/KOMPAS_UI_INVENTORY.md` — traceable KOMPAS v25 functional inventory.

## Severity summary

### BLOCKER 1 — physical resolution was being confused with effective UI size

A raw screen resolution such as 3840x2160 is not enough to decide control/font size. A 4K display at 200% OS scaling often exposes roughly Full-HD-sized effective browser coordinates, while 4K at 100% exposes much more effective workspace.

Required fix:

- responsive decisions use **CSS/effective viewport width and height**, not physical pixel count;
- `devicePixelRatio`, OS/browser scaling and zoom are test variables, not layout breakpoints by themselves;
- ASA provides a separate chrome/UI scale setting;
- 3D/2D canvas coordinate systems must not be scaled by a blunt whole-page CSS transform that breaks picking.

Status: addressed in `DISPLAY_LAYOUT_SPEC.md`; implementation pending M2/M2R.

### BLOCKER 2 — width-only breakpoints were insufficient

The previous responsive rules mostly classified by width. CAD also loses usability when viewport height is small because document tabs, workspace/ribbon, parameter panel and status bar consume vertical space.

Required fix:

- width **and height** classes;
- explicit compact-height behavior;
- top-chrome height budgets;
- minimum central work-area budget;
- overflow/collapse rules before clipping occurs.

Status: addressed in `DISPLAY_LAYOUT_SPEC.md`; implementation pending.

### BLOCKER 3 — command list did not fully define toolbar composition

`UI_COMMAND_SPEC.md` defined labels/groups/controls but did not sufficiently fix:

- order of workspaces/groups;
- group collapse priority;
- label/icon presentation at compact widths;
- split-button/dropdown overflow behavior;
- what moves to `Еще`/overflow first;
- minimum/maximum group/control dimensions;
- how a command remains discoverable after its visible group collapses.

Without these rules two implementations could both satisfy the command list while looking structurally different.

Status: layout rules now belong to `DISPLAY_LAYOUT_SPEC.md`; registry v2 must add explicit visual priority/order metadata before M2 is considered frozen.

### BLOCKER 4 — no canonical visual reference manifest

The project says "KOMPAS-oriented" but did not define exactly which screenshot/state is authoritative for each shell/workspace.

Required fix:

Every visual reference used for implementation must record:

- reference ID;
- KOMPAS version;
- document/workspace/active command;
- source (official help URL or owner-provided reference);
- source viewport/resolution/scale if known;
- ASA component(s) being compared;
- layout facts copied conceptually;
- deliberate differences;
- validation screenshot/fixture.

We reproduce layout/workflow; proprietary icons/artwork are not imported.

Status: contract added in `VISUAL_REFERENCE_SPEC.md`; reference corpus must be populated during M1U/M2.

### HIGH 5 — typography and density had no binding minimums

The previous spec had design-token intent but no exact readability floor.

Required fix:

- base desktop UI text target 14 CSS px at UI scale 100%;
- dense secondary metadata may go to 12.5–13 CSS px but not below 12 CSS px in normal production UI;
- numeric/parameter inputs at least 14 CSS px desktop, at least 16 CSS px for phone text/numeric editing to avoid tiny touch editing and mobile browser zoom behavior;
- clear line-height and control-height tokens;
- UI scale options and accessibility/browser zoom tests.

Status: addressed in `DISPLAY_LAYOUT_SPEC.md`.

### HIGH 6 — panel geometry and viewport priority were underdefined

The project knew there was a tree, viewport and parameter panel, but did not define how much space each may consume.

Required fix:

- resizable left/right docks with min/default/max widths;
- central work area has priority;
- panels collapse/overlay before central viewport becomes unusably narrow;
- user panel widths persist as view preference but are clamped to current viewport;
- panel restoration must never reopen off-screen after moving between displays.

Status: addressed in `DISPLAY_LAYOUT_SPEC.md`.

### HIGH 7 — display/DPI/browser regression matrix was missing

The previous M2A plan said "representative widths" but did not name them.

Required matrix now includes at minimum:

- 1280x720;
- 1366x768;
- 1536x864 effective;
- 1920x1080;
- 2560x1440;
- 3440x1440 ultrawide;
- 3840x2160 effective at 100%;
- representative 4K with 150%/200% OS scaling;
- browser zoom 80/100/125/150/200%;
- tablet portrait/landscape;
- phone portrait/landscape;
- coarse/fine/hybrid pointer cases.

Status: machine-readable matrix added under `spec/ui/viewport-matrix.v1.json`.

### HIGH 8 — high-DPI assets were not explicitly constrained

Raster toolbar icons would blur at 150/200% or 4K.

Required fix:

- product shell icons are SVG/vector/CSS where practical;
- raster assets must have explicit high-DPI variants or be limited to content imagery;
- icons are ASA-owned and are not copied from KOMPAS;
- 1x/1.25x/1.5x/2x DPR visual tests must not show blurred command chrome.

Status: addressed in `DISPLAY_LAYOUT_SPEC.md` / `VISUAL_REFERENCE_SPEC.md`.

### HIGH 9 — mobile was structurally defined but not completely tied to the desktop command registry

The mobile spec correctly avoids squeezing the desktop ribbon, but every command needs a deterministic mobile presentation path.

Required fix:

Every implemented command must declare one of:

- `primary-mobile-action`;
- `active-command-sheet`;
- `tools-sheet`;
- `tree-context`;
- `more-menu`;
- `not-applicable-on-touch` with reason.

There must be no desktop-only command that becomes undiscoverable on phone by accident.

Status: requirement added to registry-v2 plan; mobile shell remains M2/M2I.

### HIGH 10 — keyboard spec needed visible discoverability and focus tests

The shortcut model is good, but acceptance must prove:

- shortcuts appear in tooltips/menu/search;
- numeric/text editors keep expected keys;
- browser-reserved shortcuts are not hijacked;
- remapping collisions are diagnosed;
- Russian/Latin keyboard layouts do not make physical shortcut behavior unpredictable.

Status: covered by `SHORTCUTS_SPEC.md`; E2E pending M2I.

### MEDIUM 11 — KOMPAS panel behavior needed to be reflected more explicitly

KOMPAS has separate management panels such as Parameters and Document Tree, and panels may show/hide depending on active processes. ASA should preserve that mental model without blindly cloning window chrome.

Required fix:

- active engineering command automatically exposes ParameterPanel;
- finishing/canceling command returns the panel to previous properties/state;
- tree/parameters/variables/layers can be switched/collapsed according to document kind;
- user layout preferences persist per document family where appropriate.

Status: added to `DISPLAY_LAYOUT_SPEC.md` and must be validated in M2.

### MEDIUM 12 — very large and very small windows need explicit behavior

4K/ultrawide must not stretch buttons across the whole screen. HD/small windows must not clip commands.

Required fix:

- command areas have content-based/max widths;
- extra width primarily expands the work area;
- side panels may gain moderate width but are capped;
- small windows progressively collapse labels/groups, then docks, then use overflow;
- editing may become constrained/safe mode below a defined minimum effective workspace rather than silently breaking layout.

Status: addressed in `DISPLAY_LAYOUT_SPEC.md`.

## What is already sufficiently specified

The following parts are strong enough to act as source-of-truth:

- one ASA-CAD product with six document kinds;
- Part/Assembly/Drawing/Fragment/Specification/Text document semantics;
- client-side CAD computation;
- standalone and integrated Docker/runtime model;
- ASA-owned `CadDocument` / `CadApplication` boundary direction;
- command/button naming and first-wave grouping;
- selection/viewport interaction model;
- keyboard architecture;
- mobile shell concept;
- save/export/settings separation;
- staged rollout and protected workflows.

## What is still intentionally incomplete

The specification must **not** claim complete 100% KOMPAS parity yet.

Still open:

1. issue #16 must finish the KOMPAS v25 command/workspace inventory, including advanced surfaces, sheet metal and any discovered document-specific controls;
2. visual reference manifest must be populated for all M2/M3/M4/M4A command groups;
3. registry v2 must add order/collapse/mobile-placement/tooltip/icon/fixture metadata;
4. actual measurements from owner-approved KOMPAS reference screenshots must be recorded before final visual acceptance of each workspace;
5. real browser/device testing must validate that the written layout rules produce usable results.

## Final audit gate before M2 visual freeze

M2 shell layout is not considered frozen until all are true:

- every visible M2 command has stable ASA ID and implementation;
- every visible group has explicit order and collapse/overflow priority;
- shell has reference screenshots/URLs/state IDs;
- HD/FHD/2K/4K/ultrawide viewport matrix passes;
- 100/125/150/200% scale/DPR cases pass;
- browser zoom 100/125/150/200% has no inaccessible controls; 80% is regression-tested as best-effort compact mode;
- phone/tablet portrait/landscape fixtures pass;
- no body text/control label becomes unreadably small;
- central viewport remains the dominant work surface;
- no production button is dead;
- keyboard/touch paths exist for every implemented command;
- visual differences from KOMPAS are deliberate and documented rather than accidental.
