# ASA-CAD documentation policy

Keep task context narrow. This repository previously accumulated overlapping specs/status files; do not recreate that pattern.

## Minimum ordinary context

Before a localized code change read:
1. `STATUS.md` — current gate and immediate next work;
2. the active GitHub issue;
3. `AGENTS.md` — concise invariant/process rules;
4. only the focused source/spec required below.

Open `SYSTEM_SPEC.md` when the task may change product/document behavior or end-state semantics. Open `ARCHITECTURE.md` when it may change dependency direction, runtime, persistence, ownership or public application boundaries. They are authoritative contracts, **not mandatory full-file context for every localized edit**.

If `STATUS.md` names a blocking gate, read that gate before coding and do not start later work.

## Focused sources

### Quality / maintenance / audit
- `DEVELOPMENT_QUALITY_GATES.md`;
- `../spec/process/repository-health.v1.json`;
- affected subsystem spec only.

### Commands / shell
- `UI_COMMAND_SPEC.md`;
- `KOMPAS_SHELL_LAYOUT_SPEC.md` when shell placement changes;
- `../spec/ui/command-registry.v1.json`;
- `../spec/ui/layout-registry.v2.json`.

### Workspace / input / mobile
Read only what is touched:
- `WORKSPACE_INTERACTION_SPEC.md`;
- `SHORTCUTS_SPEC.md`;
- `MOBILE_RESPONSIVE_SPEC.md`.

### Display / visual acceptance
- `DISPLAY_LAYOUT_SPEC.md`;
- `M2_VISUAL_ACCEPTANCE.md`;
- `VISUAL_REFERENCE_SPEC.md` only for visual parity;
- applicable UI machine manifests/matrices.

### Document semantics
- `DOCUMENT_TYPES.md` when document-kind semantics change;
- `ASSEMBLIES.md` for Assembly;
- `FILES_SETTINGS_AND_EXPORT.md` for persistence/import/export/settings.

### Deployment / ASA Lab
- `RUN_AND_DEPLOY.md` for standalone/Docker/hosting;
- `ASA_LAB_INTEGRATION.md` for Project Core/classes/versions/host integration.

### Vendor / upstream
- `UPSTREAM.md` only when touching/adopting `vendor/toubkal`;
- minimum vendor source needed by the adapter being changed.

### Reference inventory
`KOMPAS_UI_INVENTORY.md` and `../spec/ui/kompas-command-inventory.v25.json` are lookup/reference material, never unrelated mandatory context.

## Precedence

When statements conflict:
1. `STATUS.md` + active issue — current accepted state/execution gate;
2. `SYSTEM_SPEC.md` — product/end-state contract;
3. `ARCHITECTURE.md` — technical boundary;
4. `DEVELOPMENT_QUALITY_GATES.md` + machine repository-health policy;
5. relevant machine registry;
6. focused subsystem spec;
7. historical material.

An issue may schedule work but cannot silently override product/architecture/quality contracts.

## Status and audit evidence

Live implementation state belongs only in:
- active/closed GitHub issue;
- short `STATUS.md` repository snapshot.

If they disagree after an accepted change, fix the mismatch before the next feature slice. `ROADMAP.md` owns sequence/acceptance, not a commit diary.

Do not create `AUDIT_FINAL`, `AUDIT_V2`, status copies or per-slice report files. Slice/full-audit execution evidence belongs in the PR/issue. Update repository docs only for a durable contract.

## Documentation discipline

- Edit docs only when behavior/contract/status changes.
- Update the narrowest source of truth.
- Prefer links and machine registries over duplicated prose/numbers.
- When a gate closes, synchronize the issue and `STATUS.md` in the same accepted change.
- Retire a document when its requirements are fully absorbed elsewhere or it is only completed-history duplication.
- Full Repository Health Audit includes a documentation-retirement pass.

No active rule/code may depend on a retired status summary.
