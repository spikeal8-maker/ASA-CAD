# ASA-CAD current status

Short execution state for humans and coding agents. Product/end state: `SYSTEM_SPEC.md`; technical boundaries: `ARCHITECTURE.md`; implementation order: `ROADMAP.md`; detailed history: GitHub issues.

Last synchronized: 2026-09-17.

## Current phase

**Gate A — DONE.**
**M2O — DONE.**
**M3 Parametric Sketch (#5): ACTIVE.**
**M3M #57: 001..008 DONE; M3M-009 remains a hard pre-M4 gate.**

Accepted M3 slices: M3.1 solve/overlay; M3.2 Line; M3.3 Circle; M3.4 Arc; M3.5 Rectangle; M3.6A stable-ID selection/delete; M3.6B rigid drag/translate (#75); M3.7A Horizontal/Vertical (#77); M3.7B Fixed (#79); M3.7C Coincident (#83); M3.7D Parallel (#85); M3.7E Perpendicular (#87); Tangent Line↔Circle (#90); Concentric Circle↔Circle (#92); Equal Line↔Line (#96); Symmetry endpoint↔endpoint about Line (#99); **Point-on-curve Line endpoint→Line (#101)**.

Point-on-curve merged as `eb3f2d14` after all five workflows passed on final review SHA `0aaca594`: M2 shell, M3 browser, M2 browser, Docker and baseline. It persists one stable Line endpoint ref (`a`/`b`) plus a distinct target Line ID, rejects duplicate/self/type/cross-Sketch selections atomically, maps a narrow ASA/vendor `POINT_ON_CURVE` token to the existing PlaneGCS `point_on_line_pl` primitive, shares desktop/mobile/search actions and preserves Undo/Redo + Save/Open. Circle/Arc targets and generalized point kinds remain out of scope.

## Full Repository Health Audit after Equal — #97/#98

**YELLOW ACCEPTED — no RED blocker for narrow M3 work.**

Audit cadence after that gate: **2 / 3 permanent feature slices** (Symmetry, Point-on-curve). Run the next Full Repository Health Audit immediately after one more accepted permanent feature slice, or at a milestone boundary if earlier.

Audit repair/evidence:
- repository hygiene and exact frozen ratchets PASS;
- `SketchConstraintCommandHandlers.ts`: 9,772 B → 7,859 B before later bounded feature additions;
- focused Coincident/Line-pair/Symmetry/Point-on-curve ownership is preserved;
- `App.tsx` remains exactly 16,992 B; `M3BrowserHarness.mjs` remains exactly 7,993 B;
- `src/contracts/sketch.ts` remains at or below its 12,288 B target after Point-on-curve;
- no file-budget ceiling was raised.

Bounded/non-growing YELLOW debt:
1. M3M-009: `CadViewport.tsx`, `OpenCascadePartRuntime.ts` and remaining pre-M4 frozen hotspots;
2. pinned vendor/toolchain modernization before beta: 1 moderate + 3 high npm audit findings and the known Actions runtime warning;
3. root product license / third-party notice decision before public beta/release;
4. ASA-CAD ↔ ASA Lab M3X golden host-contract compatibility before broad M4/M5;
5. large history/topology/runtime scale benchmarks remain M4/M4B work.

## Protected architecture / regressions

- six ASA document kinds: Part, Assembly, Drawing, Fragment, Specification and Text, behind `CadDocument` / `CadApplication`;
- `CadProjectSession -> CadProjectHost`; no browser/kernel persistence authority;
- centralized history/rollback and shared desktop/mobile/search actions;
- focused Sketch geometry/edit/constraint owners; transient selection never becomes persisted authority;
- PlaneGCS/OpenCascade stay lazy; no persisted solver/OCC/Three objects;
- protected Part and all accepted M3 geometry/edit/constraint regressions through Point-on-curve are green.

## Next M3 slice

**Construction toggle — selected Line only.**

Scope: add an ASA-owned boolean construction flag independent from existing Line `role` metadata; typed toggle/set command for one selected Line; construction Line remains visible/selectable/draggable/constrainable and continues through PlaneGCS, but must not contribute to a Part profile; rectangle/profile semantics must preserve `rectangle-edge-*` roles independently. Shared desktop/mobile/search action, Undo/Redo, Save/Open and focused browser/runtime acceptance are required.

Explicitly out of scope: Circle/Arc construction, generalized construction-mode creation, projection tools, trim/extend/split/offset and new dimension types.

After this slice the audit cadence becomes **3 / 3** and feature work pauses for a Full Repository Health Audit before any further M3 feature slice.

Do not start broad M4 before M3M-009 and green M3/M3X entry gates.
