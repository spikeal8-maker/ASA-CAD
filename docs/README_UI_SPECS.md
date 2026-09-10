# ASA-CAD UI specification index

Read these together for product UI work:

1. `UI_COMMAND_SPEC.md` — commands/buttons/groups/parameter panels.
2. `KOMPAS_SHELL_LAYOUT_SPEC.md` — binding default desktop placement of Main Menu, tabs, instrument area, management-panel rail/block and viewport quick-access bar.
3. `WORKSPACE_INTERACTION_SPEC.md` — model/drawing work area and selection/navigation.
4. `SHORTCUTS_SPEC.md` — keyboard and remapping.
5. `MOBILE_RESPONSIVE_SPEC.md` — phone/tablet/touch/hybrid input.
6. `DISPLAY_LAYOUT_SPEC.md` — HD/FHD/2K/4K/ultrawide, DPI, browser zoom, typography and layout geometry.
7. `VISUAL_REFERENCE_SPEC.md` — KOMPAS reference mapping and visual acceptance policy.
8. `M2_VISUAL_ACCEPTANCE.md` — M2 acceptance gates.
9. `TZ_CRITICAL_AUDIT.md` — critical gap analysis and resolved/remaining risks.
10. `KOMPAS_UI_INVENTORY.md` — completed KOMPAS v25 built-in engineering baseline; maintained when reference version/scope changes.

Machine-readable UI contracts:

- `../spec/ui/command-registry.v1.json` — stable ASA product command IDs currently admitted to implementation;
- `../spec/ui/kompas-command-inventory.v25.json` — 211-row KOMPAS v25 audit/classification baseline;
- `../spec/ui/layout-registry.v2.json` — deterministic workspace/group order, collapse priority, overflow and mobile placement;
- `../spec/ui/viewport-matrix.v1.json` — required display/DPI/zoom/device regression matrix;
- `../spec/ui/visual-reference-manifest.v1.json` — official-help/owner-reference states mapped to future deterministic ASA fixtures.

`../spec/ui/layout-registry-v2-requirements.md` is retained only as design history. It is not an active implementation contract now that `layout-registry.v2.json` exists.

## Precedence

When documents appear to conflict:

1. `SYSTEM_SPEC.md` defines product/system invariants.
2. `KOMPAS_SHELL_LAYOUT_SPEC.md` defines the default KOMPAS-oriented desktop composition.
3. `UI_COMMAND_SPEC.md` + command registry define command identity and behavior.
4. `layout-registry.v2.json` defines deterministic visual ordering/collapse/mobile placement.
5. `DISPLAY_LAYOUT_SPEC.md` defines responsive geometry/scaling.
6. `MOBILE_RESPONSIVE_SPEC.md` defines phone/tablet presentation and touch behavior.
7. `M2_VISUAL_ACCEPTANCE.md` defines the acceptance gate.

The visible Toubkal shell is not a product-layout authority. It is temporary diagnostic/reference UI only.
