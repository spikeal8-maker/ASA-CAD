---
name: asa-cad-browser-acceptance
description: "ASA-CAD only: prove an assigned browser user path with isolated sessions, existing harnesses, aligned screenshots and numeric document oracles. Load on demand when the live task requires browser acceptance."
---
# Prove the assigned user path

Locate the assigned ASA-CAD checkout even when the session starts in its parent; resolve repository paths from its verified Git root. Read the live issue's exact SHA, allowed changes and positive/cancel/error contract.
Use `docs/FUSION_BROWSER_SPEC.md`, `docs/DEVELOPMENT_QUALITY_GATES.md` and `docs/FUSION_AGENT_WORKFLOW.md` for applicable gates.
Reference/docs work may have browser proof N/A with a reason; do not invent a browser run to fill a report.

## Reuse the existing harness

- Read `package.json` scripts, `tests/m3/M3BrowserHarness.mjs` and the narrow assigned test before creating another helper.
- For launcher/cross-shell work, use `tests/launcher/launcher-browser.mjs` and its existing build/server route.
- `tests/launcher/server.fixture.mjs` supplies protocol fixtures; it is not evidence of a shipped CAD build.
- Use the actual candidate build, record served SHA/build identity and actual checkout/tree. A stale server or synthetic merge is not silently the candidate.
- Use a new browser context and a named isolated CLI session on a dedicated test origin. Never use the user's saved-project origin/profile as acceptance storage.
- Set `ASA_CAD_SHELL_URL` only to that verified isolated test server; do not trust a harness default or switch an installed D2 origin.

## Scoped Windows tools

Use the installed wrappers, not global PATH or an unversioned `npx` download. Keep PowerShell execution policy unchanged.
The browser wrapper is pinned to CLI 0.1.25; inspect its real help before choosing commands. This example is PowerShell:

```powershell
& "$env:LOCALAPPDATA\ASA-CAD\tools\asa-browser.cmd" --help
$asaBrowserExit = $LASTEXITCODE
Write-Output "asa-browser help exit=$asaBrowserExit"
exit $asaBrowserExit
```

Select only flags supported by that help and use a task-specific named session; do not guess another CLI's API.
Run required repository checks through `& "$env:LOCALAPPDATA\ASA-CAD\tools\asa-npm.cmd" run test:process:ui-core-u1a-ready` when listed in the contract.
Capture `$LASTEXITCODE` immediately after each native command and propagate it; an outer PowerShell exit 0 must not mask npm failure.
Use `& "$env:LOCALAPPDATA\ASA-CAD\tools\asa-node.cmd" --version` to record the selected runtime; missing wrappers or a pin mismatch are blockers.

## Exercise ordinary actions

- Enter through the ordinary launcher/editor route and create the subject with real clicks, pointer movement and text/numeric input.
- Do not create the subject through hidden `app.execute`, localStorage writes, injected CAD commands or force-click. Keep isolated fixtures separately labeled.
- Observe fresh DOM/screenshot state before locating controls or choosing coordinates; use semantic waits, not arbitrary sleeps.
- Follow the actual state transition: start -> input/selection -> preview -> apply/cancel -> edit, then applicable Undo/Redo and Save/Open.
- For new operations, cover the contract's distinct valid classes and an invalid class; scaling the same fixture is not another input class.
- Use XY center (20,10) mm and diameter 12 mm only when the current Circle contract selects that pilot; expect one R6 circle with the same center.
- Check applicable Esc layering, blur, pointercancel, release outside canvas, invalid input and diagnostics; cancellation/errors must not mutate the document.
- Navigation/selection must not add CAD history. An intended edit must not double-commit; Save failure must not report success.

## Pair visual evidence with numeric proof

- Record exact plane/world coordinates, entity IDs/types, dimensions and relevant bbox/volume with tolerances fixed before the run.
- Read the resulting document through existing harness oracles; reading for verification is allowed, manufacturing the tested result is not.
- Check plane-to-screen alignment, selected geometry, anchors, draft/ghost/panel agreement and committed geometry; inspect the screenshots yourself.
- Capture full before/after and matching crops with the same scene/state, viewport dimensions, DPR, browser zoom, UI scale, theme and camera.
- Record any native-reference size mismatch instead of resizing it into claimed parity. Never automatically update a baseline to make a failure pass.
- Collect console errors, failed requests and relevant diagnostics. Link evidence to candidate, browser version, test state and observed numeric result.
- Keep CORE, USER_PATH, DOCUMENT, VISUAL_DELTA/PARITY and PREVIEW separate. A screenshot or green CI is not a geometry oracle or owner verdict.

## Finish narrowly

Run required exact-candidate gates after the final change; repeat only checks affected by later edits or a concrete unresolved risk.
Stop only test-owned sessions/servers; preserve useful evidence and do not clear the user's storage or unrelated browser sessions.
Report in Russian: steps, expected/actual, command exits, numeric results, screenshots and PASS/FAIL/BLOCKED/NOT_RUN; justify N/A.
Keep owner visual acceptance PENDING and return REVIEW. Route unresolved scope/environment/authority issues to the controller without changing policy or installing tools.
