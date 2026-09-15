# ASA-CAD current status

Short execution state for humans and coding agents. Product/end state: `SYSTEM_SPEC.md`; technical boundaries: `ARCHITECTURE.md`; sequence: `ROADMAP.md`; detailed history: GitHub issues.

Last synchronized: 2026-09-15.

## Current phase

**Gate A — DONE.**  
**M2O — DONE.**  
**M3 Parametric Sketch (#5): ACTIVE.**  
**M3M #57: 001..008 DONE; M3M-009 remains pre-M4.**

Accepted M3 slices: M3.1 solve/overlay; M3.2 Line; M3.3 Circle; M3.4 Arc; M3.5 Rectangle; M3.6A stable-ID selection/delete; M3.6B rigid drag/translate (#75); M3.7A Horizontal/Vertical (#77); M3.7B Fixed solved-geometry freeze (#79).

M3.7B (`b33087a1`) makes `constraint.fixed` a Line-only product action. UI re-solves the persisted Sketch through lazy PlaneGCS, passes serializable solved Line geometry into one atomic `CadApplication` mutation, persists geometry + Fixed together, preserves compatible H/V intent and stable IDs, rejects duplicate Fixed/fixed drag, and survives Undo/Redo + Save/Open. Desktop/search and touch/mobile acceptance are green without loading OpenCascade.

## Full Repository Health Audit — 2026-09-15

**YELLOW ACCEPTED — no RED blocker for the next narrow M3 slice.**

The audit was required after the three accepted slices since the 2026-09-14 audit: M3.6B → M3.7A → M3.7B.

Repair accepted in #81 (`0b4cf7b2`):
- stale frozen file ceilings were lowered to current canonical byte sizes;
- frozen files now require an **exact** machine-readable ratchet, so regrowth fails and shrink must lower the ceiling in the same PR;
- `tests/m3/M3BrowserHarness.mjs` is frozen at 7,993 B; future shared browser helpers must go into focused modules rather than grow the harness.

Audit evidence is green for process/hygiene/file budgets, TypeScript/M2O/M3 foundation, ASA M1/M1B, vendor CAD regressions, protected Part and license/notices. Fresh product M2/M3 browser and Docker acceptance remains #79; later changes were STATUS/process-only.

Bounded/non-growing YELLOW debt:
1. M3M-009: `CadViewport.tsx`, `OpenCascadePartRuntime.ts` and remaining pre-M4 hotspots;
2. vendor dependency/security + GitHub Actions runtime modernization before beta (current install: 1 moderate + 3 high vulnerabilities; vendor lint warnings, 0 errors);
3. root product license / third-party notice decision before public beta/release;
4. ASA-CAD ↔ ASA Lab golden host-contract preflight before broad M4/M5;
5. large history/topology/runtime scale benchmarks in M4/M4B.

## Protected architecture / regressions

- six ASA document kinds behind `CadDocument` / `CadApplication`;
- `CadProjectSession -> CadProjectHost`; no browser/kernel persistence authority;
- shared desktop/mobile typed actions and centralized application history;
- focused Sketch geometry/edit/constraint/dimension owners;
- stable-ID selection/drag and solver preview remain transient interaction state;
- PlaneGCS/OpenCascade stay lazy; no persisted solver/OCC/Three objects;
- protected Part and M3 Line/Circle/Arc/Rectangle/selection/delete/drag/H-V/Fixed regressions remain accepted.

## Active next slice — M3.7C Coincident

Implement **Coincident: Line endpoint ↔ Line endpoint only**.

Required first slice:
- two explicit stable Line entity IDs and endpoint refs (`a` / `b`);
- validate same Sketch, existing Line targets and endpoint refs before mutation;
- reject self-reference and symmetric duplicates deterministically;
- keep two-endpoint selection transient; do not persist UI selection state;
- expose through the shared desktop/mobile/search `CadUiAction` model;
- one action = one application-history mutation;
- Undo/Redo and Save/Open preserve the same constraint ID and references;
- PlaneGCS-only unit/boundary/browser acceptance; no OpenCascade load.

Do **not** mix parallel/perpendicular, circle/arc references, snapping, endpoint reshape, trim/extend, driving dimensions or M4 into M3.7C.

Do not start broad M4 before M3M-009 and required M3/M3X gates are complete.
