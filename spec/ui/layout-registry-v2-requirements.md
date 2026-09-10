# UI command registry v2 requirements

Registry v1 fixes command identity/labels/groups/milestones. Before M2 visual freeze, registry v2 must add layout and responsive metadata so button composition is deterministic.

Required per-command/per-group metadata where applicable:

- `workspaceOrder`
- `groupOrder`
- `commandOrder`
- `priority`
- `collapsePriority`
- `presentation`: `large | icon-label | icon | split | dropdown | toggle`
- `primaryAction`
- `dropdownMembers`
- `iconKey`
- `tooltip`
- `shortcutCommandId`
- `enablePredicateId`
- `parameterPanelSchemaId`
- `desktopMinWidth`
- `compactPresentation`
- `overflowGroup`
- `mobilePlacement`: `primary | command-sheet | tools-sheet | tree-context | more | unavailable`
- `mobileReason` when unavailable
- `fixtureIds`
- `referenceIds`
- `status`

Group metadata must include:

- fixed group title;
- workspace;
- order;
- collapse priority;
- min/preferred/max width where useful;
- compact form;
- overflow behavior;
- whether the group may scroll on tablet;
- whether it is contextual.

The UI shell must render or validate against this metadata. Individual React components must not invent independent order/collapse rules.