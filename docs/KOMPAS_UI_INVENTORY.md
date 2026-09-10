# KOMPAS v25 functional UI inventory for ASA-CAD

This document is the human-readable index for the KOMPAS-3D v25 command audit used by ASA-CAD.

Machine-readable inventory: `spec/ui/kompas-command-inventory.v25.json`.
Tracking issue: #16.

## Audit status

**Baseline inventory complete for the built-in engineering workspaces required by ASA-CAD planning.**

The current machine inventory contains **211 command/control rows** classified as:

- `core-now` — required for the protected/near-term workflows;
- `planned` — part of the intended ASA-CAD product at a defined milestone;
- `advanced` — retained explicitly for broader KOMPAS parity after the Part/Assembly/documentation foundations;
- `not-in-ASA-scope` — explicit exclusion with reason when such a decision is made.

The audit is intentionally broader than the first school release. It includes the advanced **Каркас и поверхности** and **Листовое моделирование** workspaces, Boolean solid operations and advanced Assembly mate families so these capabilities cannot disappear from the roadmap by accident.

This is a maintained baseline, not a promise that a future KOMPAS update cannot introduce another command. New official-help discoveries are appended and classified; they are never silently ignored.

## Sources and cross-check

Primary functional source:

`https://help.ascon.ru/KOMPAS/25/ru-RU/`

The audit is cross-checked against the official KOMPAS SDK v25 object model where useful:

`https://help.ascon.ru/KOMPAS_SDK/25/ru-RU/kompasapiobjecttypeenum.html`

The SDK is especially useful for confirming document families and underlying engineering object families such as associative views, specification objects, holes, chamfers, fillets, shells, Boolean operations, loft/evolution operations, surfaces, sheet-metal objects and assembly-related types.

KOMPAS proprietary icons/artwork are not imported. ASA copies interaction concepts, terminology/grouping where useful, and implements its own visual assets.

## Audited workspace map

### System / common UI

Covered:

- New/Open/Save/Save As/Print;
- Undo/Redo/Rebuild;
- command search;
- application/document settings;
- panel visibility;
- Copy Properties;
- Quick Access behavior.

Implementation authority remains `docs/UI_COMMAND_SPEC.md` and the ASA command registry.

### View / selection / graphical area

Covered:

- Fit;
- standard orientations;
- isometric orientation;
- normal/aligned orientation;
- projection/display modes;
- object filters;
- selection by properties;
- contextual Quick Access behavior.

Interaction semantics are defined in `docs/WORKSPACE_INTERACTION_SPEC.md`.

### Sketch / shared 2D geometry

Covered command families:

- point/line/polyline/circle/arc/rectangle/polygon/ellipse/spline;
- auxiliary horizontal/vertical/tangent geometry;
- trim/extend/split/offset;
- fillet/chamfer;
- mirror/move/rotate/scale;
- grid/circular arrays;
- projected/reference geometry;
- construction geometry;
- coincidence/horizontal/vertical/parallel/perpendicular/tangent/concentric/equal/symmetric/fixed/point-on-curve constraints;
- auto, linear, radius, diameter, angular and advanced/broken/level dimension families.

M2/M3 implement the school-first subset; advanced variants remain traceable in the inventory.

### Part / solid modeling

Covered:

- Create Sketch;
- Extrude / Cut Extrude;
- Revolve / Cut Revolve;
- Sweep / Cut Sweep;
- Loft / Cut Loft;
- Boolean union/subtract/intersect lane;
- Hole family;
- Fillet / Chamfer;
- Shell / Rib / Draft;
- split body;
- relief;
- grid/concentric/path/mirror pattern families;
- geometry collections;
- datum planes/axes/points;
- control/connection points;
- geometry checks and measurements;
- variables;
- linked drawing management.

Official v25 help confirms the command/parameter-panel/phantom/Create/Finish lifecycle for key Part operations, including Extrude and Shell.

### Assembly

Covered:

- insert component;
- create Part/subassembly/local Part in place;
- contextual component editing;
- replace/update component source/version;
- move/rotate/change position;
- fix/unfix;
- coincidence, concentricity, parallelism, perpendicularity, tangency, distance and angle mates;
- dependent position;
- advanced symmetric/transmission/cam mate families retained for later parity;
- component pattern families;
- geometry/interference diagnostics;
- linked drawings/specification.

The first ASA Assembly milestone intentionally implements a smaller stable mate set. Advanced families remain explicit inventory rows rather than being forgotten.

### Drawing / Fragment

Covered:

- new/base/projected/isometric/section/detail view families;
- explicit view update;
- shared 2D drafting geometry;
- dimension families;
- centerline/centermark/leader/roughness/form-tolerance/position/base/table annotations;
- hatch/layers/sheets;
- DXF/DWG/SVG/PDF/raster export.

Drawing and Fragment share one ASA 2D engine; Drawing adds sheets and associative model views.

### Specification

Covered:

- add section;
- add base object;
- add auxiliary object;
- product-composition/source linkage;
- positions;
- sort/group;
- export/document workflows.

### Text document

Covered:

- fragment/image insertion;
- tables;
- page-break/page/header/footer families;
- linked engineering-document workflow.

### Wireframe and surfaces — explicit advanced lane

Covered surface families include:

- extrusion;
- revolution;
- path/sweep;
- sections/loft;
- curve network;
- point network / point sheet;
- ruled surfaces;
- patch;
- middle surface;
- offset surface;
- connecting surface;
- conic-section surface;
- trimming;
- sewing;
- face removal;
- surface-intersection curve;
- spline on surface.

Classification: `advanced`, milestone `M7+` unless deliberately promoted.

### Sheet metal — explicit advanced lane

Covered families include:

- Sheet Body;
- convert to sheet body;
- shell / ruled shell;
- plate;
- bend / bend by line / bend by sketch;
- flanging;
- jog;
- sheet cut/hole;
- open/closed/body stamping;
- bead/shoulder;
- louver;
- reinforcing rib;
- corner closure;
- unbend/rebend;
- unfold.

Classification: `advanced`, milestone `M7+` unless deliberately promoted.

## UI implementation rule

The inventory answers **what exists in the KOMPAS reference and how ASA classifies it**.

It does not directly render UI. A command becomes an ASA product command only when it receives:

1. stable ASA command ID;
2. document/workspace/group placement;
3. enable predicate;
4. parameter/selection contract;
5. layout/overflow/mobile metadata;
6. ASA-owned icon key;
7. implementation milestone;
8. deterministic fixture/test;
9. implemented status.

These fields are governed by:

- `docs/UI_COMMAND_SPEC.md`;
- `spec/ui/command-registry.v1.json` and later versions;
- `spec/ui/layout-registry.v2.json`;
- `docs/M2_VISUAL_ACCEPTANCE.md`.

## Drift policy

KOMPAS v25 is the reference baseline for the first ASA-CAD UI program. When the reference version changes:

1. diff official help/new-features information;
2. add newly discovered commands to the machine inventory;
3. classify them explicitly;
4. do not reorder existing ASA product commands automatically;
5. promote a command into the ASA command registry only through a deliberate roadmap/spec change.

The inventory is complete enough for the current ASA-CAD planning baseline: M2/M3/M4/M4A/M6/M6A no longer need to rediscover the built-in engineering surface from memory. Application-specific extensions/plugins and future KOMPAS versions are audited only when ASA deliberately adopts them.
