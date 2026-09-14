# ASA-CAD development and visual review workflow

This document defines the practical standalone development/review loop. Current phase and next coding task remain in `STATUS.md`; quality/audit cadence is defined in `DEVELOPMENT_QUALITY_GATES.md`.

## 1. Product development mode

Install pinned vendor/toolchain dependencies once:

```bash
npm run install:vendor
```

Run the **ASA-owned product UI**:

```bash
npm run dev
```

Equivalent explicit command:

```bash
npm run dev:asa
```

Default address:

```text
http://localhost:8090
```

Use this for normal shell, Sketch, Part, responsive and interaction development. Hot reload is the fast feedback loop.

The old Toubkal surface is diagnostic/reference only:

```bash
npm run dev:vendor
```

Do not implement permanent ASA visual/product behavior by repainting vendor UI components.

## 2. Release-like standalone Docker

After a meaningful runtime/UI change or before accepting a gate:

```bash
npm run docker:up
```

Open:

```text
http://localhost:8088
```

Stop with:

```bash
npm run docker:down
```

Docker validates the production-like static build, Caddy routing, WASM assets and CAD-specific browser headers. It is not the normal pixel-by-pixel editing loop.

## 3. Permanent source boundary

Current product direction is already ASA-owned:

```text
ASA UI
  -> typed action/command/view contracts
  -> CadApplication / CadDocument
  -> ASA adapters
  -> OpenCascade / PlaneGCS / isolated vendor-derived services
```

Permanent product code lives outside `vendor/toubkal/`. Vendor source is implementation/reference input, not the public product architecture.

A visual correction must change the narrowest ASA-owned shell/component/token owner unless the task is explicitly a vendor/kernel investigation.

## 4. Deterministic review routes

Use stable dev fixtures instead of manually rebuilding the same model for each review.

Current Part routes include:

```text
/dev/part/empty
/dev/part/sketch
/dev/part/extrude
/dev/part/reference
/dev/part/rebuild-error
```

Future document kinds add equivalent deterministic fixtures as they become real ASA editors.

Fixtures are development/test states, not public user content.

They exist for:
- owner visual review;
- browser regression;
- responsive/DPI/zoom checks;
- exact bug reproduction;
- low-context agent tasks.

## 5. How to give a visual correction task

A useful task identifies:

1. exact URL/fixture state;
2. document/workspace;
3. observed defect;
4. required outcome or KOMPAS reference state.

Example:

```text
URL: /dev/part/sketch
Workspace: Part -> Sketch
The top command area is too tall at 1366x768 and the viewport becomes too small.
Keep the KOMPAS-oriented hierarchy, reduce chrome height and preserve readable labels.
```

Screenshots are useful evidence, but the deterministic route remains important because the agent should inspect and test the real implementation.

## 6. Styling/editing architecture

Use shared tokens for genuinely global appearance and focused domain styles for subsystem behavior.

Global requests such as shell density should change shared tokens/layout owners. Local requests such as Assembly tree row density must not require patching unrelated Part/Sketch styles.

Do not recreate a monolithic stylesheet. CSS ownership is subject to repository-health budgets just like TS/TSX owners.

## 7. Required development loop

Normal product loop:

```text
open deterministic state
-> implement the smallest vertical slice/correction
-> run focused test
-> Slice Quality Gate
-> split/clean if the change introduced debt
-> owner/browser review where applicable
-> release-like Docker regression where required
-> sync issue/STATUS if state changed
-> next slice
```

Do not defer cleanup until the end of a long milestone. Every three accepted slices and every milestone boundary require the broader Full Repository Health Audit from `DEVELOPMENT_QUALITY_GATES.md`.

## 8. Testing layers

Use the cheapest relevant layer first:

1. process/repository-health checks;
2. type/unit/contract tests;
3. CAD geometry/recompute/reference tests;
4. browser interaction tests;
5. visual fixture/regression checks;
6. Docker browser E2E;
7. ASA Lab shared-contract/staging E2E when host/persistence boundaries are involved.

Common local checks:

```bash
npm run test:process
npm test
npm run check
```

A screenshot alone never proves CAD correctness. A geometry test alone never proves UI behavior. A green feature test does not override a RED repository-health result.

## 9. Owner review should stay low-friction

For ordinary standalone review the owner should not need to:
- run the whole ASA Lab stack;
- start PostgreSQL;
- configure classes/accounts;
- rebuild Docker after every CSS change;
- understand OpenCascade internals;
- navigate vendor UI source;
- manually recreate the same model repeatedly.

Standalone fixtures and the ASA dev server exist specifically to remove that friction.

## 10. ASA Lab integration remains a separate deployment step

The same tested ASA-CAD release is later delivered as `asa-cad-web:<version>` and reverse-proxied under `/cad/*`.

Standalone development uses a local/mock `CadProjectHost`; production uses the ASA Lab host adapter. The public document/application model must remain the same.

Cross-repository host-contract compatibility is tested before broad M5 deployment work; see `ASA_LAB_INTEGRATION.md` and `DEVELOPMENT_QUALITY_GATES.md`.
