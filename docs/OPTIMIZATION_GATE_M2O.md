# M2O — Optimization gate before M3

This gate exists to prevent M3 Sketch growth from reintroducing monolithic UI/application code and drifting machine contracts.

## P0 acceptance

1. `ARCHITECTURE.md` matches the six-kind public `CadDocument` union.
2. `command-registry.v1.json` and `layout-registry.v2.json` cross-validate in CI.
3. Implemented M2 commands are explicitly marked `implemented`; visible production commands may not remain `planned`.
4. Product Save/Open uses `CadProjectSession`/`CadProjectHost` rather than direct UI-owned persistence.

## P1 acceptance before broad M3 command growth

1. Desktop and mobile consume one typed `CadUiAction`/presentation model.
2. `App.tsx` becomes composition/orchestration only and materially shrinks from the current ~62 KB baseline.
3. `CadApplicationImpl` command mutation logic is split behind a handler registry/focused handlers.
4. Sketch document types are discriminated unions rather than free-form `string` + `Record<string, unknown>` payloads.
5. Viewport interaction responsibilities are separated before selection rectangle/ambiguity/preview work expands the file.
6. ASA-owned dependency/tooling ownership is explicit; vendor dependency resolution remains an intentional adapter boundary.

## Delivery discipline

- Work on a feature branch and merge only after CI.
- Do not add new CAD feature families while P0 is red.
- P1 can be delivered incrementally, but M3 must not grow the old god-objects.
- Protected Part, browser, Docker and vendor baseline gates must remain green.
