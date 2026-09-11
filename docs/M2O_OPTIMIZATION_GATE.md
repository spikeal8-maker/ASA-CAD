# M2O — Architecture Optimization Gate

This document is the **execution checklist before M3 Parametric Sketch**.

Its purpose is narrow: remove the structural debt that would make every new Sketch command expensive or duplicated. Current product status belongs to [`STATUS.md`](STATUS.md); long-term product architecture belongs to [`ARCHITECTURE.md`](ARCHITECTURE.md).

> **Rule:** do not add new CAD feature families while blocking M2O steps O1–O8 are open.

## Scope control

M2O is not a repository-wide rewrite.

For every step:
- stop when the written acceptance criteria are satisfied;
- preserve accepted Part/runtime/browser behavior;
- prefer extraction/adapters over rewrites;
- do not redesign OpenCascade, PlaneGCS, StableRef or unrelated document types unless required by the active step;
- do not add speculative M4/M5/M6 architecture;
- keep feature work out of optimization PRs;
- keep protected browser/Docker/baseline regressions green.

### Blocking classification

- **Hard blockers before M3:** O1, O2, O3, O4.
- **Minimum structural blockers before M3:** O5, O6, O7, O8.
- **Non-blocking follow-up lanes:** O9, O10, O11.

## Current execution state

- [x] **O1** — six-document architecture/document consistency; CI protected.
- [x] **O2** — canonical command/layout IDs and truthful accepted M2 statuses; CI protected.
- [x] **O3** — editor persistence through `CadEditorPersistence -> CadProjectSession -> CadProjectHost`; browser/Docker save-reopen green.
- [x] **O4** — one typed `CadUiAction` source is consumed by global toolbar, command search, command-backed shortcuts, Sketch/Part/View ribbon and phone/tablet Tools. Mobile uses the shared catalog directly; no desktop DOM delegation. Dedicated 390×844 Chromium regression is green.
- [ ] **O5 — ACTIVE** — extract M3-critical ownership from `App.tsx` and lower the size ceiling.
- [ ] O6 — focused Sketch/Constraint/Dimension command handlers.
- [ ] O7 — strong typing for M3 sketch entities/constraints/dimensions.
- [ ] O8 — extract M3-critical viewport interaction responsibilities.

---

## O1 — Architecture/document consistency — DONE

Acceptance achieved:
- all mandatory docs/code agree on `part | assembly | drawing | fragment | specification | text`;
- current Part-focused exact-runtime maturity is documented separately;
- `tests/m2o/document-kinds.mjs` rejects regression.

## O2 — Command/layout registry integrity — DONE

Acceptance achieved:
- layout IDs resolve through the canonical command registry;
- stale aliases and duplicate IDs are rejected;
- accepted M2 commands carry truthful `implemented` status;
- `tests/m2o/registry-integrity.mjs` protects the contract.

## O3 — Persistence boundary — DONE

Permanent path:

```text
App / UI command
  -> CadEditorPersistence
  -> CadProjectSession
  -> CadProjectHost
      -> LocalStorageCadProjectHost
      -> AsaLabCadProjectHost
```

Acceptance achieved:
- `App.tsx` does not own localStorage/serialization/revision mechanics;
- session owns revision/mutation/recovery coordination;
- standalone compatibility stays behind `LocalStorageCadProjectHost`;
- full save/reopen browser flow, M1/M1B and Docker `/cad/*` are green.

## O4 — Shared typed UI action model — DONE

Permanent path:

```text
command-registry + editor state/handlers
             ↓
        CadUiAction[]
      ┌──────┼───────────┬──────────┐
      ↓      ↓           ↓          ↓
 toolbar   search       ribbon    shortcuts
                              \
                               mobile Tools
```

Acceptance achieved:
- `CadUiAction` owns runtime presentation identity/label/status/enablement/execution;
- global Open/Save/Undo/Redo use shared actions;
- command search executes shared actions;
- command-backed shortcuts resolve to the same actions;
- Sketch/Part/Rebuild/View ribbon buttons consume the same actions;
- phone `Инструменты` consumes the same action catalog directly;
- mobile code does not discover/click desktop DOM;
- real mobile browser flow proves `Tools -> Create Sketch -> Parameters -> Sketch tools -> Rectangle` without eager OpenCascade;
- shell, full browser, Docker and baseline gates are green.

## O5 — Materially decompose `App.tsx` — ACTIVE

### Problem

The growth guard prevents further damage but `App.tsx` still owns too much orchestration/presentation. M3 would otherwise expand the same root file with many Sketch state variables, panels and lifecycle handlers.

