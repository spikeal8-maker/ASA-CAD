# ASA-CAD UI specification index

Do **not** read every UI document for every change. Start with `STATUS.md`, `SYSTEM_SPEC.md`, `ARCHITECTURE.md` and the active GitHub issue, then use the smallest relevant set below. Repository-wide reading policy: [`DOCS_POLICY.md`](DOCS_POLICY.md).

## By task

### Buttons / commands / ribbon
- `UI_COMMAND_SPEC.md`
- `../spec/ui/command-registry.v1.json`
- `../spec/ui/layout-registry.v2.json`
- `KOMPAS_SHELL_LAYOUT_SPEC.md` when shell placement changes.

### Viewport / selection / mouse
- `WORKSPACE_INTERACTION_SPEC.md`

### Keyboard
- `SHORTCUTS_SPEC.md`

### Phone / tablet / touch
- `MOBILE_RESPONSIVE_SPEC.md`
- `WORKSPACE_INTERACTION_SPEC.md` only when viewport gestures/picking are involved.

### HD / FHD / 2K / 4K / DPI / browser zoom
- `DISPLAY_LAYOUT_SPEC.md`
- `../spec/ui/viewport-matrix.v1.json`

### KOMPAS visual matching
- `VISUAL_REFERENCE_SPEC.md`
- `M2_VISUAL_ACCEPTANCE.md`
- `../spec/ui/visual-reference-manifest.v1.json`
- `KOMPAS_SHELL_LAYOUT_SPEC.md`

### Full KOMPAS command lookup
- `KOMPAS_UI_INVENTORY.md`
- `../spec/ui/kompas-command-inventory.v25.json`

This inventory is reference material, not mandatory context for an unrelated UI change.

## Machine sources

- `command-registry.v1.json` — ASA commands admitted to product implementation;
- `layout-registry.v2.json` — deterministic workspace/group/order/collapse/mobile placement;
- `viewport-matrix.v1.json` — display/device regression cases;
- `visual-reference-manifest.v1.json` — visual reference states;
- `kompas-command-inventory.v25.json` — broader KOMPAS audit/classification.

## Precedence

For current status use `STATUS.md` + the active GitHub issue.

For product/layout behavior:
1. `SYSTEM_SPEC.md`;
2. `ARCHITECTURE.md`;
3. applicable machine registry;
4. focused subsystem specification;
5. historical audits/reference notes.

Visible Toubkal UI is never a product-layout authority.