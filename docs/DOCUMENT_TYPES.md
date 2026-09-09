# ASA-CAD document system

This document defines the user-visible CAD document types and their responsibilities. It is a product contract, not a description of the current imported vendor UI.

## 1. One CAD product, six primary document kinds

ASA Lab registers one engineering CAD module:

```text
moduleKey: cad
projectType: cad-document
```

The user creates one of these primary document kinds:

```text
Создать
|- Деталь
|- Сборка
|- Чертеж
|- Фрагмент
|- Спецификация
`- Текстовый документ
```

The ASA-owned serialized union is:

```ts
type CadDocument =
  | CadPartDocument
  | CadAssemblyDocument
  | CadDrawingDocument
  | CadFragmentDocument
  | CadSpecificationDocument
  | CadTextDocument;

type CadDocumentKind =
  | 'part'
  | 'assembly'
  | 'drawing'
  | 'fragment'
  | 'specification'
  | 'text';
```

All kinds use the same ASA-CAD application shell, document tabs, save/version mechanism and ASA Lab project infrastructure, but each kind exposes its own commands, tree and panels.

---

## 2. Деталь / Part

### Purpose

A Part is one parametric engineering component. It owns its construction history.

```text
Деталь
|- Начало координат
|- Эскиз 1
|- Выдавливание 1
|- Эскиз 2
|- Вырезать выдавливанием 1
|- Массив 1
`- Скругление 1
```

### Authoritative saved content

```text
CadPartDocument
|- kind: part
|- schemaVersion
|- engineVersion
|- units
|- metadata
|- material/properties
|- variables/expressions
|- origin/datum geometry
|- sketches
|  |- geometry
|  |- constraints
|  `- driving dimensions
|- features/history
|- bodies
|- stable references
`- optional editor/view state
```

### Main command groups

Sketch:
- line, polyline;
- circle, arc;
- rectangle, polygon;
- trim, extend, offset;
- construction/center lines;
- project/reference geometry.

Constraints:
- coincident;
- horizontal/vertical;
- parallel/perpendicular;
- tangent;
- concentric;
- equal;
- symmetric;
- fixed;
- point-on-curve.

Dimensions:
- linear/horizontal/vertical;
- angular;
- radius/diameter.

Part features:
- extrusion / cut extrusion;
- revolution / cut revolution;
- hole;
- fillet/chamfer;
- mirror;
- linear/circular pattern;
- later: sweep, loft, shell, rib, draft, datum geometry.

Model utilities:
- selection/filtering;
- measure;
- section/display modes;
- material/properties;
- variables/expressions;
- recompute diagnostics.

### Important rule

A Part is not stored as STL/mesh. The parametric recipe is authoritative; B-Rep and render meshes are derived runtime data.

---

## 3. Сборка / Assembly

### Purpose

An Assembly combines Parts and subassemblies, places component occurrences, and stores assembly constraints/mates.

```text
Сборка
|- Деталь A:1
|- Деталь B:1
|- Болт:1
|- Болт:2
|- Подсборка C:1
`- Сопряжения
   |- Совпадение 1
   |- Соосность 1
   `- Расстояние 1
```

### Authoritative saved content

```text
CadAssemblyDocument
|- kind: assembly
|- schemaVersion
|- engineVersion
|- units
|- metadata
|- variables
|- components/occurrences
|  |- occurrenceId
|  |- component source reference
|  |- pinned revision/version
|  |- transform
|  |- visibility/suppression
|  `- instance metadata
|- mates/assembly constraints
|- subassemblies
|- assembly reference geometry
|- contextual references
|- optional exploded/view state
`- editor state
```

### Assembly must support both design directions

#### Bottom-up / Снизу вверх

1. Create Parts separately.
2. Create Assembly.
3. Insert existing Parts/subassemblies.
4. Position with mates.

#### Top-down / Сверху вниз

1. Open an Assembly.
2. Choose `Создать деталь` or `Создать подсборку`.
3. Create the component in the context of the Assembly.
4. Other components remain visible and selectable as reference geometry.
5. Enter contextual Part editing using the normal Part feature toolset.
6. Finish contextual editing and return to Assembly mode.

This is mandatory. Assembly is not limited to dragging already finished blocks.

### Context editing contract

When editing a Part inside Assembly:

- the active component is editable;
- other components are visible but normally read-only;
- faces/edges/planes of other components may be used as references;
- contextual dependencies are stored explicitly;
- deleting or changing an external reference must produce a clear rebuild/reference error;
- the system must never silently attach the feature to a different face/edge.

