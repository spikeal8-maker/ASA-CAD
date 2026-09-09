# ToubkalCAD upstream policy

## Why upstream is kept separately

ASA-CAD will diverge heavily in product UI. We still want access to upstream fixes in geometry, solver, recompute, picking and exchange code.

Therefore ToubkalCAD is tracked as a subtree under:

`vendor/toubkal/`

The vendor subtree is an implementation source, not ASA-CAD's public application API.

## Initial import

Recommended local command after cloning ASA-CAD:

```bash
git remote add toubkal https://github.com/ToubkalCAD/ToubkalCAD.git
git fetch toubkal main
git subtree add --prefix=vendor/toubkal toubkal main --squash
```

Record the imported upstream SHA in `UPSTREAM_BASELINE` in the repository root.

## Updating later

Never auto-update a release branch.

Use a dedicated branch:

```bash
git switch -c upstream/toubkal-YYYYMMDD
git fetch toubkal main
git subtree pull --prefix=vendor/toubkal toubkal main --squash
```

Then:

1. inspect the diff;
2. classify changes into UI / runtime / geometry / solver / recompute / persistence / build;
3. run the full upstream baseline tests;
4. run ASA-CAD reference-model tests;
5. run saved-document compatibility tests;
6. accept only after review.

## What we normally import

High value:
- OpenCascade API fixes;
- geometry correctness fixes;
- solver fixes;
- stable-reference fixes;
- recompute fixes;
- memory-lifetime fixes;
- STEP/IGES fixes;
- picking/tessellation correctness fixes.

Low value after ASA UI replacement:
- upstream ribbon layout;
- Dockview arrangement;
- upstream visual theme;
- toolbar cosmetics;
- product copy/text.

## Merge rule

ASA-CAD UI must not be rewritten to match an upstream internal API change.

If upstream breaks an internal contract, update the ASA runtime adapter. Product UI stays on the stable ASA application API.

## Versioning

Every ASA-CAD release records:

- ASA-CAD version;
- imported Toubkal baseline SHA;
- OpenCascade/opencascade.js version;
- PlaneGCS version;
- document schema version.

This information is required for reproducibility and saved-document support.
