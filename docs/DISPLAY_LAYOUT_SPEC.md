# ASA-CAD display, scaling and layout specification

This document is the binding layout contract for the ASA-owned shell across small laptops, Full HD, 2K, 4K, ultrawide, tablet and phone displays.

It complements `docs/UI_COMMAND_SPEC.md`, `docs/WORKSPACE_INTERACTION_SPEC.md` and `docs/MOBILE_RESPONSIVE_SPEC.md`.

## 1. Fundamental rule: effective viewport, not physical resolution

ASA-CAD must not decide layout from raw physical pixel dimensions alone.

The browser UI is designed in CSS/effective pixels. The same 3840x2160 physical panel can expose very different effective work areas depending on OS display scaling and browser zoom.

Therefore:

- layout breakpoints use `window.innerWidth` / `innerHeight` in CSS pixels;
- physical resolution is recorded only as test metadata;
- `devicePixelRatio` is used for rendering quality/testing, not as the sole layout breakpoint;
- OS display scaling and browser zoom are explicit regression dimensions;
- the user receives a separate ASA `UI Scale` preference;
- the 3D/2D work area is resized normally; do not apply a whole-application CSS transform/zoom that breaks pointer/picking coordinates.

## 2. Reference layout classes

Width classes are based on effective CSS viewport width:

- `xs-phone`: < 480
- `phone`: 480–599
- `tablet`: 600–899
- `compact`: 900–1279
- `desktop`: 1280–1919
- `large`: 1920–2559
- `xlarge`: >= 2560

Height classes:

- `short`: < 720
- `compact-height`: 720–899
- `standard-height`: 900–1199
- `tall`: >= 1200

Both axes matter. Example: 1920x720 is a wide but short shell and must use compact vertical chrome.

## 3. Required desktop composition

Reference desktop order:

```text
MainMenu / quick access / global state
DocumentTabs
WorkspaceTabs + CommandGroups
---------------------------------------
LeftDock | Central WorkArea | RightDock
---------------------------------------
StatusBar
```

The central work area is the primary product surface. Extra display space should primarily increase model/drawing work area rather than stretching the command ribbon across the entire monitor.

### Default desktop geometry at UI scale 100%

Targets, not arbitrary per-component values:

- main/global bar: 36–40 CSS px;
- document tabs row: 30–34 CSS px;
- workspace tab row: 30–34 CSS px;
- command group/ribbon content: 64–84 CSS px depending on density/layout class;
- status bar: 24–28 CSS px;
- left tree dock default: 260 CSS px; min 220; normal max 380;
- right parameters dock default: 320 CSS px; min 280; normal max 440;
- divider hit target: visually small but pointer hit area at least 8 CSS px;
- desktop command button normal hit target: minimum 32x32 CSS px;
- primary/large command button: 40–48 CSS px visual target depending on group form.

The exact final values are tuned against approved visual references, but implementations must stay inside these ranges unless the source-of-truth is deliberately revised.

## 4. Central work-area protection

When both docks are open:

- central work area should normally remain at least 640 CSS px wide on desktop;
- at 1280–1366 widths, docks clamp toward minimum widths before the viewport is sacrificed;
- if the work area would fall below the minimum, the right dock collapses/overlays before the left tree disappears;
- if still too narrow, the left dock collapses to a rail/drawer;
- user-saved panel widths are clamped to current viewport on restore;
- moving between monitors must never restore a panel off-screen or leave a zero-width work area.

For Drawing/Fragment, page visibility has equivalent priority. For Specification/Text, table/page editor retains the majority of available space.

## 5. Top chrome height budget

The command area may not consume an uncontrolled fraction of a short display.

At UI scale 100%:

- `standard-height`/`tall`: normal KOMPAS-oriented command presentation;
- `compact-height`: top chrome target <= 150 CSS px excluding browser chrome;
- 720–767 effective height: compact command group mode target <= 126 CSS px;
- below 720 effective height: editing is supported only through a deliberately compressed layout; if meaningful work area cannot be preserved, display constrained-layout guidance instead of clipping essential controls.

