# ASA-CAD current status

Short execution state for humans and coding agents. Product/end state: `SYSTEM_SPEC.md`; technical boundaries: `ARCHITECTURE.md`; sequence: `ROADMAP.md`; detailed history: GitHub issues.

Last synchronized: 2026-09-15.

## Current phase

**Gate A — DONE.**  
**M2O — DONE.**  
**M3 Parametric Sketch (#5): ACTIVE.**  
**M3M #57: 001..008 DONE; M3M-009 remains pre-M4.**

Accepted M3 slices: M3.1 solve/overlay; M3.2 Line; M3.3 Circle; M3.4 Arc; M3.5 Rectangle; M3.6A stable-ID selection/delete; M3.6B rigid drag/translate (#75); M3.7A Horizontal/Vertical (#77); M3.7B Fixed solved-geometry freeze (#79); M3.7C Line endpoint Coincident (#83); **M3.7D Line↔Line Parallel (#85)**.

M3.7D (`16e24fb4`) promotes `constraint.parallel` as a two-Line product action. It persists stable Line IDs, rejects missing/non-Line/self/symmetric-duplicate pairs before mutation, keeps pair selection transient, and reconstructs solved geometry through existing PlaneGCS `PARALLEL` support. Desktop/search and touch/mobile share one action; mobile uncovers the Sketch work area while selecting Lines. Undo/Redo + Save/Open preserve the same constraint ID/refs. Final review was 1 commit / 20 files / 793 changed lines; frozen `App.tsx`, workspace and shared M3 browser harness did not grow. Slice Quality Gate: **GREEN** on M2 shell, M3 browser, M2 browser, Docker and baseline.

## Full Repository Health Audit — 2026-09-15

**YELLOW ACCEPTED — no RED blocker for one more narrow M3 feature slice.**

Audit repair #81 (`0b4cf7b2`) lowered stale frozen ceilings, made frozen byte ratchets exact, and froze `tests/m3/M3BrowserHarness.mjs` at 7,993 B. Accepted permanent feature slices since that audit: **M3.7C → M3.7D**. M3.7E will be the third accepted slice since the audit; after M3.7E acceptance, run a new Full Repository Health Audit before further feature work.

Bounded/non-growing YELLOW debt:
1. M3M-009: `CadViewport.tsx`, `OpenCascadePartRuntime.ts` and remaining pre-M4 hotspots;
2. vendor dependency/security + GitHub Actions runtime modernization before beta (pinned install reports 1 moderate + 3 high vulnerabilities; vendor lint warnings, 0 errors);
3. root product license / third-party notice decision before public beta/release;
4. ASA-CAD ↔ ASA Lab golden host-contract preflight before broad M4/M5;
5. large history/topology/runtime scale benchmarks in M4/M4B.

## Protected architecture / regressions

- six ASA document kinds behind `CadDocument` / `CadApplication`;
- `CadProjectSession -> CadProjectHost`; no browser/kernel persistence authority;
- shared desktop/mobile typed actions and centralized application history;
- focused Sketch geometry/edit/constraint/dimension owners;
- stable-ID selection/drag and constraint pair selection remain transient interaction state;
- PlaneGCS/OpenCascade stay lazy; no persisted solver/OCC/Three objects;
- protected Part and M3 Line/Circle/Arc/Rectangle/selection/delete/drag/H-V/Fixed/Coincident/Parallel regressions are green.

## Active next slice — M3.7E Perpendicular

Implement **Perpendicular: Line ↔ Line only** as the next narrow binary geometric constraint.

Required scope:
- explicit stable IDs for two distinct Lines in the active Sketch;
- add typed/persisted `constraint.perpendicular` semantics and map them to existing PlaneGCS `PERPENDICULAR` support;
- reject missing/non-Line/same-Line/symmetric duplicate pairs before mutation;
- reuse the focused transient two-Line interaction lifecycle already proven by Parallel;
- expose one shared desktop/mobile/search `CadUiAction`;
- one successful action = one application-history mutation;
- Undo/Redo + Save/Open preserve the same constraint ID and Line refs;
- PlaneGCS-only unit/browser acceptance; no OpenCascade load;
- keep frozen owners/harness non-growing.

Explicit exclusions: Tangent, Concentric, Equal, point/curve constraints, snapping, reshape, trim/extend, driving dimensions and M4.

Do not start broad M4 before M3M-009 and required M3/M3X gates are complete.
