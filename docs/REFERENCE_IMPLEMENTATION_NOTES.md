# ASA-CAD reference implementation notes

## KOMPAS mental model to preserve

Current KOMPAS help documents separate management panels including Parameters and Document Tree, with panel visibility dependent on document/process. Commands expose parameters through a dedicated parameter panel and model/drawing objects are selected both in the graphical area and document tree.

ASA-CAD should preserve this mental model:

- command groups start engineering actions;
- active command exposes ParameterPanel automatically;
- graphical work area shows selection/preselection and preview;
- tree and work area stay synchronized;
- ending/canceling command returns panel state predictably;
- management panels can collapse to maximize work area;
- document-specific panels are not permanently forced open.

## High-DPI mental model

Display resolution alone does not define perceived UI size. ASA-CAD uses effective CSS pixels plus an ASA UI Scale preference. Physical 4K resolution is test metadata, not a direct layout breakpoint.

This note is subordinate to `DISPLAY_LAYOUT_SPEC.md` and `VISUAL_REFERENCE_SPEC.md`.