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
