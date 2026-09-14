# ASA-CAD continuous development quality gates

Binding quality/audit contract for ASA-CAD. Its purpose is to prevent large mixed owners, duplicate status/spec prose, tracked artifacts, expensive agent context and late integration drift.

Numeric limits live in `spec/process/repository-health.v1.json` and are enforced by `tests/process/*`. `AGENTS.md` is the short agent entrypoint. This document owns durable audit/process rules; execution evidence belongs in the active PR/issue.

## 1. Permanent development cycle

```text
scope/contract
-> smallest vertical slice
-> focused regression
-> Slice Quality Gate
-> cleanup/refactor if required
-> affected browser/Docker/compatibility gates
-> issue + STATUS sync
-> next slice
```

A feature is not accepted merely because it works. The repository must remain maintainable after it. Do not postpone debt created by a slice until the end of a long milestone.

## 2. Audit cadence

### Slice Quality Gate — every permanent slice

Check the touched subsystem for:
- focused responsibility/ownership;
- file budgets and frozen-hotspot ratchets;
- duplicate logic/parallel paths;
- temporary/generated/review artifacts;
- focused regression coverage;
- save/reopen compatibility when persisted data changed;
- registry/spec/status synchronization when contracts changed;
- agent context growth.

The next slice starts only after GREEN, or explicitly accepted non-growing YELLOW debt.

### Full Repository Health Audit

Run after every **three accepted slices** and at every milestone boundary, whichever comes first. Review:
- size/ownership hotspots;
- dead/duplicate code and obsolete adapters;
- stale/duplicate documentation;
- tracked artifacts/generated output;
- duplicated/oversized test infrastructure;
- dependency/upstream drift;
- persistence/schema migration safety;
- relevant runtime/browser performance risk;
- issue/`STATUS`/`ROADMAP` consistency;
- ASA Lab host-contract drift when that boundary is touched.

This is a development gate, not a retrospective report. Blocking findings are fixed before normal feature growth resumes.

### Integration/release audits

Before broad M5 integration, ASA-CAD and ASA Lab must already agree on their Project Core contract. Every beta/release candidate requires a full health audit plus protected functional/browser/Docker/compatibility regressions.

## 3. Result model

### GREEN
No blocking architecture, hygiene, regression or compatibility issue remains. Development may continue.

### YELLOW
Debt may remain only when it:
- violates no hard limit;
- is explicitly recorded;
- is frozen/non-growing;
- receives no new responsibility;
- has a defined cleanup owner/gate;
- is removed before its declared boundary, no later than the next milestone unless explicitly specified otherwise.

A newly introduced target-budget warning should normally be fixed by the slice that created it.

### RED
Normal feature work stops until a focused maintenance change restores GREEN or justified YELLOW.

RED includes hard-budget violations, growth of frozen hotspots, broken architecture boundaries, failed protected regressions, silent saved-document incompatibility, integration-contract drift, prohibited tracked artifacts, or a new unreviewable god-object.

## 4. File size and ownership

File size is an architecture property because mixed large owners increase defect probability, review cost and AI context cost.

`spec/process/repository-health.v1.json` is authoritative for byte/line targets, hard limits, frozen ceilings and grandfathering. Do not duplicate exact hotspot numbers here.

Rules:
1. Never raise a ceiling merely to make CI pass.
2. If a file is above target, extract before adding a new responsibility family.
3. A frozen/grandfathered hotspot may only shrink; lower/remove its exception in the same refactor that makes it smaller.
4. Byte size is authoritative; line count is a secondary review signal.
5. Vendor source, generated registries and deliberate fixture datasets need explicit policy rather than accidental exemption.
6. Large first-party binaries/assets require explicit purpose and ownership; the repo is not an asset dump.

Current high-risk owners intentionally tracked by maintenance policy include `CadViewport.tsx` and `OpenCascadePartRuntime.ts`; exact state belongs only in the machine policy/`STATUS.md`.

## 5. Responsibility boundaries

A file should have one primary reason to change. Typical owners:
- application orchestration/history;
- command families;
- Sketch editing/tools;
- Part feature construction;
- selection/picking;
- viewport input/camera/render bridge;
- shell and focused panels;
- persistence/session/recovery;
- runtime adapters;
- document validation/migrations;
- shared browser-test infrastructure.