Command groups collapse/overflow before font size is reduced below readability floors.

## 6. Command group ordering and collapse model

The command registry defines semantic groups. The layout engine adds deterministic visual metadata:

- workspace order;
- group order;
- command order;
- `priority`;
- `collapsePriority`;
- preferred presentation: icon+label / icon-only / large command / split button;
- minimum presentation width;
- overflow destination;
- mobile placement.

Registry v2 must provide or reference this metadata.

### Collapse sequence

When horizontal space is reduced:

1. reduce optional inter-group spacing;
2. switch secondary commands from icon+label to compact/icon form where still understandable and tooltip-labelled;
3. collapse low-priority related commands into their defined split/dropdown group;
4. move low-priority groups to deterministic `Еще` overflow;
5. use horizontally scrollable group rail only in tablet/compact modes where specified;
6. never wrap command groups unpredictably into an arbitrary second/third line on desktop;
7. never shrink text below the defined readability floor merely to keep all groups visible.

A command moved to overflow remains searchable by command search.

## 7. Typography

Typography is based on CSS pixels and ASA UI scale tokens.

At UI scale 100%:

- normal desktop control/body text: 14 CSS px target;
- command labels: 13–14 CSS px;
- panel/tree rows: 13–14 CSS px;
- secondary metadata: 12.5–13 CSS px;
- minimum ordinary production chrome text: 12 CSS px;
- parameter numeric/text input: >=14 CSS px desktop/tablet;
- phone text/numeric input: >=16 CSS px;
- headings use modest hierarchy rather than oversized marketing typography.

Line height must prevent clipping in Cyrillic text and engineering symbols.

Text truncation rules:

- short command labels should not truncate in their normal reference layout;
- long document names may ellipsize with full name accessible via tooltip/tap;
- parameter field labels may wrap only where the panel layout explicitly supports it;
- no important state/error text is conveyed only by clipped text.

## 8. ASA UI Scale

Application setting:

`Настройки -> Интерфейс -> Масштаб интерфейса`

Initial values:

- Auto
- 90%
- 100%
- 110%
- 125%
- 150%

Rules:

- UI Scale changes shell chrome/tokens, not model engineering units;
- viewport canvas is resized to the remaining area rather than globally transformed;
- pointer/picking coordinates remain correct;
- scale change must not restart WASM or recompute B-Rep;
- per-user preference may sync through ASA Lab later;
- Auto may use effective viewport size, pointer characteristics and DPR as heuristics but must never assume physical monitor size from resolution alone.

### Auto heuristic target

Initial implementation may use conservative behavior:

- normal effective widths below 2400: 100%;
- very large effective workspace (>=2400) may suggest/use 110%;
- >=3200 effective width at low DPR may suggest/use 125%;
- never increase automatically if that would push the current window into a compact-height/overflow failure state;
- user override always wins.

The exact Auto heuristic must be validated with real 27–32 inch 2K/4K displays before release.

## 9. 4K, 2K, Full HD and HD expectations

### 1280x720 / HD effective

- compact desktop shell;
- left dock clamped near minimum;
- right parameters dock overlays/collapses as necessary;
- command groups use compact/overflow mode;
- text remains readable; no microscopic compression;
- central modeling work area remains usable.

### 1366x768

- compact desktop reference school-laptop case;
- protected Part workflow must remain fully usable;
- essential commands cannot disappear into inaccessible menus.

### 1920x1080 / Full HD effective

- primary desktop reference fixture;
- normal tree + work area + parameters simultaneous layout;
- reference screenshot comparison is primarily tuned here.

### 2560x1440 / 2K effective

- wider work area;
- docks may gain modest width but remain capped;
- top commands keep normal scale rather than spreading to fill monitor;
- optional UI scale 110% should remain usable.

### 3840x2160 / 4K effective at 100%

- work area expands significantly;
- default/Auto UI scale should prevent overly tiny perceived chrome on common large monitors;
- command/panel width remains bounded;
- SVG/vector icons remain sharp;
- no fixed-pixel bitmap chrome.

