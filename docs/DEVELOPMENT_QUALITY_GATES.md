# ASA-CAD continuous development quality gates

This document is the binding quality/audit contract for ASA-CAD development. It exists to prevent the repository from returning to large mixed-responsibility files, duplicated status/specification prose, accidental artifacts, expensive repository-wide agent context and late discovery of integration drift.

The machine-readable policy is `spec/process/repository-health.v1.json`. `AGENTS.md` summarizes the rules coding agents must apply during normal work. If a feature implementation conflicts with this quality contract, the feature does not proceed until the conflict is resolved deliberately.

## 1. Required development cycle

Permanent work follows this loop:

```text
scope/contract
-> smallest vertical implementation slice
-> focused functional regression
-> Slice Quality Gate
-> required cleanup/refactor
-> affected browser/Docker/compatibility regressions
-> issue + STATUS synchronization
-> next slice
```

A slice is not accepted merely because its feature works. The repository must remain maintainable after the slice.

A long milestone must not postpone cleanup until its end. Architectural debt discovered by the slice that created it is cheapest to remove immediately and most expensive after several later slices depend on it.

## 2. Audit cadence

### 2.1 Slice Quality Gate — after every permanent vertical slice

Every accepted vertical slice must end with a lightweight repository-health review of the touched subsystem.

Required checks:

- responsibility/ownership remains focused;
- touched files remain inside size budgets or shrink an existing grandfathered hotspot;
- no new duplicated logic or parallel implementation path was introduced;
- no temporary/generated/review artifacts were left tracked;
- focused tests cover the new contract;
- save/reopen compatibility is checked when persistent data changed;
- status/registry/spec changes are synchronized only where the contract changed;
- no new repository-wide context requirement was created for the next coding agent.

The next feature slice may start only when this gate is green, or when an explicitly accepted yellow item is non-growing and has a removal plan.

### 2.2 Full Repository Health Audit — every three accepted slices and at every milestone boundary

Whichever comes first, perform a broader audit covering:

- file-size and ownership hotspots;
- duplicate/dead code and obsolete adapters;
- duplicate/stale documentation;
- repository artifacts and tracked generated output;
- test duplication and oversized browser harnesses;
- dependency/upstream drift;
- persistence/schema migration safety;
- runtime/browser performance risks relevant to the milestone;
- issue/STATUS/ROADMAP consistency;
- ASA Lab host-contract drift where integration boundaries are touched.

This audit is a development gate, not a retrospective report. Blocking findings are fixed before normal feature growth resumes.

### 2.3 Pre-integration audit

Before the first broad M5 integration work, ASA-CAD and ASA Lab must already agree on the Project Core host contract. M5 must not be the first time both repositories are connected end to end.

### 2.4 Pre-release audit

Every beta/release candidate requires a full repository-health audit plus protected functional/browser/Docker/compatibility regressions.

## 3. Audit result model

Each quality gate ends in exactly one state.

### GREEN

No blocking architecture, repository-hygiene, regression or compatibility issue remains. Feature development may continue.

### YELLOW

A known debt item remains, but:

- it is explicitly recorded;
- it does not violate a hard limit;
- it is frozen and may not grow;
- later slices may not add responsibility to it;
- it has a defined extraction/cleanup owner;
- it must be removed before the next milestone boundary.

A newly introduced target-budget warning should normally be corrected in the same slice rather than accepted as yellow.

### RED

Normal feature development is blocked. Open/use a focused maintenance gate until the repository returns to green or an explicitly justified yellow state.

RED includes at least:

- hard file-budget violation;
- growth of a frozen hotspot;
- broken architecture boundary;
- failing protected regression;
- silent saved-document incompatibility;
- unresolved contract drift that would make ASA-CAD and ASA Lab incompatible;
- tracked temporary/generated artifacts prohibited by policy;
- a new god-object or mixed-responsibility owner that cannot be reviewed safely.

## 4. File size and ownership budgets

File size is an architecture property because large mixed owners increase defect probability, review cost and AI-agent context cost.

The authoritative numeric policy is `spec/process/repository-health.v1.json` and is enforced by `tests/process/file-budgets.mjs`.

