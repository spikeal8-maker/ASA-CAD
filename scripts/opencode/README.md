# ASA-CAD: local OpenCode runtime

Вход для #299; [Fusion workflow](../../docs/FUSION_AGENT_WORKFLOW.md).
Desktop OpenCode: coordinator → один worker → отдельный read-only reviewer. Supervisor возобновляет работу; внешний ChatGPT-контролёр принимает решения. Без новых глобальных MCP.

## Очередь и остановка

Private config/state/packets: `%LOCALAPPDATA%\ASA-CAD\automation`. Сначала state и живой Issue; hashes установленных файлов сверить с reviewed source. Сохранять checkout и sessions.

PowerShell, подготовка и наблюдение:

```powershell
$asaRoot = Join-Path $env:LOCALAPPDATA 'ASA-CAD'
$asaNode = Join-Path $asaRoot 'toolchains\node-v22.23.5-win-x64\node.exe'
$asaAuto = Join-Path $asaRoot 'automation'
$asaSupervisor = Join-Path $asaAuto 'bin\asa-cad-supervisor.mjs'
$asaCampaign = Join-Path $asaAuto 'campaign.json'
$asaStateFile = Join-Path $asaAuto 'state.json'
Get-Content $asaStateFile -Raw
Get-ScheduledTask -TaskName 'ASA-CAD-OpenCode-Supervisor'
```

Scheduled Task выполняет `tick` каждые 2 минуты. Ручной tick тоже может возобновить модель:

```powershell
& $asaNode $asaSupervisor tick $asaCampaign
if ($LASTEXITCODE -ne 0) { throw 'Inspect supervisor state.json' }
```

`start` — только когда coordinator ещё отсутствует, не повторная команда для уже работающего parent:

```powershell
if ((-not (Test-Path $asaStateFile)) -or (-not (Get-Content $asaStateFile -Raw | ConvertFrom-Json).coordinatorSessionId)) {
    & $asaNode $asaSupervisor start $asaCampaign
    if ($LASTEXITCODE -ne 0) { throw 'Supervisor start failed' }
}
```

После ручной остановки в OpenCode:

```powershell
& $asaNode $asaSupervisor pause $asaCampaign
if ($LASTEXITCODE -ne 0) { throw 'Supervisor pause failed' }
```

Pause запрещает новые prompts, не отменяет уже выполняемый child. `manualStop`, pending permissions и lock не снимать автоматически.

## Блокировка и свежесть наблюдения

`LOCKED` завершает CLI с **exit 2**: этот tick не выполнил проверку и не обновил `state.json`. Ошибка/guard сохраняют exit 1. Возраст lock сам по себе не разрешает его снять. `owner.liveness=EXISTS` означает только существование PID (возможен reuse), `NOT_FOUND` — результат ESRCH в момент проверки, `UNKNOWN` — отсутствие достоверного ответа, включая EPERM/невалидный PID. Валидность owner metadata сообщается отдельно.

Для диагностики использовать `diagnose`, а не `tick`. Он не захватывает lock, не читает campaign, не вызывает Git/OpenCode и ничего не пишет; отсутствующий каталог тоже не создаётся. Exit 0 / `UNLOCKED` сообщает только отсутствие lock, а не здоровье разработки. `checkpoint.stale` становится true после 10 минут без обновления; неизвестное/будущее время даёт null. Ни один из этих признаков не возобновляет модель и не удаляет lock.

Проверка контролёра в PowerShell после переменных из предыдущего раздела:

```powershell
$asaDiagnosticText = & $asaNode $asaSupervisor diagnose $asaCampaign
$asaDiagnosticExit = $LASTEXITCODE
$asaDiagnostic = $asaDiagnosticText | ConvertFrom-Json
$asaTaskInfo = Get-ScheduledTaskInfo -TaskName 'ASA-CAD-OpenCode-Supervisor'
$asaConfig = Get-Content $asaCampaign -Raw | ConvertFrom-Json
$asaLiveHead = & git -C $asaConfig.repositoryPath rev-parse HEAD
if ($LASTEXITCODE -ne 0) { throw 'Cannot verify current checkout' }
$asaRemoteHead = & git -C $asaConfig.repositoryPath ls-remote origin ('refs/heads/' + $asaConfig.task.workBranch)
if ($LASTEXITCODE -ne 0 -or -not $asaRemoteHead) { throw 'Cannot verify assigned remote branch' }
[pscustomobject]@{
    DiagnosticExit = $asaDiagnosticExit
    LastRunUtc = $asaTaskInfo.LastRunTime.ToUniversalTime().ToString('o')
    LastTaskResult = $asaTaskInfo.LastTaskResult
    StateCheckedAt = $asaDiagnostic.checkpoint.checkedAt
    StateAgeMs = $asaDiagnostic.checkpoint.ageMs
    StateStale = $asaDiagnostic.checkpoint.stale
    StateHead = $asaDiagnostic.checkpoint.head
    LiveLocalHead = $asaLiveHead
    LiveRemoteHead = ($asaRemoteHead -split '\s+')[0]
    Owner = $asaDiagnostic.owner
}
```

