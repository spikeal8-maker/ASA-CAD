# ASA-CAD display, scaling and layout specification

This document is the binding responsive/layout contract across small laptops, Full HD, 2K, 4K, ultrawide, tablet and phone displays.

Exact KOMPAS-oriented desktop placement is defined together with `docs/KOMPAS_SHELL_LAYOUT_SPEC.md`. If an older generic three-column diagram conflicts with that file, the KOMPAS shell layout contract wins.

## 1. Fundamental rule: effective viewport, not physical resolution

ASA-CAD must not decide layout from raw physical pixel dimensions alone.

The browser UI is designed in CSS/effective pixels. The same 3840x2160 physical panel can expose very different effective work areas depending on OS display scaling and browser zoom.

Therefore:
- breakpoints use effective `window.innerWidth` / `innerHeight`;
- physical resolution/DPR/OS scale/browser zoom are regression metadata;
- user receives separate ASA `UI Scale`;
- do not apply a blunt whole-app transform that breaks 3D/2D picking coordinates.

## 2. Reference size classes

Effective width:
- `xs-phone`: <480
- `phone`: 480–599
- `tablet`: 600–899
- `compact`: 900–1279
- `desktop`: 1280–1919
- `large`: 1920–2559
- `xlarge`: >=2560

Effective height:
- `short`: <720
- `compact-height`: 720–899
- `standard-height`: 900–1199
- `tall`: >=1200

Both axes matter. 1920x720 is wide but must use compact vertical chrome.

## 3. Binding desktop composition

Default desktop hierarchy:

```text
Main Menu / Search / global application state
DocumentTabs
Workspace / Instrument area + CommandGroups
------------------------------------------------
Panel rail + active ManagementPanel | WorkArea
(Tree / Parameters / Variables / Layers...)
                                  [Viewport Quick Access]
------------------------------------------------
StatusBar
```

Important:
- idle Part/Assembly normally shows `Дерево`;
- an engineering command that needs parameters automatically switches the management block to `Параметры`;
- finishing/canceling restores the previous panel unless user deliberately pinned another arrangement;
- `ViewportQuickAccessBar` belongs to the upper edge of the graphical work area, not a generic extra website header;
- first M2 release does **not** require permanent simultaneous Tree-left + Parameters-right columns;
- optional advanced multi-panel docking may be added later.

See `KOMPAS_SHELL_LAYOUT_SPEC.md`.

## 4. Baseline geometry at UI Scale 100%

Targets subject to owner-approved reference measurement:
- main/global bar: 36–40 CSS px;
- document tabs: 30–34 CSS px;
- workspace tab row: 30–34 CSS px;
- command group/instrument content: 64–84 CSS px depending on layout class;
- status bar: 24–28 CSS px;
- panel rail: compact icon/control rail sized from design tokens;
- active management panel default width: ~280–320 CSS px;
- active management panel min: 220–240 CSS px;
- normal max: 420–440 CSS px;
- divider visual line may be narrow but hit target >=8 CSS px;
- normal desktop command hit target >=32x32 CSS px;
- primary/large command target 40–48 CSS px.

Exact values are tuned against approved KOMPAS references and then frozen as design tokens.

## 5. Work-area protection

The engineering work area is primary.

Rules:
- central graphical/page/table/text area should normally remain >=640 CSS px wide on desktop;
- management panel clamps toward minimum before work area is sacrificed;
- if still too narrow, panel collapses to rail/overlay/drawer;
- user-saved panel width is clamped to current viewport;
- moving/resizing between displays never restores an off-screen panel or zero-width work area;
- extra 2K/4K/ultrawide width primarily expands WorkArea.

## 6. Height budget

At UI Scale 100%:
- standard/tall: normal instrument presentation;
- 720–899: compact vertical chrome;
- 720–767: top fixed chrome target <=126 CSS px where practical;
- 900+: normal target, but top UI must remain bounded;
- below 720: use deliberately compressed/constrained layout; never clip essential actions silently.

Panels scroll internally. The entire application page must not vertically scroll the CAD viewport away from fixed command/status chrome.

## 7. Command composition/collapse

Registry v2 must carry:
- workspace/group/command order;
- priority/collapsePriority;
- presentation (`large`, `icon-label`, `icon`, `split`, `dropdown`, `toggle`);
- primary action and dropdown member order;
- min/preferred width;
- overflow destination;
- mobile placement;
- reference/fixture IDs.

Collapse sequence:
1. reduce optional group spacing;
2. compact secondary icon+label controls where still understandable;
3. collapse related commands into their defined split/dropdown;
4. move lower-priority groups to deterministic `Еще` overflow;
5. use a scrollable group rail only in designated compact/tablet modes;
6. do not unpredictably wrap desktop command groups to arbitrary extra rows;
7. do not shrink text below readability floor just to keep everything visible.

All overflowed commands remain searchable.

## 8. Typography/readability

At UI Scale 100%:
- normal desktop body/control: 14 CSS px target;
- command labels/tree rows/panel labels: 13–14;
- secondary metadata: 12.5–13;
- ordinary production minimum: 12;
- desktop/tablet numeric/text input: >=14;
- phone text/numeric input: >=16.

