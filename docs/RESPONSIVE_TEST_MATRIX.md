# ASA-CAD responsive test matrix rationale

Canonical machine-readable cases live in `spec/ui/viewport-matrix.v1.json`.

This file explains why the matrix is defined in effective CSS pixels rather than only monitor marketing resolutions.

## Required desktop classes

- HD/small laptop: 1280x720, 1366x768
- scaled/high-DPI laptop common effective: 1536x864
- Full HD reference: 1920x1080
- 2K: 2560x1440
- ultrawide: 3440x1440
- large effective 4K: 3840x2160
- short-wide stress: 1920x720

## Required 4K scaling cases

A 3840x2160 physical display must also be tested as representative effective viewports for:

- 150% OS scale -> approximately 2560x1440 effective;
- 200% OS scale -> approximately 1920x1080 effective.

The shell must not detect physical 4K and enlarge itself a second time after the OS/browser has already reduced effective CSS space.

## Browser zoom

Required functional regression:

- 100%
- 125%
- 150%
- 200%

80% is best-effort compact regression.

## Touch/mobile

Required:

- 360x640
- 390x844
- 430x932
- phone landscape
- 768x1024 tablet portrait
- 1024x768 tablet landscape
- hybrid touch+mouse/keyboard tablet

## Test state families

The matrix is applied progressively to deterministic fixtures:

- Part empty
- Sketch active
- feature/ParameterPanel active
- protected Part
- command overflow
- panel min/default/max widths
- long document title
- Assembly states after M4A
- Drawing/Fragment after M6
- Specification/Text after M6A

The point is not pixel-identical screenshots across all sizes. The acceptance target is preserved hierarchy, readable controls, correct command discoverability, stable work area, and deliberate responsive re-composition.