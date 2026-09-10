# ASA-CAD visual reference specification

This document defines how ASA-CAD uses KOMPAS-3D as a visual/workflow reference without turning screenshots into vague inspiration or copying proprietary artwork.

## 1. Reference hierarchy

ASA-CAD uses two reference classes:

1. **Official KOMPAS-3D v25 help** — authoritative for command terminology, workspace/group semantics, management-panel behavior, command lifecycle and documented interaction structure.
2. **Owner-provided KOMPAS screenshots** — preferred for exact visual measurement of the installed KOMPAS appearance the owner wants to reproduce: spacing, panel proportions, command density, row heights and other state-specific visual details.

An owner screenshot is not required to begin structural M2 implementation when an official-help reference already defines the state. It is required before claiming pixel/spacing parity with a particular installed KOMPAS layout if that exact appearance is part of acceptance.

KOMPAS proprietary icon artwork is reference-only. ASA-CAD uses its own vector icons/assets.

## 2. Machine reference manifest

`spec/ui/visual-reference-manifest.v1.json` is the machine-readable reference map.

For each reference state it records, where applicable:

- stable reference ID;
- document kind;
- workspace;
- active state/command;
- official KOMPAS help URL;
- deterministic ASA fixture route that must exist when the workspace is implemented;
- owner screenshot slot where exact visual tuning is desired;
- regions/behaviors to measure or compare.

The manifest is no longer an empty scaffold. It contains official-help-bound references for:

- management-panel behavior;
- graphical Quick Access;
- Part shell;
- Sketch;
- Extrusion / Cut Extrusion / Shell operation states;
- Assembly shell, replacement and context editing;
- Drawing view/annotation states;
- Specification;
- Text;
- advanced surfaces and sheet-metal workspaces.

## 3. Reference record

A complete reference record may contain:

```text
referenceId
KOMPAS version
official source URL
owner screenshot slot/identifier
document kind
workspace/tab
active command/state
source resolution if known
OS scale if known
browser/application scale if known
important panel visibility
ASA target fixture URL
ASA components covered
layout observations/measure targets
allowed/deliberate differences
review status
```

Do not infer absolute CSS dimensions from a screenshot whose display scale is unknown. Such a screenshot may still define hierarchy/proportions.

## 4. Required M2 reference states

The machine manifest now binds the structural M2 reference baseline. M2 implementation still must create/validate deterministic ASA fixtures for at least:

- application shell with Part open;
- idle Part with Tree;
- Parameters panel during feature creation;
- Sketch active;
- Extrusion active;
- Cut Extrusion active;
- Fillet/feature parameter state;
- multiple document tabs;
- management-panel switcher;
- graphical Quick Access/context controls;
- command overflow/compact layout;
- standard orientation controls;
- tree context menu;
- maximize/collapsed panel state;
- save/rebuild/error state.

## 5. Later reference sets

### M3 Sketch

- geometry group;
- constraints group;
- dimensions group;
- fully constrained state;
- conflicting/redundant constraint state;
- projected/reference geometry.

### M4 Part Design

- Hole family/split menu;
- arrays;
- reference geometry;
- feature editing;
- rebuild error;
- measurement/diagnostics.

### M4A Assembly

- components group;
- placement/mates group;
- assembly tree;
- in-context Part editing;
- unresolved mate/reference state;
- component version/update state.

### M6/M6A

- Drawing shell/sheets/views/dimensions/annotations;
- Fragment;
- Specification grid;
- Text document page editor.

### M7+

- Wireframe/surfaces;
- sheet-metal modeling;
- other commands promoted from the maintained KOMPAS inventory.

## 6. Measurements to extract from owner-approved screenshots

Where visible/relevant:

- main-menu height;
- document-tab height;
- workspace/instrument-area height;
- management-panel rail and panel width;
- status height;
- command group order/separators;
- button/split/dropdown presentation;
- icon-to-label relationship;
- tree row height/indent rhythm;
- ParameterPanel field rhythm;
- viewport margins;
- graphical Quick Access placement;
- confirmation/cancel placement.

Exact physical-pixel equality is not required across monitors because ASA is responsive. Measurements are translated into the effective CSS/layout system defined by `DISPLAY_LAYOUT_SPEC.md`.

## 7. Primary baseline and responsive validation

Primary visual tuning fixture:

```text
1920x1080 effective CSS viewport
UI Scale 100%
browser zoom 100%
```

It is then validated against `spec/ui/viewport-matrix.v1.json`, including HD, FHD, 2K, 4K/HiDPI, ultrawide, zoom, tablet and phone cases.

## 8. ASA visual parity statuses

A reference/fixture progresses through:

- `reference-missing`;
- `reference-bound` — official/owner reference is identified;
- `fixture-ready` — deterministic ASA state exists;
- `structural-parity` — hierarchy/placement/workflow accepted;
- `visual-review-passed` — owner-approved at baseline;
- `responsive-review-passed` — accepted across required viewport matrix.

A milestone cannot claim visual completion while required states are below the applicable acceptance status.

## 9. Deliberate differences

Acceptable examples include:

- ASA branding and ASA-owned icons;
- browser-safe shortcut changes;
- larger touch targets/mobile command sheets;
- accessibility/readability adjustments;
- deterministic compact/overflow behavior;
- ASA Lab save/network/submission status;
- technical changes forced by browser runtime.

Every material deviation should be documented as deliberate rather than becoming an accidental divergence.

## 10. Mobile reference policy

KOMPAS desktop screenshots are not simply shrunk onto a phone.

The same command/document information architecture maps to:

- phone Tools sheet;
- bottom-sheet ParameterPanel;
- Tree drawer;
- persistent work area;
- reachable confirm/cancel;
- search/context discovery.

Mobile acceptance follows `MOBILE_RESPONSIVE_SPEC.md`, not pixel similarity to a desktop screenshot.

## 11. Storage policy

Prefer source links, metadata and ASA-owned annotated measurements/diagrams in the repository. Do not commit proprietary KOMPAS icon packs or copied artwork for convenience.

## 12. Two different completion states

### Reference-baseline complete

Requires:

- official-help reference mapping for required structural states;
- stable machine reference IDs;
- KOMPAS shell/panel/Quick Access decisions resolved;
- layout registry present;
- owner screenshot needs represented explicitly rather than assumed.

**Status: COMPLETE.**

### Visual implementation accepted

Requires the actual ASA shell and therefore remains implementation work:

1. corresponding deterministic `/dev/...` fixtures exist;
2. ASA screenshots are generated at required viewport cases;
3. owner screenshots are used where exact installed appearance is requested;
4. structural/visual differences are reviewed;
5. responsive/browser regression passes.

**Status: PENDING M2 IMPLEMENTATION.**

This distinction lets us finish the specification/reference preparation without pretending that an interface which has not yet been implemented has passed visual review.
