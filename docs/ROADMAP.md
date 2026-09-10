# ASA-CAD implementation roadmap

`docs/SYSTEM_SPEC.md` defines the end state. This file defines implementation order, current status and release gates.

## Program rules

1. Preserve the protected Part workflow through every milestone.
2. After Assembly exists, preserve the protected Assembly workflow too.
3. Product UI uses ASA-owned `CadApplication`/command/document contracts, never raw vendor UI/store internals.
4. CAD math remains on the active client device.
5. ASA-CAD remains independently runnable/testable in its own frontend Docker image.
6. Saved `CadDocument` compatibility is a release boundary.
7. Upstream Toubkal changes are pinned/intentional, never auto-merged.
8. Permanent UI is ASA-owned code; Toubkal UI is diagnostic/reference only.
9. M2 visual completion requires command, interaction, display/DPI/mobile and KOMPAS-reference gates — not one screenshot.
10. Do not reopen completed M0/M1 architecture work unless a failing regression proves the boundary itself is wrong.

---

## M0 — Reproducible imported CAD baseline

**Status: DONE**  
Tracking: #1

Accepted:
- pinned Toubkal baseline under `vendor/toubkal`;
- exact upstream revision recorded;
- clean install/build/lint/regression CI;
- ASA-owned protected Part regression:
  `Sketch 60x40 -> Extrude 10 -> centered Ø12 cut -> Fillet R1 -> 60->80 -> recompute -> serialize/reopen/rebuild`;
- license/third-party notice verification.

---

## M0D — Standalone Docker/browser test surface

**Status: DONE**  
Tracking: #12

Accepted:
- root Dockerfile + Caddy + Compose;
- production-like standalone run on `http://localhost:8088`;
- same release artifact can mount under `/cad/*`;
- CAD-local COOP/COEP;
- lazy OpenCascade/WASM boot;
- health/deep-route checks;
- full protected Part workflow in real Chromium inside the release container;
- no CAD compute backend/database.

Future Assembly E2E belongs to M4A/M4B, not to reopening M0D.

---

## M1 — ASA-owned document/application/command boundary

**Status: DONE**  
Tracking: #2

Accepted:
- six-kind `CadDocument` union;
- parser/serializer/migration boundary;
- stable ASA IDs;
- `CadApplication` typed command/state API;
- undo/redo/rebuild;
- OpenCascade runtime adapter;
- PlaneGCS sketch-solver adapter;
- StableRef capture/resolve boundary;
- measurement/render contracts;
- Assembly reference boundary;
- command-registry linkage;
- architecture regression forbidding raw vendor/OCC/store imports in public application/contracts.

M2 can build UI without reaching raw OCC/Toubkal internals.

---

## M1U — KOMPAS v25 command/UI inventory

**Status: DONE for the current v25 baseline; maintained on reference-version changes**  
Tracking: #16

Delivered:
- `docs/KOMPAS_UI_INVENTORY.md`;
- `spec/ui/kompas-command-inventory.v25.json`;
- 211 classified command/control rows;
- `core-now | planned | advanced | not-in-ASA-scope` policy;
- Part/Sketch/Assembly/Drawing/Fragment/Specification/Text plus Surfaces/Sheet Metal coverage;
- official-help + SDK cross-check policy.

---

## M1B — Client runtime/container/ASA Lab host contract

**Status: DONE**  
Tracking: #4

Accepted:
- capability probe independent of screen size;
- `full | constrained | unsupported` tiers;
- lazy runtime loader;
- editor/viewer mount contracts;
- `/cad/projects/:projectId` and `/cad/view/:versionId` routes;
- standalone + ASA Lab `CadProjectHost` adapters;
- ASA Lab Project Core GET/draft/snapshot mapping;
- IndexedDB recovery + pending mutation retry;
- versioned release manifest;
- content-hashed/lazy WASM;
- `/cad/` base-path support;
- no geometry/rebuild/solve RPC path;
- isolation headers confined to CAD surface.

Actual ASA Lab deployment remains M5.

---

# M2 program — Permanent ASA KOMPAS-oriented shell

