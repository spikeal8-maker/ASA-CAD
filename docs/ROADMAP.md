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

## M1U — KOMPAS v25 command/UI inventory

**Status: DONE for current built-in engineering baseline; maintained on reference-version changes**  
Tracking: #16

Delivered:
- human inventory `docs/KOMPAS_UI_INVENTORY.md`;
- machine inventory `spec/ui/kompas-command-inventory.v25.json`;
- 211 classified command/control rows across system/view/Sketch/Part/Assembly/Drawing/Fragment/Specification/Text plus advanced Surfaces and Sheet Metal lanes;
- explicit `core-now | planned | advanced | not-in-ASA-scope` policy;
- Boolean and advanced Assembly mate families retained as later parity rather than omitted;
- official v25 help + SDK cross-check policy.

Future KOMPAS releases or deliberately adopted application/plugin surfaces create inventory-drift work; they do not reopen the current baseline automatically.

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

Binding machine layout: `spec/ui/layout-registry.v2.json`.

Build from ASA-owned components:
- Main Menu;
- DocumentTabs;
- six-kind New Document dialog;
- Workspace/Instrument area + command groups;
- management-panel rail/block;
- central WorkArea host;
- contextual Viewport Quick Access Bar;
- ParameterPanel / Tree / Variables panel switching;
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
- 1920x720 height stress;
- browser zoom 100/125/150/200%, 80% best effort;
- required phone/tablet viewports.

Acceptance: no clipping/unreachable commands, no microscopic text, no double-scaling on 4K, bounded panels/groups, correct picking after zoom/UI-scale/layout changes.

---

## M2V — KOMPAS reference mapping and visual composition

**Status: REFERENCE BASELINE DONE; implementation-time visual acceptance waits for M2 fixtures**  
Tracking: #19

Already delivered:
- `KOMPAS_SHELL_LAYOUT_SPEC.md`;
- populated official-help reference manifest `spec/ui/visual-reference-manifest.v1.json`;
- exact structural decisions for management panels and graphical Quick Access;
- machine layout registry v2;
- reference slots for owner screenshots when exact installed-KOMPAS spacing/appearance is desired.

Still requires the actual M2 UI:
- build deterministic ASA fixtures;
- capture ASA screenshots;
- compare at Full HD baseline and responsive matrix;
- use owner screenshots where exact local KOMPAS visual tuning is requested;
- record deliberate differences;
- pass visual review.

This is no longer a specification blocker; it is an implementation/acceptance lane.

---

## M3 — Parametric Sketch foundation

**Status: BLOCKED by M1/M2 foundation**  
Tracking: #5

Implement full first-wave Sketch geometry, constraints, driving dimensions, solver diagnostics, save/reopen and corresponding desktop/mobile controls.

---

## M4 — Part Design and stable topology references

**Status: BLOCKED by M3**  
Tracking: #6

Implement first-wave Part features, stable logical references, dependency/recompute diagnostics and compatibility fixtures.

---

## M4A — Assembly foundation

**Status: BLOCKED by stable Part/reference semantics**  
Tracking: #11

Implement bottom-up + top-down Assembly, components/subassemblies, context Part editing, mates, occurrence/version semantics and protected Assembly regression.

---

## M4B — Standalone beta/release hardening

**Status: BLOCKED by M4/M4A**  
Tracking: #7

Produce versioned `asa-cad-web` release image, compatibility corpus, browser E2E, cleanup/recovery and target-device capability/performance matrix.

---

## M5 — ASA Lab integration

**Status: BLOCKED by M1B/M4B**  
Tracking: #8

Deploy pinned `asa-cad-web` behind `/cad/*`, connect Project Core/classes/assignments/versions/submission/teacher review, preserve local client computation.

---

## M6 — Drawing + Fragment

**Status: later document lane**  
Tracking: #13

Shared ASA 2D engine, sheets/associative views/dimensions/annotations/Fragment reuse/export.

---

## M6A — Specification + Text

**Status: later document lane**  
Tracking: #14

Structured specification/BOM and engineering Text documents with links/versioning/export.

---

## M7+ — Broader KOMPAS parity/settings/exchange

Tracking: #9

Promote advanced commands from the maintained KOMPAS inventory, including surfaces, sheet metal, advanced mates, advanced drawing symbols, variables/templates/exchange as deliberately prioritized.

---

# Release gates

- **Gate A — ASA CAD Core:** M0 + core M0D + M1; M1U baseline done.
- **Gate B — ASA CAD Editor Alpha:** M1B + M2 + M2A + M2I + M2R + M2V visual acceptance + M3.
- **Gate C — ASA CAD Standalone Beta:** M4 + M4A + M4B.
- **Gate D — ASA Lab CAD Module:** M5.
- **Gate E — Engineering Documentation Suite:** M6 + M6A.
- **Gate F — Broader parity:** M7+ iterative.

# Immediate next work

1. Finish #1 protected Part workflow CI fixture.
2. Finish #12 real-browser Docker boot/protected Part workflow.
3. Start #2 M1 `CadDocument` / `CadApplication` / command boundary.
4. Then start #3 M2 using the already-defined command, layout, display, input and visual-reference contracts.

Specification work should not delay those code steps unless implementation exposes a genuinely new unresolved requirement.
