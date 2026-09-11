# ASA-CAD current status

This file is the **single short current-state entry point** for humans and coding agents. It describes what is true on `main` now. Long-term product intent belongs to `SYSTEM_SPEC.md`; implementation order belongs to `ROADMAP.md`.

Last synchronized: 2026-09-11.

## Current phase

**Gate A — ASA CAD Core: DONE.**

Completed foundation:
- M0 imported/pinned CAD baseline;
- M0D standalone/release Docker browser surface;
- M1 ASA-owned `CadDocument` / `CadApplication` / command/runtime boundary;
- M1U KOMPAS v25 command inventory baseline;
- M1B lazy client runtime, recovery and ASA Lab host contract.

**Current program: M2 — permanent ASA-owned KOMPAS-oriented shell.**

**Active blocking optimization gate before M3: M2O — #21.**

Execution checklist: [`M2O_OPTIMIZATION_GATE.md`](M2O_OPTIMIZATION_GATE.md).

Tracking:
- #3 M2 core shell — ACTIVE;
- #15 M2A deterministic fixtures/visual review — ACTIVE;
- #17 M2I interaction/mobile — ACTIVE;
- #18 M2R display/DPI/zoom/UI Scale — DONE;
- #19 M2V KOMPAS visual acceptance — ACTIVE;
- #21 M2O architecture optimization — ACTIVE / BLOCKS M3.

Next feature lane after M2O + controlled M2 acceptance: **M3 Parametric Sketch** (#5).

## What works now

The permanent ASA shell is independent from visible Toubkal UI and can be started with:

```bash
npm run install:vendor
npm run dev
```

Standalone address: `http://localhost:8090`.

`npm run dev:asa` remains an explicit alias. Vendor diagnostic UI is `npm run dev:vendor`.

Release-like Docker:

```bash
npm run docker:up
```

Docker address: `http://localhost:8088` and production-compatible `/cad/*` deep routes.

### Protected Part workflow

Real Chromium already proves through ASA-owned controls:

`XY Sketch -> rectangle 60x40 -> driving dimensions -> Extrude 10 -> select top face -> second Sketch -> centered diameter 12 -> through cut -> select edge -> Fillet R1 -> edit width 60 to 80 -> downstream rebuild -> save native parametric JSON -> reload/reopen -> edit diameter 12 to 14`.

Persisted document keeps feature history and durable StableRefs. Transient face/edge ordinals and native OpenCascade/Three objects are not persisted.

### Local computation

- shell/sketch-only work does not eagerly load OpenCascade;
- OpenCascade WASM is loaded lazily when B-Rep work is first required;
- B-Rep/recompute happens in the browser/device;
- ASA Lab host contract has persistence/recovery boundaries but no normal CAD-compute RPC.

### Interaction already browser-proven

- wheel zoom;
- middle-button pan;
- right-drag orbit;
- Fit + front/back/top/bottom/left/right/isometric views;
- central ShortcutRegistry;
- Ctrl+S, Undo/Redo, Esc, Ctrl+Enter, F5 and camera shortcuts;
- focus-safe numeric/text editing;
- body selection synchronized Viewport <-> Tree by ASA `bodyId`;
- command-specific face/edge picking separated from ordinary body selection;
- real touch gesture regression is green.

### Display/responsive acceptance

M2R #18 is complete. A single real-browser run passed the complete matrix together, including:
- 1280x720 / 1366x768 / 1536x864 / 1920x1080;
- 2560x1440 / 3440x1440 / effective 3840x2160;
- representative 4K@150% and 4K@200%;
- 1920x720 height stress;
- portrait/landscape tablet, hybrid input and phones down to 360x640;
- UI Scale Auto/90/100/110/125/150;
- B-Rep picking across UI Scale changes;
- browser-zoom effective viewport/DPR regression.

## Deterministic review routes

Available Part fixtures:
- `/dev/part/empty`;
- `/dev/part/sketch`;
- `/dev/part/extrude`;
- `/dev/part/reference`;
- `/dev/part/rebuild-error`.

These are the preferred surfaces for visual correction and regression review.

## What is deliberately not complete

Do **not** mistake the protected Part proof for full KOMPAS parity.

Not complete yet:
- M2O architecture optimization gate;
- full sketch geometry/constraints/DOF workflow (M3);
- broad Part Design feature set and industrial StableRef corpus (M4);
- Assembly product workflow (M4A);
- Drawing/Fragment (M6);
- Specification/Text editors (M6A);
- full visual KOMPAS acceptance and final ASA-owned icon set (M2V);
- final ASA Lab deployment (M5).

The current OpenCascade Part runtime intentionally implements a narrow accepted vertical slice. New features must extend contracts/tests rather than bypassing them.

## Immediate next work

Follow [`M2O_OPTIMIZATION_GATE.md`](M2O_OPTIMIZATION_GATE.md) in order.

Immediate sequence:
1. O1 — correct mandatory architecture documentation to the six-document model;
2. O2 — cross-validate command/layout registries and make implementation statuses truthful;
3. O3 — route editor persistence through `CadProjectSession` / `CadProjectHost`;
4. continue O4–O11 without adding new CAD feature families;
5. start M3 only after the M2O completion gate passes.

If another document contains an older `ACTIVE/NEXT` statement, **this file plus issue #21 and the M2O execution file win for current status**.
