# ASA-CAD files, settings and export contract

This document defines what ASA-CAD saves, what users can configure, and which exchange/export formats belong to each document kind.

## 1. Native project authority

Inside ASA Lab, the authoritative saved object is the structured ASA `CadDocument` stored through Project Core revisions/versions.

The native document is never only:
- STL;
- STEP;
- PDF;
- SVG;
- screenshot;
- Three.js meshes;
- OpenCascade pointers.

Those are derived/export forms.

For standalone download/import, the first native exchange form should be a versioned JSON document:

```text
*.asacad.json
```

Later, if projects need embedded attachments/previews, introduce a packaged container such as `*.asacad` only with an explicit manifest/version/migration design. Do not invent a binary container early.

## 2. Common document metadata

All document kinds should support common metadata where applicable:
- title/name;
- designation/code;
- author/owner;
- description;
- created/updated timestamps;
- units;
- schema version;
- ASA-CAD engine version;
- document kind;
- template/profile identity;
- linked documents;
- optional educational assignment context supplied by ASA Lab.

## 3. Part file/exchange support

Authoritative:
- ASA `CadPartDocument`.

Import/export targets:
- STEP/STP — primary exact solid/surface exchange;
- IGES/IGS — secondary surface/legacy exchange;
- BREP — developer/exact-kernel diagnostic exchange where reliable;
- STL — mesh export for 3D printing, not parametric authority;
- OBJ/GLTF/GLB later for visualization where useful;
- native ASA JSON.

Import of STEP/IGES creates imported geometry/features according to the importer contract. It does not magically reconstruct another CAD system's full parametric history.

## 4. Assembly file/exchange support

Authoritative:
- ASA `CadAssemblyDocument` plus pinned component references/versions.

Exports:
- STEP assembly when runtime support is proven;
- flattened STEP as an explicit option;
- STL/GLTF/GLB for visualization/printing only where sensible;
- BOM/specification export through the Specification document, not ad-hoc hidden CSV logic;
- native ASA JSON/package preserving component identities.

A flattened export is not a replacement for the editable Assembly document.

## 5. Drawing file/exchange support

Authoritative:
- ASA `CadDrawingDocument`.

Exports:
- PDF — primary printable output;
- SVG — vector web/output;
- DXF — engineering 2D interchange;
- PNG/JPEG — raster preview/export;
- DWG later only if a technically reliable and legally suitable library/service-free client path is selected.

Import:
- SVG/DXF where supported by the shared 2D engine;
- imported objects must retain clear provenance and unsupported constructs must be reported.

## 6. Fragment file/exchange support

Authoritative:
- ASA `CadFragmentDocument`.

Import/export:
- SVG;
- DXF;
- native ASA JSON;
- reusable insertion into Drawing/other supported ASA 2D contexts.

## 7. Specification file/exchange support

Authoritative:
- ASA `CadSpecificationDocument`.

Exports:
- PDF;
- XLSX;
- CSV;
- printable HTML if useful;
- native ASA JSON.

The Specification keeps structured rows/sections/source links. XLSX/CSV are exchange copies, not the project authority.

## 8. Text document file/exchange support

Authoritative:
- ASA `CadTextDocument`.

Exports:
- PDF;
- HTML where useful;
- DOCX may be evaluated later if formatting fidelity is acceptable;
- native ASA JSON.

## 9. Settings model

Settings are split into three levels.

### A. Application/user settings

Stored per user/browser or ASA Lab profile:
- light/dark/system theme;
- UI density/scale;
- language;
- default units;
- mouse/navigation scheme;
- selection highlight preferences;
- grid/snap defaults;
- autosave indicators/behavior within allowed product policy;
- rendering quality preference;
- recent templates.

### B. Document settings

Stored inside the document because they affect interpretation/output:
- units and numeric precision;
- document standard/profile;
- model/drawing scale where applicable;
- layers/styles;
- drawing sheet formats;
- title-block/template identity;
- dimension/text/line style profile;
- projection convention;
- tolerances/defaults when implemented;
- material/properties where applicable.

### C. Session/view settings

May be saved optionally but do not define engineering intent:
- camera position;
- panel widths;
- expanded/collapsed tree nodes;
- active tab;
- temporary selection;
- viewport shading mode;
- local grid visibility.

Session/view state must never be mixed with authoritative geometry so heavily that a UI migration corrupts the model.

## 10. Appearance architecture

ASA-CAD UI must have ASA-owned design tokens rather than hard-coded vendor styles throughout feature code.

Target token groups:
- typography;
- spacing/density;
- panel/background/surface colors;
- command active/hover/disabled states;
- selection/preselection colors;
- error/warning/rebuild states;
- sketch under/fully-constrained states;
- tree indentation/row height;
- viewport background/grid;
- dimension/annotation colors;
- z-index/layering.

This allows the user to say, for example:

```text
"На странице Деталь сделай левое дерево уже, параметры справа шире,
верхнюю панель ближе к КОМПАС, фон рабочей области светлее."
```

and lets an agent change the shell/tokens/components without touching OpenCascade algorithms.

## 11. Save states shown to the user

The shell should explicitly show:
- `Изменено`;
- `Сохранение...`;
- `Сохранено`;
- `Нет сети — сохранено локально`;
- `Конфликт версии`;
- `Ошибка сохранения`.

Geometry recompute status is separate:
- `Перестроено`;
- `Перестроение...`;
- `Предупреждение`;
- `Ошибка перестроения`.

Do not report `Сохранено` before the host/server acknowledges the revision when running inside ASA Lab.

## 12. Version/export rule

Exports should state what source revision/version produced them when possible. A teacher/submission workflow must pin the native document version first; PDF/STEP/STL are outputs of that pinned state, not substitutes for it.
