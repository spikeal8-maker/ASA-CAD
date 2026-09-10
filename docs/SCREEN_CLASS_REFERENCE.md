# ASA-CAD screen-class reference

Use effective CSS viewport size, not raw monitor pixels.

| Effective viewport | Mode | Primary behavior |
|---|---|---|
| <480 wide | phone-small | work area + drawers/bottom sheets |
| 480–599 | phone | work area + drawers/bottom sheets |
| 600–899 | tablet | compact command rail + drawers/docks |
| 900–1279 | compact | compact desktop/tablet landscape |
| 1280–1919 | desktop | tree + work area + parameters when space permits |
| 1920–2559 | large | normal desktop, extra width primarily to work area |
| >=2560 | xlarge | bounded chrome/panels, enlarged work area, optional higher UI Scale |

Height modifiers:

| Effective height | Modifier |
|---|---|
| <720 | short / constrained |
| 720–899 | compact-height |
| 900–1199 | standard-height |
| >=1200 | tall |

Primary baseline: 1920x1080 effective at UI Scale 100%.

4K physical displays must also be treated according to OS/browser effective resolution: e.g. representative 4K@200% behaves around 1920x1080 effective and must not receive a second 2x shell enlargement.
