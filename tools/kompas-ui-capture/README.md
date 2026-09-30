# KOMPAS UI Capture

Permanent Windows-only evidence tool for Issue #145 (`KOMPAS-CAPTURE-001`). Stage 0 supports only the canonical `part-empty` state.

It reads the already running KOMPAS-3D v25 window through public Win32 and Windows UI Automation APIs, records physical/client/DIP/normalized geometry, waits for three stable UIA samples at intervals of at least 250 ms, and captures the client area without rescaling it. Raw KOMPAS PNGs stay outside Git under `C:\Users\spike\Documents\VisualReviews\ASA-CAD\KOMPAS-v25\`.

## Safety

- Run only with a separate temporary empty Part active.
- Do not save or modify user documents.
- The tool does not read KOMPAS binaries/resources beyond normal executable version metadata.
- It never commits raster artwork and never derives or copies icons.
- Unresolved custom-drawn zones remain unresolved; rectangles are not invented.
- The original outer window rectangle is restored after capture unless `-KeepCaptureSize` is explicit.

## Stage 0 capture

```powershell
pwsh -File tools/kompas-ui-capture/capture.ps1 -State part-empty
```

`canonicalBaselineConfirmed` is derived from evidence; there is no operator switch that can force it to `true`. The tool opens the official KOMPAS Parameters dialog, reads the exact Theme, icon/text size, icon style, and language values through UI Automation, saves a local-only settings screenshot under `baseline-evidence`, and cancels the dialog without changing settings. The normal docked panel configuration is proven from the `part-empty` UIA geometry.

Windows Text Scale and High Contrast are read through the public Windows Runtime APIs `UISettings.TextScaleFactor` and `AccessibilitySettings.HighContrast`. Any query error or missing value is recorded as `null` and makes the canonical baseline fail; neither field has a default-value fallback.

Every required baseline field is recorded under `environment.json.baselineConfirmation` with `expected`, `observed`, `source`, `evidence`, and `result`. The required fields are KOMPAS v25, Russian UI, effective-light theme, Standard UI size, monochrome icon style, normal docked panels, Windows Text Scale 100%, and High Contrast off.

Generated committed evidence:

```text
spec/ui/kompas-v25/environment.json
spec/ui/kompas-v25/manifest.json
spec/ui/kompas-v25/states/part-empty/layout.json
spec/ui/kompas-v25/states/part-empty/uia-tree.json
spec/ui/kompas-v25/states/part-empty/layout.svg
spec/ui/kompas-v25/states/part-empty/notes.md
```

The capture uses `EnumWindows`, `GetWindowThreadProcessId`, `GetWindowRect`, `DwmGetWindowAttribute(DWMWA_EXTENDED_FRAME_BOUNDS)`, `GetClientRect`, `ClientToScreen`, `GetDpiForWindow`, `MonitorFromWindow`, `GetMonitorInfo`, iterative `SetWindowPos`/`MoveWindow`, and UI Automation Control View.

Stage 1 states, resize sweeps, DPI matrices, layout-system derivation, and ASA-CAD UI changes are intentionally out of scope.