Current default byte targets/hard limits are:

| Kind | Target | Hard limit |
| --- | ---: | ---: |
| UI/controller TS/TSX | 10 KB | 20 KB |
| runtime/adapter TS | 14 KB | 24 KB |
| command-handler TS | 10 KB | 16 KB |
| domain CSS | 10 KB | 20 KB |
| focused browser regression | 8 KB | 14 KB |
| agent entry/status document | 5 KB | 8 KB |
| focused narrative specification | 12 KB | 20 KB |

Line count is a secondary review signal, not a substitute for byte size. Machine policy provides `lineReviewTarget` values so a file with many tiny lines is still reviewed. Long/minified lines never justify bypassing byte budgets.

### Rules

1. A feature PR must not raise a hard limit to make CI pass.
2. A file above target should be split before a new responsibility family is added.
3. A grandfathered hotspot may only shrink; its exact byte ceiling is frozen.
4. When a refactor shrinks a frozen file, lower its frozen ceiling in the same change.
5. A large file is not automatically bad if it is a machine registry, fixture dataset, generated artifact or pinned vendor source; those categories must be explicit rather than silently exempted.
6. New large first-party binaries/assets require explicit purpose, ownership and review. Repository storage must not become an asset dump.

### Current first-party hotspots

The current maintenance baseline explicitly freezes important hotspots including:

- `src/web/App.tsx`;
- `src/web/CadViewport.tsx`;
- `src/runtime/OpenCascadePartRuntime.ts`;
- `src/application/commands/SketchCommandHandlers.ts`.

The exact ceilings live only in the machine policy so documentation does not drift from CI.

## 5. Responsibility boundaries

A file should have one primary reason to change.

Expected owners include:

- application orchestration;
- command family handlers;
- Sketch editing;
- Part feature construction;
- selection/picking;
- viewport camera/input;
- shell presentation;
- Tree/Parameters presentation;
- persistence/session/recovery;
- runtime adapters;
- document migrations/validation.

Warning signs requiring extraction before further growth:

- one component owns rendering, persistence and CAD commands together;
- one controller handles unrelated command families;
- one runtime owns kernel construction, topology naming, import/export and UI state;
- one test file repeatedly reimplements browser boot/save/touch helpers;
- one CSS file controls unrelated shell, dialogs, viewport and mobile surfaces;
- a change to one feature requires loading many unrelated files merely to understand ownership.

Do not solve these warnings by renaming a god-object or moving the same monolith into another directory.

## 6. Repository hygiene and garbage policy

The repository must contain product source, contracts, tests, deliberate fixtures/assets and pinned external source. It must not accumulate working-directory debris.

The machine hygiene gate excludes declared external/generated dependency roots such as `vendor/` and checks first-party content for prohibited artifacts.

Do not commit:

- editor/system junk such as `.DS_Store`, `Thumbs.db`, swap files;
- `*.bak`, `*.orig`, `*.rej`, `*.tmp`, ad-hoc `*.log` files;
- coverage/playwright/test-result/cache output;
- one-shot codemods, review-fix utilities or temporary workflows after they have served their purpose;
- copied build outputs when they can be reproduced;
- arbitrary screenshots/binaries outside a declared visual-reference/fixture purpose;
- duplicate files named as informal backups such as `old`, `copy`, `final2` in place of version control.

When a temporary migration/codemod is genuinely required, use it on the working branch and remove it before review unless it becomes a documented permanent tool with tests and ownership.

## 7. Dead code, duplicate paths and obsolete files

At each Full Repository Health Audit, inspect for:

- superseded adapters still reachable alongside the accepted implementation;
- unused components/hooks/services;
- duplicate command handlers for the same product action;
- old CSS paths after component extraction;
- obsolete dev fixtures/routes;
- retired migration helpers no longer needed for supported schemas;
- duplicate architecture/status documents;
- old audit plans whose requirements already live in active specs/registries.

Removal must preserve intentionally supported saved-document migrations and pinned vendor source. "Old" is not synonymous with "safe to delete" in a CAD product.

