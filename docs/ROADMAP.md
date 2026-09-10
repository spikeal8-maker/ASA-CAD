# ASA-CAD implementation roadmap

`docs/SYSTEM_SPEC.md` defines the end state. This file defines implementation order and release gates.

## Program rules

1. Preserve the protected Part workflow through every milestone.
2. After Assembly exists, preserve the protected Assembly workflow too.
3. Product UI uses ASA-owned `CadApplication`/command/document contracts, never raw vendor UI/store internals.
4. CAD math remains on the active client device.
5. ASA-CAD remains independently runnable/testable in its own frontend Docker image.
6. Saved `CadDocument` compatibility is a release boundary.
7. Upstream Toubkal changes are pinned/intentional, never auto-merged.
8. Permanent UI is new ASA-owned code; visible Toubkal UI is temporary diagnostic/reference surface only.
9. M2 visual completion requires command, interaction, display/DPI/mobile and KOMPAS-reference gates — not one screenshot.

---

## M0 — Reproducible imported CAD baseline

**Status: ACTIVE, foundation mostly complete**  
Tracking: #1

Done:
- pinned Toubkal baseline under `vendor/toubkal`;
- exact upstream baseline recorded;
- clean install/build/lint/regression CI;
- architecture/update contracts.

Remaining:
- ASA-owned protected Part fixture in CI:
  `Sketch 60x40 -> Extrude 10 -> centered Ø12 cut -> Fillet -> 60->80 -> recompute -> save -> reopen`;
- license/third-party notice verification.

Acceptance: protected Part is reproducible from clean checkout in CI.

---

## M0D — Standalone Docker/browser test surface

**Status: ACTIVE; image build/boot/health/header smoke is green**  
Tracking: #12

Already exists:
- root Dockerfile;
- Caddy;
- Compose;
- `http://localhost:8088`;
- CAD-local COOP/COEP headers;
- CI image build/start/health/static smoke.

Remaining:
- real-browser boot against Docker image;
- local/mock `CadProjectHost` as M1 stabilizes;
- protected Part browser E2E;
- later protected Assembly browser E2E.

Acceptance: the same release-like frontend image boots and performs protected workflow(s) in a real browser without ASA Lab/backend CAD compute.

---

## M1 — ASA-owned document/application/command boundary

**Status: NEXT after M0/M0D core gates**  
Tracking: #2

Define from the start:

```ts
type CadDocument =
  | CadPartDocument
  | CadAssemblyDocument
  | CadDrawingDocument
  | CadFragmentDocument
  | CadSpecificationDocument
  | CadTextDocument;
```

Deliver:
- schema/parser/serializer/migrations;
- stable ASA IDs;
- `CadApplication` typed command/state API;
- stable command IDs;
- runtime adapters around geometry/recompute/solver/picking;
- undo/redo;
- linked-document reference type;
- first Assembly reference boundary;
- protected Part workflow entirely through ASA API.

Acceptance: M2 can build its UI without reaching `window.oc`, raw OCC objects, vendor Zustand/events/components.

---

## M1U — Complete KOMPAS v25 command/UI inventory

**Status: can run in parallel with M1**  
Tracking: #16

Audit current official KOMPAS v25 functional surface by workspace/document.

Every discovered command receives:
- KOMPAS Russian name/group/control form;
- variants/parameters/selection prerequisites;
- ASA command ID where admitted;
- classification `core-now | planned | advanced | not-in-ASA-scope`;
- implementation milestone or explicit exclusion reason.

Acceptance: M2/M3/M4/M4A/M6/M6A do not rediscover button/group semantics from memory.

---

## M1B — Client runtime/container/ASA Lab host contract

**Status: design defined; implementation after stable M1 boundary**  
Tracking: #4

Prove:
- same versioned `asa-cad-web` form runs standalone and behind ASA Lab `/cad/*`;
- `CadProjectHost` persistence boundary;
- lazy/content-hashed WASM;
- device capability probe;
- browser cache/recovery;
- no normal geometry/assembly compute RPC;
- CAD-specific isolation headers do not become global ASA Lab requirements.

Acceptance: CAD runtime loads only for CAD and calculations execute locally.

---

# M2 program — Permanent ASA KOMPAS-oriented shell

M2 is intentionally split. Functional shell work can progress in parallel, but visual acceptance requires all applicable M2 subtracks.

## M2 — Core shell and protected Part vertical slice

**Status: BLOCKED by M1**  
Tracking: #3

