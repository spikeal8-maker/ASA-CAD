# M2 visual acceptance gates

This file turns the UI/display contracts into an implementation checklist for M2/M2A/M2I.

M2 is not visually accepted merely because the shell renders.

## Required source contracts

- `docs/UI_COMMAND_SPEC.md`
- `docs/WORKSPACE_INTERACTION_SPEC.md`
- `docs/SHORTCUTS_SPEC.md`
- `docs/MOBILE_RESPONSIVE_SPEC.md`
- `docs/DISPLAY_LAYOUT_SPEC.md`
- `docs/VISUAL_REFERENCE_SPEC.md`
- `spec/ui/command-registry.v1.json` and later registry v2
- `spec/ui/viewport-matrix.v1.json`

## Gate 1 — command composition

For every visible M2 command/group:

- stable command ID;
- exact Russian label;
- workspace;
- group;
- deterministic group order;
- deterministic command order;
- button/split/dropdown/toggle form;
- primary action where split-button;
- dropdown member order;
- enable/disable predicate;
- parameter-panel reference;
- shortcut reference if any;
- icon key using ASA-owned asset;
- collapse priority;
- overflow destination;
- mobile placement;
- fixture/test reference.

No permanent production button may be left as an inert placeholder.

## Gate 2 — desktop baseline

Primary baseline:

`1920x1080 effective CSS viewport, UI Scale 100%`.

Owner review must cover:

- overall KOMPAS-oriented hierarchy;
- top/global area;
- document tabs;
- workspace tabs;
- command groups;
- tree;
- central work area;
- ParameterPanel;
- status/rebuild/save states;
- command lifecycle and preview.

Every reviewed screen references a record from `VISUAL_REFERENCE_SPEC.md`.

## Gate 3 — small desktop/HD

Required at minimum:

- 1280x720;
- 1366x768;
- 1536x864.

Acceptance:

- no essential command clipping;
- compact/overflow rules are deterministic;
- text is not reduced below readability floor;
- right/left docks collapse before the work area becomes unusable;
- active ParameterPanel remains scrollable/reachable;
- protected Part workflow remains executable.

## Gate 4 — 2K/4K/ultrawide

Required:

- 2560x1440;
- 3440x1440;
- 3840x2160 effective at low DPR;
- representative 4K effective viewports at 150% and 200% OS scaling.

Acceptance:

- extra space primarily enlarges the work area;
- command groups/panels have bounded widths;
- text is not physically tiny because of a naive raw-resolution rule;
- Auto/UI Scale works without double scaling;
- SVG/vector product icons remain sharp;
- picking/selection remains correct after shell scale change.

## Gate 5 — browser/text zoom

At 100/125/150/200% browser zoom:

- all essential controls remain reachable;
- dialogs/sheets remain within viewport;
- panels collapse/scroll rather than clip;
- command labels/state are understandable;
- text/numeric inputs remain editable;
- 3D/2D pointer coordinates remain correct.

80% is a compact best-effort regression case, not a reason to make the default UI smaller.

## Gate 6 — mobile/tablet

Required fixtures:

- 360x640;
- 390x844;
- 430x932;
- representative phone landscape;
- 768x1024 tablet portrait;
- 1024x768 tablet landscape;
- hybrid touch+mouse/keyboard tablet.

Acceptance:

- work area remains primary;
- no desktop ribbon squeezed into tiny icons;
- Tools/Tree/Parameters placement follows mobile spec;
- every implemented command has a mobile discovery path;
- touch targets meet minimum size;
- software keyboard does not hide active value/confirm controls;
- safe-area insets are respected;
- orientation change preserves document/runtime/active command state;
- no essential hover-only behavior.

## Gate 7 — input modes

M2/M2I must prove:

- mouse;
- keyboard;
- touch;
- hybrid touch + mouse/keyboard;
- pointer selection and ambiguity chooser;
- shortcut focus safety;
- shortcut discoverability;
- visible command path for important gesture/shortcut actions.

## Gate 8 — visual reference parity

For every required M2 reference state:

- reference exists;
- source version/state is recorded;
- ASA fixture exists;
- major layout measurements are recorded;
- structural parity is reviewed;
- deliberate differences are documented;
- responsive variants preserve the same information hierarchy.

## Gate 9 — no layout corruption

Stress cases:

- resize window repeatedly;
- open/close docks;
- max/min panel widths;
- long document titles;
- long parameter labels/errors;
- command overflow;
- browser zoom change;
- monitor/DPI change manual test;
- portrait/landscape change;
- software keyboard open/close.

None may restart the geometry kernel merely for a layout change or corrupt the active native document.

## Gate 10 — acceptance evidence

M2/M2A should produce:

- deterministic fixture URLs;
- visual-regression screenshots;
- viewport-matrix CI result;
- keyboard/mouse/touch browser E2E;
- owner-approved baseline screenshots;
- documented exceptions.

Without this evidence the shell remains `implementation-complete` at best, not `visual-accepted`.