### Component creation choices

First supported form:

- **Create external Part/subassembly** — creates a normal ASA-CAD child project/document and inserts it as an occurrence.

Later, if justified:

- **Local component** — geometry/document owned entirely by the Assembly document.

External components are the default because they are independently reusable, versionable, assignable and drawable.

### Main Assembly command groups

Components:
- insert existing Part;
- insert subassembly;
- create Part in place;
- create subassembly in place;
- open/edit component;
- replace component;
- explicitly update component version;
- duplicate occurrence;
- suppress/unsuppress;
- hide/show;
- fix/unfix;
- move/rotate.

Mates/constraints:
- coincident/planar;
- concentric;
- parallel;
- perpendicular;
- distance;
- angle;
- fixed component;
- later: limits/ranges and advanced mechanical constraints.

Assembly utilities:
- component tree;
- mate tree/status;
- interference/collision checks later;
- exploded view later;
- component patterns later;
- product/BOM metadata;
- measurements.

### What Assembly saves and what it does not

Assembly saves design intent and exact component identities/versions. It does not flatten every child Part into one opaque mesh.

A submitted/published Assembly version must be reproducible: every external component dependency required to rebuild that version is pinned.

See `docs/ASSEMBLIES.md` for detailed version semantics.

---

## 4. Чертеж / Drawing

### Purpose

A Drawing is a sheet-based 2D engineering document. It can be created manually, but the primary ASA teaching workflow is an associative drawing derived from a Part or Assembly.

```text
Чертеж
|- Лист 1: A4/A3/...
|  |- Основная надпись
|  |- Главный вид
|  |- Вид сверху
|  |- Вид слева
|  |- Разрез A-A
|  |- Размеры
|  |- Обозначения
|  `- Технические требования
`- Лист 2 ...
```

### Authoritative saved content

```text
CadDrawingDocument
|- kind: drawing
|- schemaVersion
|- drawing standard/profile
|- sheets
|  |- format/size/orientation
|  |- frame/title block
|  |- views
|  |- 2D geometry
|  |- dimensions
|  |- annotations/symbols
|  `- layers
|- model references
|  |- source project/document
|  `- pinned or tracked version policy
|- associative projection definitions
`- editor state
```

### First Drawing toolset

Sheets/layout:
- A4/A3/A2/A1/A0 and custom size;
- landscape/portrait;
- add/remove/reorder sheets;
- frame/title block;
- scale;
- layers.

Associative views:
- base/front view;
- projected views;
- isometric view;
- section/cut;
- detail view later;
- hidden-line/display options;
- update/rebuild from source model.

2D drafting:
- line/polyline;
- circle/arc;
- rectangle/polygon;
- trim/extend/offset;
- construction geometry;
- hatching.

Annotations:
- linear/angular/radius/diameter dimensions;
- center marks/center lines;
- leaders/callouts;
- text;
- tolerances/roughness/other standards-oriented symbols in later waves;
- technical requirements.

### Associativity rule

A Drawing must store which Part/Assembly version/view definition produced each associative view. Updating the model is an explicit, diagnosable operation; geometry must not silently jump to unrelated topology.

### Output

Primary practical outputs:
- PDF;
- SVG;
- DXF;
- later DWG if a legally/technically suitable implementation is selected;
- PNG/JPEG for previews, not as authoritative drawing format.

---

## 5. Фрагмент / Fragment

### Purpose

A Fragment is a reusable 2D graphic workspace without engineering sheet framing/title block. It is useful for sketches, draft studies, reusable typical geometry and educational exercises.

```text
Фрагмент
|- 2D geometry
|- constraints/dimensions where enabled
|- layers/styles
`- reusable insertion metadata
```

### Difference from Drawing

Fragment:
- has no required sheet frame/title block;
- is not a multi-sheet official drawing;
- focuses on reusable/draft 2D geometry;
- can later be inserted/reused in Drawing or other supported 2D contexts.

### Initial toolset

Reuse the same ASA-owned 2D drafting primitives where possible:
- line/polyline;
- circles/arcs;
- rectangles/polygons;
- trim/extend/offset;
- constraints/dimensions where useful;
- hatching;
- text;
- layers;
- import/export SVG/DXF where reliable.

The 2D geometry implementation should be shared with Drawing rather than implemented twice.

---

## 6. Спецификация / Specification

### Purpose

