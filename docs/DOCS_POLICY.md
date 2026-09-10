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

1. current GitHub issue + `STATUS.md` — current implementation status;
2. `SYSTEM_SPEC.md` — product invariants/end state;
3. `ARCHITECTURE.md` — technical boundary;
4. machine registry for the relevant concern;
5. focused subsystem spec;
6. historical audits/plans.

A historical document never overrides a newer accepted implementation gate.

## Status rule

Live status belongs in exactly two places:
- the active/closed GitHub issue;
- `STATUS.md` as the repository-level snapshot.

`ROADMAP.md` defines sequence and acceptance boundaries. It should avoid repeating detailed implementation logs.

Subsystem specifications describe **what must be true**, not a running diary of commits.

## Documentation change discipline

For a normal code change:
- do not edit documentation unless behavior/contract/status actually changed;
- update the narrowest source-of-truth only;
- when a milestone/gate closes, update its GitHub issue and `STATUS.md`;
- do not add another summary file when an existing source can own the information;
- prefer links to authoritative files over duplicating paragraphs.

## Retiring documents

A file should be removed or moved to historical/reference status when:
- every requirement is already captured in active specs/registries;
- it only lists work that is already completed;
- it duplicates another source without owning a distinct contract.

No active code or agent rule may depend on retired status summaries.