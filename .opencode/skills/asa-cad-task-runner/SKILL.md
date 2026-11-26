---
name: asa-cad-task-runner
description: "ASA-CAD only: execute or resume one controller-assigned GitHub task with exact-base guards, narrow scope and a Russian REVIEW report. Load on demand for task execution; this skill never grants READY."
---
# Execute one assigned task

Locate the assigned ASA-CAD checkout first; OpenCode may start in its parent directory.
From that parent, verify `git -C .\ASA-CAD rev-parse --show-toplevel`; otherwise verify the controller-provided checkout path.
Set command working directories to that verified root and resolve all repository documents there, never relative to this skill or the session folder.
Use the current contract; do not copy a historic issue status or SHA from conversation memory.

## Enter and guard

1. Read `spec/process/active-work.v1.json`, `AGENTS.md`, its `canonicalDocuments`, and `docs/FUSION_AGENT_WORKFLOW.md`.
2. Resolve the assigned live issue in `spikeal8-maker/ASA-CAD` through #237 and `spec/process/fusion-tasks.v1.json`; read its latest controller contract and corrections.
3. Start a new assignment only with controller-issued READY, your assignment, dependencies, full start SHA, canonical SHA/branch, allowed files and acceptance. A registry row or CLI `next` grants no permission.
4. Resume your own IN_PROGRESS under the same executor/session or a controller-authorized handoff, verifying the exact contract and saved checkpoint. Returning from REVIEW/BLOCKED requires controller re-dispatch; never self-grant READY.
5. Resolve live canonical/main HEADs, the assigned working ref and blocking PRs. Before the first edit, compare the working ref with the exact start SHA and canonical with its guard.
6. Report BLOCKED with expected/actual full SHAs for unexplained movement; preserve the checkpoint. Your own later candidate does not replace the recorded diff base.
7. Inspect existing changes; keep one active writer. An IN_PROGRESS comment is not an atomic lock. Confirm executor/session ID and IN_PROGRESS only after these checks.
8. Honor the product gate, allowed paths and owner budgets. Read-only/reference work does not open a product gate or authorize environment changes.

## Work with a small context

- Read the contract's `read_first` and narrow owners using `rg`; extract needed JSON fields instead of loading whole snapshots, vendor or documentation trees.
- Keep one result, one shared CadDocument/history/solver and existing typed actions. Do not add another shell handler or authoritative draft.
- Load `asa-cad-evidence-and-bindings` for reference, inventory or action claims; load `asa-cad-browser-acceptance` only for applicable browser work.
- Run the contract's focused checks; broaden only for a concrete remaining risk or required gate. Never weaken assertions, budgets or required checks.
- After two tested hypotheses without new information, return the saved checkpoint to the controller; continue a proven fix within scope.
- Keep a fresh task session for the next assignment. On resume, reload live authority and a compact handoff, not the entire previous transcript.

## Windows execution

Use the installed project wrappers under `$env:LOCALAPPDATA\ASA-CAD\tools`; never a bare `npm` that resolves to `npm.ps1`.
Invoke Node as `& "$env:LOCALAPPDATA\ASA-CAD\tools\asa-node.cmd" scripts/fusion-tasks.mjs validate` when that check is required.
The following block is PowerShell. Preserve the required check's real native exit code in the tool result:

```powershell
& "$env:LOCALAPPDATA\ASA-CAD\tools\asa-npm.cmd" run test:process:fusion-tasks
$asaTaskExit = $LASTEXITCODE
Write-Output "test:process:fusion-tasks exit=$asaTaskExit"
exit $asaTaskExit
```

In cmd.exe use `call "%LOCALAPPDATA%\ASA-CAD\tools\asa-npm.cmd" run test:process:fusion-tasks` and preserve `%ERRORLEVEL%`; do not paste PowerShell syntax there.

Do not change global PATH, PowerShell execution policy or pinned tools; missing/broken wrappers are an environment blocker, not permission to install an unversioned replacement.
For authorized GitHub reports, use a structured body or a UTF-8 body file with `gh --body-file`; never inline multiline Russian text through shell escaping.

## Hand off REVIEW in Russian

Record candidate/actual checkout/tree, diff scope and real command exits; distinguish PASS, FAIL, BLOCKED, NOT_RUN and justified N/A.
Use the workflow's eight numbered report points:

1. Задача: ID, slice, status, executor/session.
2. Версия: exact base, candidate, actual checkout/tree, PR.
3. Изменение: problem, result, changed owners/files, budgets.
4. Сценарии: positive/cancel/error, expected and observed.
5. Проверки: commands, exits, CI/evidence, justified N/A.
6. Визуал: aligned before/after evidence, remaining differences, owner PENDING.
7. Осталось: blockers, saved checkpoint, next controller action.
8. Приёмка контролёра: PENDING until independent review, required exact-head CI and verified merge.

Publish only the authorized task result; verify remote candidate SHA and your worktree when publication is required.
Set REVIEW, never self-assign `work_verified`, ACCEPTED or merge. Never direct/force-push integration/main or rewrite history against the contract.
Keep the handoff to issue/version, base/candidate/tree, allowed paths, checks/evidence, blockers and one next step; exclude secrets and private raw logs.
A task, a commit and an accepted permanent slice are different units; follow live audit cadence without increasing or resetting it yourself.
