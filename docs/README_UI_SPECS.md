# ASA-CAD UI specification index

Read these together for product UI work:

1. `UI_COMMAND_SPEC.md` — commands/buttons/groups/parameter panels.
2. `KOMPAS_SHELL_LAYOUT_SPEC.md` — binding default desktop placement of Main Menu, tabs, instrument area, management-panel rail/block and viewport quick-access bar.
3. `WORKSPACE_INTERACTION_SPEC.md` — model/drawing work area and selection/navigation.
4. `SHORTCUTS_SPEC.md` — keyboard and remapping.
5. `MOBILE_RESPONSIVE_SPEC.md` — phone/tablet/touch.
6. `DISPLAY_LAYOUT_SPEC.md` — HD/FHD/2K/4K/ultrawide, DPI, zoom, typography and layout geometry.
7. `VISUAL_REFERENCE_SPEC.md` — KOMPAS reference mapping and visual acceptance.
8. `M2_VISUAL_ACCEPTANCE.md` — acceptance gate.
9. `TZ_CRITICAL_AUDIT.md` — known gaps and audit verdict.

Machine-readable UI contracts:

- `../spec/ui/command-registry.v1.json`
- `../spec/ui/layout-registry-v2-requirements.md`
- `../spec/ui/viewport-matrix.v1.json`
- `../spec/ui/visual-reference-manifest.v1.json`

The current command inventory against KOMPAS v25 is tracked in `KOMPAS_UI_INVENTORY.md` / issue #16.

When exact desktop placement conflicts with an older generic three-column diagram, `KOMPAS_SHELL_LAYOUT_SPEC.md` defines the intended default KOMPAS-oriented composition.