Build from ASA-owned components:
- MainMenu / QuickAccess;
- DocumentTabs;
- six-kind New Document dialog;
- WorkspaceTabs/CommandGroups;
- DocumentTree;
- central WorkArea host;
- ParameterPanel;
- StatusBar;
- CommandSearch;
- responsive layout engine;
- deterministic command overflow;
- UI Scale tokens/settings.

First working commands:
- New/Open/Save;
- Undo/Redo/Rebuild;
- Fit + standard views;
- Create Sketch;
- Line/Rectangle/Circle required by protected workflow;
- required driving dimension;
- Finish Sketch;
- Extrude;
- Cut Extrude;
- Fillet.

For each command:
`API -> parameter/selection contract -> registry -> layout/mobile metadata -> control -> fixture -> browser/visual test`.

No production dead buttons.

---

## M2A — Deterministic demo routes and owner review loop

**Status: starts with first usable M2 shell, then ongoing**  
Tracking: #15

Create fixed development states such as:
- `/dev/part/empty`;
- `/dev/part/reference`;
- `/dev/part/rebuild-error`;
- later Assembly/Drawing/Fragment/Specification/Text states.

Owner loop:
`open exact URL -> identify defect -> agent edits ASA UI -> hot reload -> review -> regression`.

Acceptance: visual corrections do not require manually rebuilding a model or starting ASA Lab.

---

## M2I — Workspace, keyboard, touch and mobile/hybrid input

**Status: coordinated with M2**  
Tracking: #17

Contracts:
- `WORKSPACE_INTERACTION_SPEC.md`;
- `SHORTCUTS_SPEC.md`;
- `MOBILE_RESPONSIVE_SPEC.md`.

Implement:
- selection/preselection/typed picking;
- tree/viewport synchronization;
- orbit/pan/zoom;
- selection rectangles/candidate chooser;
- preview/phantom state;
- central ShortcutRegistry;
- mouse/keyboard/touch/hybrid input;
- phone/tablet AppFrame;
- Tree/Parameters/Tools drawers/bottom sheets;
- software-keyboard/safe-area handling;
- same command IDs and `CadDocument` on every device.

Acceptance: desktop and supported phone can navigate/select/operate implemented commands and save/reopen the same native Part document locally.

---

## M2R — HD/FHD/2K/4K/DPI/browser-zoom/UI-Scale

**Status: coordinated with M2**  
Tracking: #18

Binding contract: `DISPLAY_LAYOUT_SPEC.md` + `spec/ui/viewport-matrix.v1.json`.

Core rule: layout uses **effective CSS viewport width + height**, not raw physical monitor resolution.

Required regression includes:
- 1280x720;
- 1366x768;
- 1536x864;
- 1920x1080 baseline;
- 2560x1440;
- 3440x1440;
- 3840x2160 effective;
- representative 4K@150% effective 2560x1440;
- representative 4K@200% effective 1920x1080;
- short-wide 1920x720;
- browser zoom 100/125/150/200%, with 80% best-effort.

Rules:
- width and height both drive layout;
- command groups collapse/overflow before text shrinks below readability floor;
- side panels have min/default/max widths;
- central work area has priority;
- extra 2K/4K space primarily enlarges work area;
- ASA UI Scale does not globally transform CAD canvas/picking coordinates;
- vector product icons remain sharp at high DPR.

Acceptance: no essential command clipping/unreachability, no 4K double scaling, readable text and correct picking across matrix.

---

## M2V — KOMPAS visual reference mapping and shell composition

**Status: reference preparation begins during M1U; acceptance with M2**  
Tracking: #19

Binding contract: `VISUAL_REFERENCE_SPEC.md`.

For each required M2 state:
- KOMPAS v25 official/owner reference ID;
- document/workspace/active-command state;
- resolution/OS scale/browser zoom where known;
- measured hierarchy: top chrome, groups, tree, parameters, status;
- mapped deterministic ASA fixture;
- deliberate differences;
- owner review status.

Registry v2 adds deterministic workspace/group/command order, collapse priority, overflow, icon/tooltip, parameter schema and mobile placement.

Acceptance: visual parity is traceable and responsive, not subjective or tied to one screenshot.

---

## M3 — Parametric Sketcher

**Status: BLOCKED by stable M2 foundation**  
Tracking: #5

Complete first-wave:
- line/polyline/circle/arc/rectangle/polygon;
- trim/extend/offset/construction/project;
- coincident/horizontal/vertical/parallel/perpendicular/tangent/concentric/equal/symmetric/fixed/point-on-curve;
- linear/horizontal/vertical/angular/radius/diameter dimensions;
- under/fully constrained status and conflict diagnostics.