M2 is the current implementation program. The protected Part functional slice is accepted; visual/interaction/responsive acceptance remains coordinated through #15/#17/#18/#19.

## M2 — Core shell and protected Part vertical slice

**Status: ACTIVE — functional protected Part slice accepted**  
Tracking: #3

Already working through ASA-owned UI:
- Main Menu/global bar;
- document tabs + six-kind New Document dialog;
- command search;
- KOMPAS-oriented instrument/ribbon area;
- Tree/Parameters management surfaces;
- central WorkArea + Three.js viewport;
- contextual Quick Access;
- StatusBar;
- New/Open/Save;
- Undo/Redo/Rebuild;
- Fit + standard views;
- Create Sketch;
- rectangle/circle + driving dimensions;
- Finish Sketch;
- Extrude;
- face StableRef -> second sketch;
- Ø12 through cut;
- edge StableRef -> fillet R1;
- width 60->80 downstream recompute;
- save/reopen native parametric document;
- reopened Ø12->Ø14 edit without losing downstream fillet.

Binding machine layout: `spec/ui/layout-registry.v2.json`.

M2 remains open until the applicable M2A/M2I/M2R/M2V gates below are accepted.

---

## M2A — Deterministic demo routes and owner review loop

**Status: ACTIVE — technical Part fixtures ready; visual owner acceptance remains**  
Tracking: #15

Implemented and browser-proven:
- `/dev/part/empty` — clean shell, no WASM;
- `/dev/part/sketch` — 60×40 parametric sketch, no WASM;
- `/dev/part/extrude` — real 60×40×10 OCC B-Rep;
- `/dev/part/reference` — cut + fillet rebuilt from StableRefs;
- `/dev/part/rebuild-error` — real recompute failure state.

The deep-route asset/base contract works independently and in production `/cad/*` mount form.

Remaining before M2A acceptance:
- capture deterministic reference screenshots;
- map each required screenshot to `visual-reference-manifest.v1.json`;
- owner visual review/correction loop;
- add later document fixtures as those editors arrive.

---

## M2I — Workspace, keyboard, touch and mobile/hybrid input

**Status: ACTIVE**  
Tracking: #17

Browser-proven now:
- Three.js viewport over kernel-neutral `CadRenderModel`;
- left click reserved for CAD selection;
- wheel zoom / middle pan / right orbit;
- face/edge hover/preselection;
- camera preserved across B-Rep rebuild;
- Fit + front/back/top/bottom/left/right/isometric;
- central `ShortcutRegistry`;
- Ctrl+S, Ctrl+Z/Y/Shift+Z, Esc, Ctrl+Enter, F5;
- camera-only F/0/1/2/3, Ctrl +/- and arrow navigation;
- numeric/text focus safety;
- browser-reserved shortcut protection;
- ordinary body selection synchronized viewport <-> Tree by stable ASA `bodyId`;
- command-specific face/edge picking kept separate from ordinary selection.

Remaining M2I:
- Ctrl/Shift multi-selection;
- enclosing/crossing selection rectangle;
- feature/subshape selection levels + typed invalid-selection feedback;
- ambiguous-hit candidate chooser/cycling;
- stationary right-click context menu distinct from orbit drag;
- mobile command discovery parity and Tree/Parameters/Tools sheets/drawers;
- real touch E2E and hybrid input regression;
- portrait/landscape active-state preservation;
- software-keyboard handling;
- transient feature preview/phantom;
- focus selected; optional perspective/orthographic mode later.

---

## M2R — HD/FHD/2K/4K/DPI/browser-zoom/UI-Scale

**Status: ACTIVE — implementation complete enough for final CI acceptance; current gate being stabilized**  
Tracking: #18

Implemented:
- binding effective-viewport matrix from `spec/ui/viewport-matrix.v1.json`;
- responsive overrides isolated in `src/web/responsive.css`;
- portrait-tablet panel reflow preserving WorkArea width;
- low-height phone-landscape composition;
- phone root/grid width protection for correct pointer coordinates;
- token-based UI Scale `Auto | 90 | 100 | 110 | 125 | 150`;
- persisted UI Scale preference;
- visible desktop settings dialog + phone bottom-sheet entry;
- UI Scale does not transform CAD geometry/camera coordinates;
- FHD/2K/ultrawide/4K/DPR comparisons;
- B-Rep picking regression across UI Scale changes;
- browser-zoom effective CSS viewport/DPR equivalence regression.