### Extraction order

Do this in small behavior-preserving PRs:

1. **DocumentTree** — move tree rendering and tree-specific helpers out of `App.tsx`.
2. **ParameterPanel** — move current command-parameter presentation out without moving command execution logic yet.
3. **Shell presentation blocks** — header/document tabs/workspace ribbon/status/mobile navigation into focused components where extraction meaningfully shrinks the root.
4. **Part/Sketch presentation state/controller seam** — create the focused owner where M3 workspace state can grow without returning to root-state sprawl.
5. Extract additional editor controller/bootstrap only when justified by the previous cuts.

Do **not** rewrite the whole editor before M3.

### Acceptance for M3 entry

- [ ] `App.tsx` is materially smaller than the pre-O5 ~62 KB baseline;
- [ ] `MAX_APP_BYTES` is lowered to the achieved size after extraction;
- [ ] DocumentTree and ParameterPanel have focused owners;
- [ ] M3 Sketch workspace growth has one obvious focused module/controller rather than adding large blocks to `App.tsx`;
- [ ] extracted UI modules do not import OpenCascade/vendor internals;
- [ ] protected Part/mobile/responsive/Docker/baseline behavior stays green.

## O6 — Focused Sketch/Constraint/Dimension handlers

Goal: adding an M3 Sketch/Constraint/Dimension command must not substantially grow one central application switch.

Minimum acceptance:
- [ ] typed handler registration/dispatch exists for the M3 growth path;
- [ ] failures remain atomic;
- [ ] undo/redo stays centralized;
- [ ] current M1/M2 command regressions stay green.

## O7 — Strong M3 Sketch typing

Scope only the M3 data surface:
- sketch entities;
- constraints;
- dimensions.

Minimum acceptance:
- [ ] discriminated/validated DTOs reject incompatible shapes;
- [ ] parse/serialize and migration behavior is tested;
- [ ] PlaneGCS consumes typed ASA DTOs;
- [ ] existing protected Part documents remain compatible.

Do not type future Drawing/Specification/Text structures in this gate.

## O8 — M3-critical viewport interaction decomposition

Extract only the interaction seams M3 will grow: selection/pointer/touch/preview ownership as justified by current code.

Minimum acceptance:
- [ ] sketch selection/preview can grow outside one monolithic viewport event block;
- [ ] camera/navigation/picking/touch regressions stay green;
- [ ] navigation-only actions still do not recompute CAD geometry.

---

# Non-blocking follow-up lanes

## O9 — ASA-owned dependency/toolchain direction

New ASA-only dependencies must be root-owned. A full toolchain migration is not required before M3 while current pinned tooling remains reproducible.

## O10 — Safer branch/PR/CI workflow

Operational rule already in use for risky M2O work:

```text
short feature branch -> full CI -> PR -> green -> main
```

Repository-level branch protection can be tightened separately; administration is not an M3 code blocker.

## O11 — M2 visual/KOMPAS acceptance

Continue deterministic reference review in parallel. Final pixel-perfect KOMPAS completion does not block M3 because the real Sketch workspace will change part of the visual surface.

---

# M3 entry gate

M3 may start when all blocking items are true:

- [x] O1 architecture/docs consistent;
- [x] O2 command/layout registries canonical and truthful;
- [x] O3 persistence goes through session/host boundary;
- [x] O4 permanent command presentation consumes shared typed actions;
- [ ] O5 M3-critical UI ownership extracted and `App.tsx` materially smaller;
- [ ] O6 Sketch/Constraint/Dimension growth has focused handlers;
- [ ] O7 M3 Sketch contracts strongly typed;
- [ ] O8 M3 selection/preview interaction can grow outside monolithic viewport logic;
- [ ] final protected Part + M1/M1B + M2 shell/browser/touch/responsive + Docker gates are green.

O9/O10/O11 do not block M3 once this gate is green.

## Execution discipline for agents

For each O-step:
1. read `STATUS.md`, `ARCHITECTURE.md`, this file and only affected subsystem docs;
2. change one ownership boundary at a time;
3. add/strengthen a regression before removing the old path when practical;
4. preserve accepted browser behavior unless the step explicitly changes presentation;
5. stop when acceptance is satisfied;
6. update this checklist only after tests are green.

## Immediate next action

Start **O5.1 — extract `DocumentTree` from `App.tsx`** in a small PR. Preserve its markup/behavior, add an architecture guard, lower the App size ceiling after merge, then move to ParameterPanel.