A Specification is a structured product-composition/BOM document, normally generated from an Assembly and optionally connected to its Drawing.

```text
Спецификация
|- Документация
|- Сборочные единицы
|- Детали
|- Стандартные изделия
|- Прочие изделия
|- Материалы
`- rows / positions / quantities / designations
```

### Authoritative saved content

```text
CadSpecificationDocument
|- kind: specification
|- schemaVersion
|- style/standard profile
|- source Assembly/Drawing references
|- sections
|- rows
|- position numbers
|- user overrides/notes
|- sorting/grouping settings
`- page/layout state
```

### Required behavior

- create manually or create from Assembly;
- derive component name/designation/quantity/properties from the Assembly;
- preserve links to exact source versions;
- group identical occurrences where rules allow;
- support sections and sorting;
- assign/show position numbers;
- connect positions back to Assembly/Drawing callouts later;
- regenerate with a visible diff/diagnostic rather than silently destroying user-edited fields.

### Output

- PDF;
- XLSX/CSV for practical tabular exchange;
- printable HTML/PDF representation;
- ASA native structured document remains authoritative.

---

## 7. Текстовый документ / Text document

### Purpose

A page-based engineering text document for notes, explanatory notes, technical requirements, instructions and other project documentation.

### Authoritative saved content

```text
CadTextDocument
|- kind: text
|- schemaVersion
|- pages
|- text/rich-text blocks
|- tables
|- images/figures if allowed
|- styles
|- headers/footers
|- frame/title block profile
|- document metadata
`- linked CAD documents
```

### Initial toolset

- paragraphs/headings;
- bold/italic/superscript/subscript;
- lists;
- tables;
- engineering symbols/special characters;
- page breaks;
- headers/footers;
- title block/document properties;
- links to Part/Assembly/Drawing/Specification projects;
- PDF export.

This should reuse ASA document/editor infrastructure where sensible rather than creating a CAD-kernel dependency for text editing.

---

## 8. Cross-document relationships

The important system is not only six editors; it is the links between them.

```text
Part ---------------------> Drawing
  \                           |
   \                          v
    +-----> Assembly ------> Specification
              |               ^
              +----> Drawing -+

Fragment ----> Drawing / reusable 2D content

Text document <---- links to any engineering document
```

Examples:

- Part `Bracket` -> Drawing `Bracket drawing`.
- Parts `Bracket`, `Bolt`, `Nut` -> Assembly `Bracket unit`.
- Assembly `Bracket unit` -> Assembly Drawing.
- Assembly + Drawing -> Specification.
- Technical note -> links to Drawing and Specification.

Cross-document references use ASA project/document IDs plus explicit revision/version semantics. A submitted learning result must reopen reproducibly.

---

## 9. New-document UI

The application-level Create command should eventually expose:

```text
Новый документ

[ Деталь ]       [ Сборка ]
[ Чертеж ]       [ Фрагмент ]
[ Спецификация ] [ Текстовый документ ]
```

Templates are a later but intended layer:

- Part template;
- Assembly template;
- A4/A3 Drawing templates;
- school/ESKD-oriented Drawing profile;
- Specification templates;
- Text document templates.

The selected document kind changes the ribbon/tool groups, tree and parameter panel. It does not launch a different unrelated application.

---

## 10. Implementation order

Document kinds are part of the end-state contract from M1 onward, but they are implemented in risk order:

1. Part foundation and protected parametric workflow.
2. Shared application shell/document tabs/create-document dialog.
3. Part sketcher + Part Design.
4. Assembly foundation + contextual Part/subassembly editing.
5. Shared 2D drafting engine.
6. Drawing with associative Part/Assembly views.
7. Fragment using the shared 2D engine.
8. Specification linked to Assembly/Drawing.
9. Text document.
10. Broader standards/templates/parity.

The schema union and document-kind routing must exist before all editors are complete, so later kinds do not require a destructive architecture rewrite.

---

## 11. Non-negotiable rules

- Do not treat every document as one generic scene JSON.
- Do not flatten assemblies into meshes as project authority.
- Do not make Drawing a screenshot of 3D.
- Do not make Specification a disconnected manually typed table only.
- Do not duplicate separate 2D geometry engines for Drawing and Fragment.
- Do not silently update external component/model references.
- Do not require the server to calculate CAD geometry.
- Do not copy proprietary KOMPAS code/assets; reproduce the educational workflow with ASA-owned code and permitted dependencies.