Сопоставить `StateCheckedAt` с `LastRunUtc`, статусом выполняющейся Task и текущими local/remote HEAD. Повторные запуски при старом checkedAt означают, что checkpoint не подтверждает текущий candidate; прежний `RUNNING`/review не переносится на новый SHA. После полного завершения tick проверяется свежий checkedAt. Windows `LastTaskResult=0` отдельно не доказывает прогресс; stdout Task может не сохраняться, поэтому `diagnose` остаётся доступен без запуска работы.

`RUNNING` означает активный native turn из `/api/session/active`; работающий shell job сам по себе этого не доказывает. Если модель неактивна, а job остаётся (например, static server браузерной проверки), supervisor обновляет permissions/inbox, handoff и review provenance, затем сообщает `WAIT_BACKGROUND_JOB`, если более приоритетный guard или controller verdict не требует ожидания. `runningJobs` обновляется при каждом наблюдении неактивных сессий, включая пустой список. Старый APPROVE не подтверждает новый HEAD. Job не убивается и не считается безопасным по названию: до автоматического resume контролёр проверяет владельца/назначение и отдельно завершает только принадлежащий задаче ненужный процесс. Нового writer ради такого ожидания не запускать. Свежий checkpoint подтверждает наблюдение, а прогресс — новый diff, завершённые проверки или опубликованный commit.

Безопасное ручное восстановление выполняет контролёр:

1. Временно отключить только `ASA-CAD-OpenCode-Supervisor`, исключить параллельные ручные ticks и дождаться завершения либо доказанного отсутствия процесса supervisor. Отключение Task само по себе не завершает уже запущенный процесс; controller lease также не останавливает Task.
2. Повторить diagnose и сверить реестр процессов ОС: записанный owner PID действительно отсутствует, активных `asa-cad-supervisor.mjs` нет. При EXISTS/UNKNOWN, повреждённом owner или неизвестном PID — **не снимать lock**; передать диагностику контролёру. Большой возраст не заменяет эту проверку.
3. Пока все запускающие стороны остановлены, убедиться, что owner.json не изменился после проверки, и **переименовать именно этот orphan-каталог в архив**, сохранив owner.json. Не удалять другие locks, state, campaign или native sessions. Автоматического reclaim нет: PID может быть переиспользован, а наблюдение устареть.
4. Согласовать live candidate, контракт и последний доверенный checkpoint. Только затем вернуть Task и разрешённый tick: после снятия lock он способен продолжить модель. Проверить новый checkedAt, head и итоговый статус; не выдавать возврат Task за новую приёмку продукта.

## Часовой внешний контролёр

Проверить `state.json`, `review-packet.json`, `handoff.json`: dispatch/version/base/candidate, clean/scope, разные child IDs и review provenance. `AUTHOR_CLAIM_NOT_VERIFIED_TEST_RECEIPT` — отчёт автора. До `work_verified` проверить содержание и обязательные tests exact candidate; до ACCEPTED — CI/review/verified merge. REVIEW запускает проверку.

Менять `campaign.json.task` только после живого READY, full SHA, назначения, allowlist и dependencies. Дождаться worker, сохранить checkpoint. Новый task — новый dispatch/child; доработка — прежний worker ID. Не сбрасывать state и не игнорировать moved base.

## Один Docker preview

Адрес: **http://asa-cad-299.localhost:8090**. Private stage: `http://127.0.0.1:18090`. `8088` / `asa-node-sec` не менять. Helper требует owned labels и записанные container/image IDs; чужие контейнеры не удалять.

```powershell
$asaPreview = Join-Path $asaAuto 'bin\asa-cad-preview.mjs'
$asaPreviewConfig = Join-Path $asaRoot 'preview\config.json'
& $asaNode $asaPreview status --config $asaPreviewConfig
if ($LASTEXITCODE -ne 0) { throw 'Inspect preview state before changes' }
```

Preview config v1: exact `sourceSha`, scenario, пути `approval.json`/`browser-proof.json` рядом. Approval v1: `APPROVED`, scope `LOCAL_DEVELOPMENT_PREVIEW`, тот же SHA, approvedBy/reason/evidence. Это допуск сборки, не приёмка продукта.

После approval собрать stage:

```powershell
& $asaNode $asaPreview stage --config $asaPreviewConfig
if ($LASTEXITCODE -ne 0) { throw 'Preview stage failed' }
```

На stage пройти ordinary browser scenario в отдельном context. Proof: `PASS`, exact SHA/imageId/origin/scenario; проверить version identity и COOP/COEP. JSON без прогона не доказательство. После проверки proof:

```powershell
& $asaNode $asaPreview publish --config $asaPreviewConfig
if ($LASTEXITCODE -ne 0) { throw 'Inspect preview recovery state' }
```

Проверить опубликованный адрес и identity. При необходимости вернуть записанный previous:

```powershell
& $asaNode $asaPreview rollback --config $asaPreviewConfig
if ($LASTEXITCODE -ne 0) { throw 'Rollback requires controller recovery' }
```

Не чистить state/containers вручную при recovery. Baseline preview не закрывает Circle/U2; docs/tooling не увеличивают product cadence. `ownerVisualAcceptance=PENDING`; main/production merge этим runtime не разрешён.