Every command must have desktop + mobile discovery path, parameter behavior and fixtures.

---

## M4 — Part Design + stable topology references

**Status: BLOCKED by M3**  
Tracking: #6

First wave:
- extrusion/cut;
- revolution/cut;
- hole;
- fillet/chamfer;
- mirror;
- linear/circular pattern.

Second wave:
- sweep/loft/shell/rib/draft;
- datum planes/axes/points.

Critical engineering:
- deterministic dependency/recompute graph;
- stable logical face/edge references;
- explicit unresolved-reference errors;
- no silent topology rebinding.

---

## M4A — Assembly + mates + in-context design

**Status: BLOCKED by stable Part/reference semantics**  
Tracking: #11

Implement:
- insert/create Part/subassembly;
- multiple occurrences;
- contextual Part editing with surrounding references;
- replace/update component;
- move/rotate/fix/suppress/visibility;
- coincident/concentric/parallel/perpendicular/distance/angle mates;
- pinned component versions;
- Assembly tree and protected workflow.

All solve/rebuild remains local.

---

## M4B — Standalone beta/release hardening

**Status: BLOCKED by M4 + M4A**  
Tracking: #7

Deliver versioned `asa-cad-web:<version>` with:
- public editor/viewer/document/application boundary;
- Part/Assembly compatibility corpus;
- browser E2E;
- memory/runtime cleanup;
- crash/recovery tests;
- real device/performance/capability matrix;
- stable first command/layout registry release.

---

## M5 — First-class ASA Lab integration

**Status: BLOCKED by M1B + M4B**  
Tracking: #8

Integrate pinned frontend under same public origin:
- `/cad/* -> asa-cad-web`;
- `/api/* -> asa-api`;
- one session/login;
- no CAD compute backend.

Product integration:
- module registration;
- project create/open/save;
- revisions/checkpoints;
- assignments/courses;
- submissions;
- teacher view/review;
- Assembly component-version resolution.

Do **not** redesign CAD shell during M5.

---

## M6 — Drawing + Fragment shared 2D engine

**Status: after stable model-reference contract; tracking #13**

Add:
- multi-sheet Drawing;
- formats/orientation/scale/frame/title block;
- associative Part/Assembly views;
- sections/cuts;
- 2D geometry/hatching/dimensions/annotations;
- explicit source-model updates;
- PDF/SVG/DXF;
- Fragment using same 2D engine without required sheet framing.

---

## M6A — Specification + Text documents

**Status: after document-link infrastructure; tracking #14**

Specification:
- structured Assembly-derived BOM/product composition;
- positions/sections/quantity/designation;
- refresh diff/diagnostics;
- PDF/XLSX/CSV.

Text:
- page-based engineering text;
- tables/symbols/page controls;
- links to engineering documents;
- PDF export.

---

## M7 — Broader KOMPAS parity/settings/exchange

**Status: iterative; tracking #9**

Examples:
- advanced surfaces/wireframe;
- sheet metal if admitted by #16 inventory;
- advanced Part/Assembly tools;
- drawings/tolerances/symbols;
- variables/expressions;
- templates/libraries;
- additional formats;
- curriculum-oriented workflows.

---

## M8 — Upstream update lane

**Status: ONGOING after M0**

For every Toubkal update:
1. pin source/target SHA;
2. classify diff by subsystem;
3. ignore vendor UI changes unless deliberately useful;
4. port selected runtime fixes through ASA adapters;
5. run vendor regressions + protected ASA workflows + compatibility corpus;
6. merge only after gates pass.

---

# Release gates

## Gate A — ASA CAD Core
M0 + core M0D + M1.

## Gate B — ASA CAD Editor Alpha
M1B + functional M2 + M2A + M2I + M2R + M2V + M3.

## Gate C — ASA CAD Standalone Beta
M4 + M4A + M4B.

## Gate D — ASA Lab CAD Module
M5.

## Gate E — Engineering Documentation Suite
M6 + M6A.

## Gate F — Broader KOMPAS teaching coverage
M7 iterative.

---

# Immediate next work

1. Finish #1 protected Part CI fixture.
2. Finish #12 real-browser Docker boot/protected workflow.
3. Start #2 M1 ASA `CadDocument`/`CadApplication`/command boundary.
4. Continue #16 KOMPAS v25 command inventory in parallel.
5. Populate #19 visual references before M2 visual freeze.
6. Build M2 shell from command/layout contracts, not by styling vendor UI.
7. Run #17/#18/#19 as coordinated M2 acceptance tracks before declaring the interface visually complete.
