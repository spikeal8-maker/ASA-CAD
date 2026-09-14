# ASA-CAD documentation policy

The repository previously accumulated several overlapping specifications and status summaries. This file defines a compact source-of-truth hierarchy so humans and coding agents do not need to read the whole documentation set for every task.

## Four mandatory entry points

Before ordinary product changes read only:

1. `STATUS.md` — what is implemented **now**, current phase and immediate work;
2. `SYSTEM_SPEC.md` — non-negotiable product/end-state invariants;
3. `ARCHITECTURE.md` — dependency/runtime/persistence boundaries;
4. the GitHub issue for the active task/milestone.

Then read only the subsystem documents listed below when they are relevant.

## Conditional specifications

### Development quality / maintenance / repository audit
Read:
- `DEVELOPMENT_QUALITY_GATES.md` for audit cadence, GREEN/YELLOW/RED rules, cleanup and agent-efficiency requirements;
- `../spec/process/repository-health.v1.json` for machine-enforced budgets/hygiene thresholds;
- only the affected subsystem spec needed to judge ownership.

Ordinary feature agents do not preload this whole document set unless a quality gate or warning requires it; the binding summary remains in `AGENTS.md`.

### UI commands / shell
Read:
- `UI_COMMAND_SPEC.md`;
- `KOMPAS_SHELL_LAYOUT_SPEC.md`;
- `../spec/ui/command-registry.v1.json`;
- `../spec/ui/layout-registry.v2.json`.

### Workspace/input/mobile
Read only what the change touches:
- `WORKSPACE_INTERACTION_SPEC.md`;
- `SHORTCUTS_SPEC.md`;
- `MOBILE_RESPONSIVE_SPEC.md`.

### Display/visual acceptance
Read:
- `DISPLAY_LAYOUT_SPEC.md`;
- `M2_VISUAL_ACCEPTANCE.md`;
- `VISUAL_REFERENCE_SPEC.md` when visual parity is involved;
- `../spec/ui/viewport-matrix.v1.json`;
- `../spec/ui/visual-reference-manifest.v1.json`.

### Document types
Read:
- `DOCUMENT_TYPES.md`;
- `ASSEMBLIES.md` only for Assembly work;
- `FILES_SETTINGS_AND_EXPORT.md` only for persistence/import/export/settings work.

### Deployment / ASA Lab
Read:
- `RUN_AND_DEPLOY.md` for standalone/Docker/runtime hosting;
- `ASA_LAB_INTEGRATION.md` for Project Core/classes/assignments/versions/host integration.

### Vendor/upstream
Read:
- `UPSTREAM.md` only when touching `vendor/toubkal` or adopting upstream changes;
- minimum vendor source required for the adapter being changed.

### Reference inventory
`KOMPAS_UI_INVENTORY.md` and `../spec/ui/kompas-command-inventory.v25.json` are lookup/reference sources. They are **not** mandatory reading for an unrelated implementation task.

## Precedence

When statements conflict:

1. `STATUS.md` + active GitHub issue — current implementation state/blocking execution gate;
2. `SYSTEM_SPEC.md` — product invariants/end state;
3. `ARCHITECTURE.md` — technical boundary;
4. `DEVELOPMENT_QUALITY_GATES.md` + `../spec/process/repository-health.v1.json` — maintainability/audit rules;
5. machine registry for the relevant product concern;
6. focused subsystem spec;
7. historical audits/plans.

A current issue may schedule work, but it may not silently override product/architecture/quality contracts. A historical document never overrides a newer accepted implementation gate.

## Status rule

Live status belongs in exactly two places:
- the active/closed GitHub issue;
- `STATUS.md` as the repository-level snapshot.

`STATUS.md` is the canonical short answer to "what should the next coding agent do now?". If an issue and `STATUS.md` disagree, the mismatch is a quality-gate failure and must be corrected before the next feature slice.

`ROADMAP.md` defines sequence and acceptance boundaries. It should avoid repeating detailed implementation logs.

Subsystem specifications describe **what must be true**, not a running diary of commits.

## Audit evidence rule

Do not create `AUDIT_FINAL`, `AUDIT_V2`, status-copy or similar files after every development slice.

Execution evidence for Slice Quality Gates and Full Repository Health Audits belongs in the PR/issue: checks run, findings, cleanup and GREEN/YELLOW/RED result. Create or update a repository document only when the audit discovers a durable contract that future work must obey.

## Documentation change discipline

For a normal code change:
- do not edit documentation unless behavior/contract/status actually changed;
- update the narrowest source-of-truth only;
- when a milestone/gate closes, update its GitHub issue and `STATUS.md`;
- do not add another summary file when an existing source can own the information;
- prefer links to authoritative files over duplicating paragraphs;
- if a requirement becomes machine-readable, keep prose explanatory and avoid duplicating exact mutable values in multiple docs.

## Retiring documents

A file should be removed or moved to historical/reference status when:
- every requirement is already captured in active specs/registries;
- it only lists work that is already completed;
- it duplicates another source without owning a distinct contract.

The Full Repository Health Audit must include a documentation-retirement pass so old audits and status summaries do not accumulate indefinitely.

No active code or agent rule may depend on retired status summaries.