Extraction is required before further growth when a component mixes rendering/persistence/commands, a controller handles unrelated command families, a runtime mixes kernel/topology/import-export/UI state, browser specs copy boot/touch/save helpers, CSS owns unrelated surfaces, or a localized change requires reading many unrelated files.

Moving or renaming the same monolith is not decomposition.

## 6. Repository and documentation hygiene

First-party source may contain product code, contracts, tests, deliberate fixtures/assets and permanent tools. Do not retain editor/system junk, backup/reject/temp/log files, coverage/playwright/cache output, reproducible build output, one-shot codemods/review-fix workflows, or informal `old/copy/final2` backups.

A temporary codemod may exist on a work branch but must disappear before review unless promoted to a tested permanent tool.

At each full audit inspect for:
- superseded adapters/components/hooks/services;
- duplicate handlers or parallel implementations;
- old CSS/fixture/routes after extraction;
- obsolete migration helpers not needed for supported schemas;
- duplicate status/architecture plans;
- historical audits already absorbed into active contracts.

Do not delete compatibility migrations or pinned vendor source merely because they are old.

### Sources of truth

- live state: active GitHub issue + short `docs/STATUS.md`;
- product/end state: `SYSTEM_SPEC.md`;
- technical boundaries: `ARCHITECTURE.md`;
- sequence/acceptance: `ROADMAP.md`;
- focused behavior: subsystem spec/machine registry.

Do not create another summary/status file for convenience. Historical documents must be retired or clearly non-authoritative once active contracts absorb them. `STATUS`, `ROADMAP` and active issues must not disagree about the blocking gate.

## 7. Agent/token efficiency

Agent efficiency is a maintainability requirement.

1. Ordinary work starts with `STATUS.md`, `SYSTEM_SPEC.md`, `ARCHITECTURE.md` and the active issue, then opens only relevant subsystem sources.
2. Never require the full documentation tree as default context.
3. Prefer machine-readable registries/contracts to duplicated prose.
4. Prefer deterministic fixtures and focused regressions to manual state reconstruction.
5. Keep owners small enough that localized work does not require reading the application.
6. One PR = one vertical slice or one focused maintenance concern.
7. Large cross-cutting diffs must be split or explicitly classified as architecture/maintenance work.
8. Refactors must reduce ownership ambiguity, regression risk or future context cost—not satisfy aesthetics alone.

## 8. ASA Lab compatibility preflight

M5 must not be the first time both repositories discover whether their contracts agree. Before broad M4 completion maintain cross-repository evidence for at least:
- module/project identity and routes;
- `CadDocument` envelope/schema version;
- load/save request/response;
- `baseRevision` concurrency;
- `mutationId` retry/idempotency;
- `409` conflict behavior;
- snapshot/version semantics;
- same-origin session expectations;
- unsupported/newer schema failure;
- pinned linked-document resolution required by Assembly and later Drawing/Specification.

Prefer shared/golden fixtures verified independently by ASA-CAD and ASA Lab. M5 deployment is blocked while this preflight is RED.

## 9. Performance/scale review

Benchmarking becomes mandatory when a change can materially affect Sketch solve latency, Part recompute, topology-reference resolution, tessellation/render memory, undo/redo history, large-document serialization, WASM startup, Assembly scale or cross-device save/open.

M4/M4B must include synthetic large-document/history/topology corpora rather than only happy-path fixtures.

## 10. Gate evidence and completion

A completed Slice Quality Gate records concisely in the PR/issue:
- affected owners;
- budget/hygiene result;
- focused tests;
- required browser/Docker/compatibility result;
- GREEN/YELLOW/RED;
- cleanup performed or named debt owner;
- status/contract synchronization when applicable.

Do not create one audit-report file per slice.

A maintainable permanent slice ends with:

```text
product contract
-> typed command/API
-> runtime/document behavior
-> UI/registry metadata where applicable
-> deterministic fixture
-> focused regression
-> save/reopen compatibility where applicable
-> repository-health audit
-> cleanup if required
-> affected gates green
-> issue/STATUS sync
```

Functionality without maintainability is not accepted completion.