## 8. Documentation and source-of-truth hygiene

Do not create a new status/plan document merely because a coding agent wants a place to summarize its work.

Live implementation status belongs in:

- the active GitHub issue;
- `docs/STATUS.md` as the short repository snapshot.

Product invariants belong in `SYSTEM_SPEC.md`; architecture boundaries in `ARCHITECTURE.md`; implementation order in `ROADMAP.md`; focused behavior in the relevant subsystem spec/registry.

Audit evidence belongs in the PR/issue unless it defines a durable new contract. Historical audits must be retired or clearly treated as reference once their requirements are absorbed into active sources.

`STATUS.md`, `ROADMAP.md` and active issues must not disagree about the current blocking gate. A status mismatch discovered during a quality gate is fixed before the next feature slice.

## 9. AI-agent and token-efficiency requirements

Agent efficiency is a maintainability requirement because ASA-CAD is expected to be developed heavily through automated coding agents.

Required rules:

1. Ordinary work starts from only `STATUS.md`, `SYSTEM_SPEC.md`, `ARCHITECTURE.md` and the active issue, then opens focused subsystem sources as required.
2. Do not make the entire documentation tree mandatory context.
3. Prefer machine-readable registries/contracts over duplicated prose.
4. Prefer deterministic fixture routes and focused tests over manual reconstruction of state.
5. Keep ownership narrow enough that a localized change can be understood without reading the whole application.
6. One PR should represent one vertical slice or one maintenance concern.
7. The machine policy defines review-footprint targets. Large cross-cutting changes must be split or explicitly treated as architecture/maintenance work rather than hidden inside a feature PR.
8. Do not perform repository-wide refactors merely to satisfy aesthetics; refactors must reduce ownership ambiguity, regression risk or context cost.
9. Every maintenance extraction should reduce future context, not just redistribute the same complexity.

## 10. Cross-repository ASA Lab compatibility gate

ASA-CAD already defines a `CadProjectHost` boundary, but integration compatibility must be proven before M5.

Before the first M4 feature expansion is considered complete, establish a shared compatibility lane between ASA-CAD and ASA Lab covering at minimum:

- project/module identity;
- native `CadDocument` schema/version envelope;
- open/load response;
- `baseRevision` optimistic concurrency;
- `mutationId` idempotency/retry semantics;
- `409` revision-conflict behavior;
- snapshot/version semantics;
- same-origin authentication/session expectations;
- unsupported schema/version failure;
- pinned external-document resolution needed by future Assembly/Drawing/Specification.

Use shared/golden JSON fixtures or generated contract tests so both repositories prove the same payload semantics independently.

M5 deployment integration is blocked if this preflight contract is red.

## 11. Performance/scale review

Not every slice requires a performance benchmark. A benchmark becomes mandatory when the change can materially affect:

- Sketch solve latency;
- Part rebuild/recompute latency;
- topology-reference resolution;
- tessellation/render memory;
- undo/redo history size;
- large document serialization;
- browser startup/WASM load;
- Assembly occurrence/mate scale;
- cross-device save/open behavior.

M4 and beta hardening must include synthetic large-document/history/topology corpora, not only small happy-path fixtures.

## 12. Quality-gate evidence

A completed Slice Quality Gate should be visible from the PR/issue through concise evidence:

- affected owner(s);
- relevant budget/hygiene checks;
- focused tests run;
- browser/Docker/compatibility checks where required;
- any debt state: GREEN/YELLOW/RED;
- cleanup performed if the slice introduced a warning;
- status/contract updates when applicable.

Do not create a separate audit report file for every slice. The durable specification stays here; execution evidence stays with the change.

## 13. Definition of a maintainable completed slice

A permanent slice is complete only when all applicable steps are satisfied:

```text
product contract
-> typed ASA command/API
-> runtime/document behavior
-> UI/registry metadata
-> deterministic fixture
-> focused regression
-> save/reopen compatibility where applicable
-> repository-health audit
-> cleanup/refactor if required
-> affected regression gates green
-> issue/STATUS synchronization
```

Functionality without maintainability is not accepted completion.