Cyrillic and engineering symbols must not clip vertically.

Recommended font strategy: system UI stack with reliable Cyrillic coverage; final token/family is owner-reviewed with KOMPAS references.

Do not use font shrinkage as responsive strategy.

## 9. Icon sizing/high DPI

Permanent shell icons are ASA-owned SVG/vector assets.

Initial icon-size tokens at UI Scale 100% may use approximately:
- small: 16 CSS px;
- normal: 20 CSS px;
- emphasized: 24 CSS px;
- large command illustration where needed: ~28–32 CSS px.

Final values come from reference measurements.

No low-resolution raster toolbar icons. High-DPR display must stay sharp.

## 10. ASA UI Scale

`Настройки -> Интерфейс -> Масштаб интерфейса`

Initial values:
- Auto
- 90%
- 100%
- 110%
- 125%
- 150%

UI Scale changes shell tokens/chrome, not model units.

Changing UI Scale:
- resizes/reflows work area;
- does not restart WASM;
- does not recompute B-Rep solely because chrome changed;
- does not desynchronize pointer/picking coordinates;
- user override wins over Auto.

Conservative Auto target:
- normal effective widths <2400: 100%;
- >=2400 may suggest/use 110%;
- >=3200 effective at low DPR may suggest/use 125%;
- never auto-enlarge if current height/overflow would become unusable.

This heuristic requires real-monitor validation before release.

## 11. HD / Full HD / 2K / 4K / ultrawide behavior

### 1280x720
Compact desktop lower bound. Management panel near minimum/overlay as needed; low-priority command groups overflow; readable text; protected Part remains usable.

### 1366x768
Primary school-laptop stress fixture. No essential command may disappear into an inaccessible state.

### 1536x864
Common effective high-DPI/scaled laptop fixture.

### 1920x1080
Primary desktop visual reference fixture at UI Scale 100%.

### 2560x1440
Work area expands. Panel/command widths remain bounded. UI Scale 110% must be tested.

### 3440x1440 ultrawide
Most extra width goes to WorkArea. Do not stretch management panel or toolbar across monitor.

### 3840x2160 effective at low scaling
Large effective workspace. Auto/UI Scale may be 110–125 so chrome is not physically tiny on common 4K monitors. WorkArea still receives most extra space.

### Physical 4K at 150%/200% OS scaling
Effective CSS viewport controls layout. Representative cases:
- 4K@150% -> ~2560x1440 effective;
- 4K@200% -> ~1920x1080 effective.

Do not detect physical 4K and scale the shell a second time.

### 1920x720
Wide/short stress case: use compact-height command presentation.

## 12. Browser zoom, DPR and multi-display

Required browser zoom functional regression:
- 100%
- 125%
- 150%
- 200%

80% is best-effort compact regression.

Required DPR/scale representations around:
- 1.0
- 1.25
- 1.5
- 2.0

Manual validation includes Windows display-scale changes and mixed-DPI monitor movement where available.

At 200% zoom essential controls remain reachable through reflow/overflow/panel scrolling.

## 13. Management panel behavior

To preserve the KOMPAS mental model:
- panels include Parameters, Document Tree and later Variables/Layers/other document-specific panels;
- active process may automatically expose required Parameters panel;
- idle state restores Tree/default previous panel;
- panels may collapse to maximize work area;
- visibility/width preference may persist per document family;
- first release uses one default panel block; advanced multiple blocks/floating panels are optional later.

## 14. Phone/tablet integration

Detailed rules are in `MOBILE_RESPONSIVE_SPEC.md`.

The desktop UI is not scaled down literally.

Phone/tablet:
- same `CadDocument` and command IDs;
- Tools/Tree/Parameters become drawers/bottom sheets;
- every implemented command has a mobile discovery path;
- safe areas/software keyboard/orientation participate in layout;
- hybrid tablet may use mouse/keyboard interaction while retaining touch-safe behavior.

## 15. Visual/reference acceptance

Primary source contracts:
- `VISUAL_REFERENCE_SPEC.md`;
- `spec/ui/visual-reference-manifest.v1.json`;
- `spec/ui/viewport-matrix.v1.json`;
- `M2_VISUAL_ACCEPTANCE.md`.

Required M2 fixture families include:
- idle Part with Tree panel;
- Sketch active;
- feature command with Parameters panel;
- viewport Quick Access/context actions;
- command overflow;
- long document title;
- panel min/default/max/collapsed;
- maximize work area;
- desktop/compact/2K/4K;
- phone/tablet portrait/landscape.

## 16. Acceptance gate

Display/layout passes only when:
1. no required command is clipped/unreachable at supported effective sizes;
2. normal text stays above readability floors;
3. WorkArea remains primary;
4. management panels switch/collapse predictably;
5. active commands expose Parameters predictably;
6. viewport Quick Access remains tied to graphical area;
7. 3D/2D picking remains correct after scale/zoom/layout changes;
8. vector chrome stays sharp at high DPR;
9. HD/FHD/2K/4K/ultrawide fixtures pass;
10. 4K 150/200% does not double-scale;
11. 200% browser zoom remains navigable;
12. visual differences from approved KOMPAS references are deliberate/documented.