### 4K at 150%/200% OS scaling

- resulting effective CSS viewport drives layout;
- 4K@200% should behave approximately like a Full-HD effective workspace rather than a giant 4K chrome layout;
- no double-scaling based on physical resolution.

### 3440x1440 ultrawide

- central work area receives most additional width;
- do not stretch left/right panels or command groups across the full screen;
- user may keep multiple side panels only within defined max widths.

## 10. Height-specific behavior

CAD is sensitive to height. Required cases:

- 720/768: compact ribbon/chrome, parameters scroll internally;
- 864/900: transition layout;
- 1080: baseline;
- 1440+: normal chrome plus larger work area, not gratuitously larger top bars.

Right/left panels use internal scroll when content exceeds height. The entire application must not gain a page scrollbar that moves the viewport away from command chrome.

## 11. DPI and browser zoom

Visual/browser tests must cover:

- DPR / scale representations around 1.0, 1.25, 1.5, 2.0;
- browser zoom 80%, 100%, 125%, 150%, 200%;
- moving/resizing window where feasible;
- changing OS display scale in manual validation;
- mixed-DPI multi-monitor manual validation for Windows development machines.

At 200% browser text/UI zoom:

- controls remain reachable;
- panels may collapse/overflow;
- no critical dialog is clipped outside viewport;
- scrolling is localized to menus/panels rather than hiding the whole application frame.

## 12. Vector/high-DPI asset rule

Permanent product chrome uses:

- SVG icons;
- CSS/vector primitives;
- high-resolution canvas/WebGL output for model/drawing areas.

Do not use low-resolution raster copies of toolbar icons.

Raster images are permitted for content/reference images where appropriate, but not as the primary scalable shell icon source.

ASA recreates its own icons; KOMPAS proprietary icon artwork is not copied.

## 13. KOMPAS-oriented panel behavior

To preserve the KOMPAS mental model:

- Document Tree is a persistent/collapsible management panel on desktop;
- ParameterPanel appears automatically when an active command needs it;
- finishing/canceling a command restores previous properties/panel state;
- Variables/Layers/other document-specific panels are available through the defined panel switcher when implemented;
- panels may be docked/collapsed in ASA; floating panel behavior is optional and not required for first release;
- user panel visibility/width is remembered per document family where practical.

## 14. Phone/tablet interaction with this layout contract

Phone/tablet detailed behavior is in `MOBILE_RESPONSIVE_SPEC.md`.

Important integration rule:

- phone does not inherit desktop pixel dimensions by scaling them down;
- phone uses the same command registry but different presentation metadata;
- no desktop-only command may become unreachable on touch;
- software keyboard/safe-area insets/orientation changes are part of layout calculations;
- hybrid tablets with mouse/keyboard may use desktop-like interactions while retaining touch-safe target sizes where the input mode requires them.

## 15. Visual regression matrix

Machine-readable source: `spec/ui/viewport-matrix.v1.json`.

Every permanent shell fixture must be tested at the matrix rows relevant to its milestone.

M2 minimum:

- Part empty;
- Part active sketch;
- Part active extrusion/ParameterPanel;
- long document name;
- command overflow state;
- left/right panel min/default/max widths;
- desktop/compact/large/xlarge;
- phone portrait/landscape;
- tablet portrait/landscape.

## 16. Acceptance gate

The display/layout contract passes only when:

1. no required command is clipped or unreachable at supported effective sizes;
2. normal text stays above readability floors;
3. central work area remains primary;
4. panel state survives resize/orientation without corruption;
5. 3D picking remains correct after UI scale/browser zoom/layout changes;
6. vector shell assets remain sharp at high DPR;
7. HD/FHD/2K/4K/ultrawide reference fixtures pass visual review;
8. 4K at OS 150/200% does not get double-scaled;
9. 200% browser zoom remains functionally navigable;
10. any visual divergence from the approved KOMPAS reference is documented and intentional.
