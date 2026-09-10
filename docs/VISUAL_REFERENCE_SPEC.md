# ASA-CAD visual reference specification

This document defines how ASA-CAD uses KOMPAS-3D as a visual/workflow reference without turning screenshots into vague inspiration or copying proprietary artwork.

## 1. Why this exists

"Make it look like KOMPAS" is not an implementable acceptance criterion by itself.

Every permanent ASA-CAD screen/workspace must be compared against a traceable reference state and must record which parts are intentionally similar and which are deliberately different.

## 2. Reference sources

Allowed reference sources:

1. current official KOMPAS-3D v25 help pages and screenshots;
2. owner-provided screenshots captured from the version being taught;
3. owner-approved annotated measurements derived from those references.

Do not copy proprietary KOMPAS icon/image assets into ASA-CAD product source. ASA recreates its own icons while matching command meaning, grouping and interaction model.

## 3. Reference record

Every approved reference gets a stable ID and a record containing:

```text
referenceId
KOMPAS version
source URL or owner screenshot identifier
document kind
workspace/tab
active command/state
source resolution if known
OS scale if known
application/UI scale if known
important panel visibility
ASA target fixture URL
ASA components covered
layout observations
allowed/deliberate differences
review status
```

## 4. Required M2 reference set

At minimum capture/approve reference states for:

- application shell with Part open;
- empty Part;
- model tree visible;
- ParameterPanel visible during feature creation;
- Sketch mode;
- Extrusion command active;
- Cut Extrusion active;
- Fillet active;
- document tabs with multiple documents;
- command group overflow/compact layout;
- standard view/orientation controls;
- tree context menu;
- save/rebuild/error state.

## 5. Later required sets

### M3 Sketch

- geometry group;
- constraints group;
- dimensions group;
- fully constrained state;
- conflicting/redundant constraint state;
- projected/reference geometry.

### M4 Part Design

- holes and dropdown variants;
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

## 6. Measurements to extract

For each owner-approved reference state record, where visible/relevant:

- top bar height;
- document tab row height;
- workspace/ribbon height;
- left management panel width;
- parameter panel width;
- status bar height;
- group ordering;
- group separator behavior;
- icon-to-label relationship;
- primary vs split/dropdown control treatment;
- tree row height/indent rhythm;
- parameter field rhythm;
- spacing around viewport;
- command confirmation/cancel placement;
- colors/contrast only as behavioral inspiration, not copied assets.

Exact pixel equality is not required across every monitor because ASA is responsive; the measured desktop reference informs the baseline ratios and hierarchy.

## 7. Reference baseline resolution

The primary visual tuning fixture is effective Full HD:

```text
1920x1080 CSS/effective viewport, UI scale 100%
```

This is not the only supported size. The same approved hierarchy is validated against `spec/ui/viewport-matrix.v1.json`.

For screenshots captured on 2K/4K monitors, record OS scale/browser zoom so measurements can be translated to effective CSS pixels rather than misread as raw physical pixels.

## 8. ASA visual parity levels

Every screen/group receives one status:

- `reference-missing` — cannot be visually accepted yet;
- `mapped` — reference exists and ASA components are identified;
- `structural-parity` — hierarchy/placement/workflow matches intended reference;
- `visual-review-passed` — owner-approved at baseline fixture;
- `responsive-review-passed` — accepted across required viewport matrix.

A milestone cannot claim visual completion while its required reference states remain `reference-missing`.

## 9. Deliberate differences

Examples of acceptable deliberate differences:

- ASA branding and icon artwork;
- browser-safe shortcut changes;
- touch/mobile layout;
- accessibility/readability adjustments;
- overflow behavior required for smaller effective widths;
- ASA Lab save/submission state indicators;
- technical differences forced by browser runtime.

Every material difference should be deliberate, not accidental.

## 10. Mobile reference policy

KOMPAS desktop screenshots are not shrunk onto a phone.

Mobile is derived from the same information architecture and command registry, but the mapping must state:

- which desktop group becomes a Tools sheet;
- which active ParameterPanel becomes a bottom sheet;
- which tree becomes a drawer;
- where confirm/cancel moves;
- what remains permanently visible;
- how the command remains discoverable.

Mobile visual acceptance is against ASA's responsive contract, not pixel similarity to a desktop KOMPAS screenshot.

## 11. Reference storage policy

Prefer storing metadata/links and ASA-owned annotated diagrams in the public repository.

Owner-provided or third-party screenshots may be referenced by identifier/location according to project policy. Do not commit proprietary icon packs or redistributable copies merely for convenience.

## 12. Acceptance workflow

For each major UI slice:

1. select reference ID(s);
2. open deterministic ASA fixture;
3. compare hierarchy and command placement;
4. measure material differences;
5. correct ASA shell/components/tokens;
6. approve baseline Full HD state;
7. run responsive matrix;
8. approve compact/2K/4K/mobile states;
9. record deliberate differences.