Acceptance requires all M2 browser gates green together. Do not close #18 merely because individual matrix cases pass.

---

## M2V — KOMPAS reference mapping and visual composition

**Status: ACTIVE acceptance lane — reference baseline ready, ASA visual comparison remains**  
Tracking: #19

Already delivered:
- `KOMPAS_SHELL_LAYOUT_SPEC.md`;
- populated official-help reference manifest;
- management-panel / graphical Quick Access placement rules;
- machine layout registry v2;
- reference slots for owner screenshots.

Remaining:
- capture ASA fixture screenshots at required baseline states;
- compare hierarchy/spacing/command composition against chosen KOMPAS references;
- use owner screenshots for exact installed-KOMPAS tuning where required;
- document deliberate differences;
- owner visual acceptance across responsive variants.

---

## M3 — Parametric Sketch foundation

**Status: NEXT FEATURE LANE after M2 acceptance path is controlled**  
Tracking: #5

Implement the complete first-wave Sketch editor:
- line/arc/circle/rectangle/polygon/construction geometry;
- trim/extend/offset/project;
- coincidence/horizontal/vertical/parallel/perpendicular/tangent/concentric/equal/symmetry/fix/point-on-curve;
- linear/horizontal/vertical/angular/radial/diameter driving dimensions;
- solver/DOF/overconstraint diagnostics;
- save/reopen and corresponding desktop/mobile controls.

---

## M4 — Part Design and stable topology references

**Status: BLOCKED by M3 foundation**  
Tracking: #6

Extend Part features and stable-reference/rebuild diagnostics: revolve, sweep, loft, hole variants, rib, shell, draft, chamfer/fillet families, mirror/linear/circular patterns and auxiliary geometry.

---

## M4A — Assembly foundation

**Status: BLOCKED by stable Part/reference semantics**  
Tracking: #11

Implement bottom-up + top-down Assembly, components/subassemblies, in-context Part editing, mates, occurrence/version semantics and protected Assembly regression.

---

## M4B — Standalone beta/release hardening

**Status: BLOCKED by M4/M4A**  
Tracking: #7

Produce versioned `asa-cad-web` beta image, compatibility corpus, target-device performance/capability matrix, cleanup/recovery and full browser E2E.

---

## M5 — ASA Lab integration

**Status: BLOCKED by M4B; host contract already prepared in M1B**  
Tracking: #8

Deploy pinned `asa-cad-web` behind ASA Lab `/cad/*`, connect Project Core/classes/assignments/versions/submission/teacher review and prove unrelated ASA Lab pages do not request CAD WASM.

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

Promote advanced commands from the maintained KOMPAS inventory, including surfaces, sheet metal, advanced mates, drawing symbols, variables/templates/exchange as deliberately prioritized.

---

# Release gates

- **Gate A — ASA CAD Core: DONE.** M0 + M0D + M1 + M1U + M1B accepted.
- **Gate B — ASA CAD Editor Alpha: ACTIVE.** M2 + M2A + M2I + M2R + M2V + M3.
- **Gate C — ASA CAD Standalone Beta:** M4 + M4A + M4B.
- **Gate D — ASA Lab CAD Module:** M5.
- **Gate E — Engineering Documentation Suite:** M6 + M6A.
- **Gate F — Broader parity:** M7+ iterative.

# Immediate next work

1. Stabilize and accept #18 M2R on one all-green browser run.
2. Continue #17 mobile/touch interaction: command discovery, drawers/sheets, real touch E2E, orientation/software-keyboard behavior.
3. Execute #19 KOMPAS visual-reference comparison using deterministic #15 fixtures and owner review.
4. Close the coordinated M2 visual baseline only when #15/#17/#18/#19 evidence agrees.
5. Then expand M3 sketch functionality without breaking the protected Part regression.

Specification work should not delay those code steps unless implementation exposes a genuinely new unresolved requirement.
