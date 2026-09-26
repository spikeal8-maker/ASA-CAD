Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

function Import-KompasCaptureNative {
    if ('AsaCad.KompasCapture.NativeCapture' -as [type]) { return }

    Add-Type -AssemblyName UIAutomationClient
    Add-Type -AssemblyName UIAutomationTypes
    Add-Type -AssemblyName System.Drawing.Common
    Add-Type -AssemblyName WindowsBase
    $sourcePath = Join-Path $PSScriptRoot 'KompasCapture.Native.cs'
    $references = @(
        Get-ChildItem -LiteralPath (Join-Path $PSHOME 'ref') -Filter '*.dll' | ForEach-Object FullName
        Get-ChildItem -LiteralPath $PSHOME -Filter 'System.Private.Windows*.dll' | ForEach-Object FullName
        [System.Drawing.Bitmap].Assembly.Location
        [System.Windows.Automation.AutomationElement].Assembly.Location
        [System.Windows.Automation.AutomationPattern].Assembly.Location
        [System.Windows.Rect].Assembly.Location
    ) | Where-Object { -not [string]::IsNullOrWhiteSpace($_) } | Sort-Object -Unique
    Add-Type -Path $sourcePath -ReferencedAssemblies $references
}

function Get-KompasCaptureWindow {
    Import-KompasCaptureNative
    $allWindows = @([AsaCad.KompasCapture.NativeCapture]::FindKompasWindows())
    $windows = @($allWindows | Where-Object { $_.Title -match '^(КОМПАС-3D|KOMPAS-3D) v25' })
    if ($windows.Count -ne 1) {
        $summary = $allWindows | Select-Object Hwnd, ProcessId, ProcessName, Title
        throw "Expected exactly one visible KOMPAS-3D v25 main window; found $($windows.Count) main candidates among: $($summary | ConvertTo-Json -Compress)"
    }
    return $windows[0]
}

function Get-KompasUiaTree {
    param(
        [Parameter(Mandatory)] [long] $Hwnd,
        [int] $MaxDepth = 24,
        [int] $MaxNodes = 12000
    )
    Import-KompasCaptureNative
    return [AsaCad.KompasCapture.NativeCapture]::CaptureControlView($Hwnd, $MaxDepth, $MaxNodes)
}

function Get-KompasStableState {
    param(
        [Parameter(Mandatory)] [long] $Hwnd,
        [int] $TimeoutMs = 10000,
        [int] $SampleIntervalMs = 300,
        [int] $RequiredStableSamples = 3
    )

    $started = [DateTimeOffset]::UtcNow
    $samples = [System.Collections.Generic.List[object]]::new()
    $stableRun = 0
    $previousSignature = $null
    $finalTree = $null
    do {
        $snapshot = [AsaCad.KompasCapture.NativeCapture]::CaptureStabilitySnapshot($Hwnd)
        $projection = [ordered]@{
            client = $snapshot.ClientRectPhysicalPx
            tree = $snapshot.TreeSignature
            majorZones = $snapshot.MajorZoneSignature
            visibleTooltipCount = $snapshot.VisibleTooltipCount
        } | ConvertTo-Json -Depth 100 -Compress
        $bytes = [Text.Encoding]::UTF8.GetBytes($projection)
        $signature = [Convert]::ToHexString([Security.Cryptography.SHA256]::HashData($bytes)).ToLowerInvariant()
        $sample = [ordered]@{
            capturedAt = [DateTimeOffset]::UtcNow.ToString('o')
            clientRectPhysicalPx = $snapshot.ClientRectPhysicalPx
            uiaTreeSha256 = $signature
            visibleNodeCount = $snapshot.VisibleNodeCount
            visibleTooltipCount = $snapshot.VisibleTooltipCount
        }
        $samples.Add($sample)
        if ($signature -eq $previousSignature) { $stableRun++ } else { $stableRun = 1 }
        $previousSignature = $signature
        if ($stableRun -ge $RequiredStableSamples) { break }
        Start-Sleep -Milliseconds $SampleIntervalMs
    } while (([DateTimeOffset]::UtcNow - $started).TotalMilliseconds -lt $TimeoutMs)

    $duration = [int]([DateTimeOffset]::UtcNow - $started).TotalMilliseconds
    $finalTree = Get-KompasUiaTree -Hwnd $Hwnd
    [pscustomobject]@{
        stabilityResult = if ($stableRun -ge $RequiredStableSamples) { 'PASS' } else { 'FAIL' }
        settleDurationMs = $duration
        stableSamples = $stableRun
        requiredStableSamples = $RequiredStableSamples
        sampleIntervalMs = $SampleIntervalMs
        samples = $samples
        tree = $finalTree
    }
}

function Get-WindowsAccessibilitySnapshot {
    $capturedAt = [DateTimeOffset]::UtcNow.ToString('o')
    $windowsPowerShell = Join-Path $env:SystemRoot 'System32\WindowsPowerShell\v1.0\powershell.exe'
    $failure = {
        param([string] $Message)
        [pscustomobject]@{
            capturedAt = $capturedAt
            textScalePercent = $null
            highContrastEnabled = $null
            source = 'windows-runtime-api'
            error = $Message
        }
    }
    if (-not (Test-Path -LiteralPath $windowsPowerShell -PathType Leaf)) {
        return & $failure "Windows PowerShell was not found at $windowsPowerShell"
    }

    $query = @'
$ErrorActionPreference = 'Stop'
$ui = [Windows.UI.ViewManagement.UISettings,Windows.UI.ViewManagement,ContentType=WindowsRuntime]::new()
$accessibility = [Windows.UI.ViewManagement.AccessibilitySettings,Windows.UI.ViewManagement,ContentType=WindowsRuntime]::new()
[pscustomobject]@{
    textScaleFactor = [double]$ui.TextScaleFactor
    highContrast = [bool]$accessibility.HighContrast
} | ConvertTo-Json -Compress
'@
    try {
        $json = & $windowsPowerShell -NoProfile -NonInteractive -Command $query 2>&1
        if ($LASTEXITCODE -ne 0) {
            return & $failure "Windows Runtime query failed with exit code ${LASTEXITCODE}: $($json -join ' ')"
        }
        $value = ($json -join "`n") | ConvertFrom-Json -ErrorAction Stop
        $factor = [double]$value.textScaleFactor
        if ([double]::IsNaN($factor) -or [double]::IsInfinity($factor) -or $factor -lt 1 -or $factor -gt 2.25) {
            return & $failure "UISettings.TextScaleFactor returned invalid value '$factor'."
        }
        if ($value.highContrast -isnot [bool]) {
            return & $failure 'AccessibilitySettings.HighContrast did not return a Boolean.'
        }
        return [pscustomobject]@{
            capturedAt = $capturedAt
            textScalePercent = [int][math]::Round($factor * 100)
            highContrastEnabled = [bool]$value.highContrast
            source = 'windows-runtime-api'
            error = $null
        }
    }
    catch {
        return & $failure $_.Exception.Message
    }
}

function Get-WindowsTextScalePercent {
    param([AllowNull()] $AccessibilitySnapshot = $null)
    $snapshot = if ($null -eq $AccessibilitySnapshot) { Get-WindowsAccessibilitySnapshot } else { $AccessibilitySnapshot }
    if ($null -eq $snapshot -or $null -eq $snapshot.textScalePercent) { return $null }
    return [int]$snapshot.textScalePercent
}

function Add-KompasUiaNodes {
    param(
        [AllowNull()] $Node,
        [Parameter(Mandatory)] [AllowEmptyCollection()] [Collections.Generic.List[object]] $Output
    )
    if ($null -eq $Node) { return }
    $Output.Add($Node)
    foreach ($child in @($Node.Children)) { Add-KompasUiaNodes -Node $child -Output $Output }
}

function Get-KompasUiaNodes {
    param([AllowNull()] $Root)
    $nodes = [Collections.Generic.List[object]]::new()
    Add-KompasUiaNodes -Node $Root -Output $nodes
    return @($nodes)
}

function Get-KompasSettingsWindow {
    param([Parameter(Mandatory)] [int] $ProcessId)
    $deadline = [DateTimeOffset]::UtcNow.AddSeconds(5)
    do {
        $windows = @([AsaCad.KompasCapture.NativeCapture]::FindKompasWindows() | Where-Object {
            $_.ProcessId -eq $ProcessId -and $_.Title.Trim() -eq 'ПАРАМЕТРЫ'
        })
        if ($windows.Count -eq 1) { return $windows[0] }
        Start-Sleep -Milliseconds 100
    } while ([DateTimeOffset]::UtcNow -lt $deadline)
    return $null
}

function Get-KompasSettingObservation {
    param(
        [Parameter(Mandatory)] [object[]] $Nodes,
        [Parameter(Mandatory)] [string] $SettingName
    )
    $label = $Nodes | Where-Object {
        -not $_.Offscreen -and $_.ControlType -eq 'Text' -and $_.Name -eq "$SettingName`:"
    } | Select-Object -First 1
    if ($null -eq $label -or -not $label.BoundingRect.ClientPhysicalPx.IsValid) { return $null }
    $labelRect = $label.BoundingRect.ClientPhysicalPx
    $combo = $Nodes | Where-Object {
        -not $_.Offscreen -and $_.ControlType -eq 'ComboBox' -and $_.BoundingRect.ClientPhysicalPx.IsValid -and
        $_.BoundingRect.ClientPhysicalPx.X -gt $labelRect.X -and
        [math]::Abs($_.BoundingRect.ClientPhysicalPx.Y - $labelRect.Y) -le 2
    } | Select-Object -First 1
    if ($null -eq $combo -or [string]::IsNullOrWhiteSpace($combo.Value)) { return $null }
    return [pscustomobject]@{
        settingName = $SettingName
        displayedValue = $combo.Value.Trim()
        automationId = $combo.AutomationId
        controlType = $combo.ControlType
    }
}

function Get-KompasOfficialSettingsEvidence {
    param(
        [Parameter(Mandatory)] $MainWindow,
        [Parameter(Mandatory)] [string] $ScreenshotPath
    )
    Import-KompasCaptureNative
    $capturedAt = [DateTimeOffset]::UtcNow.ToString('o')
    $observations = [ordered]@{
        theme = $null
        uiSize = $null
        iconStyle = $null
        uiLanguage = $null
    }
    $settingsWindow = $null
    $screenshot = $null
    $errorMessage = $null
    try {
        $menuAction = [AsaCad.KompasCapture.NativeCapture]::InvokeUiaElement(
            $MainWindow.Hwnd,
            'LongDelayItem_MainMenuItemKompas12442',
            'Настройка'
        )
        if ($menuAction -eq 'not-found' -or $menuAction -eq 'no-supported-action-pattern') {
            throw "Could not open KOMPAS Settings menu: $menuAction"
        }
        $parametersAction = [AsaCad.KompasCapture.NativeCapture]::InvokeUiaElement(
            $MainWindow.Hwnd,
            'LongDelayItem_MainMenuItemKompas7608',
            'Параметры...'
        )
        if ($parametersAction -ne 'Invoke') { throw "Could not open KOMPAS Parameters: $parametersAction" }
        $settingsWindow = Get-KompasSettingsWindow -ProcessId $MainWindow.ProcessId
        if ($null -eq $settingsWindow) { throw 'KOMPAS Parameters window was not found.' }

        $searchId = 'QApplication.ContentDialog.OptionsDlgWidget.frameSearch.lineSearch'
        if (-not [AsaCad.KompasCapture.NativeCapture]::SetUiaValue($settingsWindow.Hwnd, $searchId, 'интерфейс')) {
            throw 'Could not filter official KOMPAS Parameters to Interface.'
        }
        $tree = Get-KompasUiaTree -Hwnd $settingsWindow.Hwnd
        $nodes = @(Get-KompasUiaNodes -Root $tree.Root)
        $observations.theme = Get-KompasSettingObservation -Nodes $nodes -SettingName 'Тема'
        $observations.uiSize = Get-KompasSettingObservation -Nodes $nodes -SettingName 'Размер значков и текста'
        $observations.iconStyle = Get-KompasSettingObservation -Nodes $nodes -SettingName 'Значки'
        $observations.uiLanguage = Get-KompasSettingObservation -Nodes $nodes -SettingName 'Язык'

        $rawScreenshot = [AsaCad.KompasCapture.NativeCapture]::CaptureClientPng($settingsWindow.Hwnd, $ScreenshotPath)
        if (-not $rawScreenshot.WindowWasForeground -or -not $rawScreenshot.WindowWasUnobscured) {
            throw 'KOMPAS Parameters evidence screenshot was not foreground and unobscured.'
        }
        $capturedAt = [DateTimeOffset]::UtcNow.ToString('o')
        $screenshot = [ordered]@{
            localPath = $rawScreenshot.LocalPath
            sha256 = (Get-FileHash -LiteralPath $rawScreenshot.LocalPath -Algorithm SHA256).Hash.ToLowerInvariant()
            capturedAt = $capturedAt
        }
    }
    catch {
        $errorMessage = $_.Exception.Message
    }
    finally {
        if ($null -ne $settingsWindow) {
            [void][AsaCad.KompasCapture.NativeCapture]::InvokeUiaElement(
                $settingsWindow.Hwnd,
                'QApplication.ContentDialog.DialogButtonBar.cancelButton',
                'Отменить'
            )
        }
        [void][AsaCad.KompasCapture.NativeCapture]::ActivateWindow($MainWindow.Hwnd)
    }

    return [pscustomobject]@{
        capturedAt = $capturedAt
        source = 'official-kompas-ui'
        settingsPath = 'ПАРАМЕТРЫ > Система > Экран > Интерфейс'
        verifiedBy = 'Windows UI Automation labels and ValuePattern values from the official KOMPAS Parameters dialog'
        screenshot = $screenshot
        observations = [pscustomobject]$observations
        error = $errorMessage
    }
}

function Get-WindowsThemeValue {
    param([Parameter(Mandatory)] [string] $PropertyName)
    try {
        $settings = Get-ItemProperty -LiteralPath 'HKCU:\Software\Microsoft\Windows\CurrentVersion\Themes\Personalize' -ErrorAction Stop
        if ($PropertyName -notin $settings.PSObject.Properties.Name) { return $null }
        if ([int]$settings.$PropertyName -eq 1) { return 'light' }
        if ([int]$settings.$PropertyName -eq 0) { return 'dark' }
        return $null
    }
    catch { return $null }
}

function Get-PanelConfigurationConfirmation {
    param(
        [Parameter(Mandatory)] $UiaTree,
        [Parameter(Mandatory)] [string] $CapturedAt
    )
    $nodes = @(Get-KompasUiaNodes -Root $UiaTree.Root)
    $management = $nodes | Where-Object {
        -not $_.Offscreen -and $_.AutomationId -eq 'Resizable_LeftHub_DockingTabControl_0|' -and $_.BoundingRect.ClientPhysicalPx.IsValid
    } | Select-Object -First 1
    $graphics = $nodes | Where-Object {
        -not $_.Offscreen -and $_.ClassName -eq 'D3View' -and $_.BoundingRect.ClientPhysicalPx.IsValid
    } | Select-Object -First 1
    $treeTab = $nodes | Where-Object {
        -not $_.Offscreen -and $_.Name -eq 'Дерево' -and $_.BoundingRect.ClientPhysicalPx.IsValid
    } | Select-Object -First 1
    $pass = $null -ne $management -and $null -ne $graphics -and $null -ne $treeTab -and
        $management.BoundingRect.ClientPhysicalPx.Width -lt $graphics.BoundingRect.ClientPhysicalPx.Width -and
        $management.BoundingRect.ClientPhysicalPx.Y -eq $graphics.BoundingRect.ClientPhysicalPx.Y -and
        $treeTab.BoundingRect.ClientPhysicalPx.X -ge $management.BoundingRect.ClientPhysicalPx.X -and
        $treeTab.BoundingRect.ClientPhysicalPx.X -lt ($management.BoundingRect.ClientPhysicalPx.X + $management.BoundingRect.ClientPhysicalPx.Width)
    $observed = if ($pass) {
        'model tree and management panel docked left of the D3View graphics area'
    } else {
        $null
    }
    return [ordered]@{
        expected = 'normal-docked-desktop'
        observed = $observed
        source = 'windows-ui-automation'
        evidence = [ordered]@{
            settingName = 'KOMPAS desktop panel configuration'
            displayedValue = $observed
            verifiedBy = 'UIA Control View geometry for model tree, docked management panel, and D3View'
            capturedAt = $CapturedAt
            requiredNodes = @(
                'Resizable_LeftHub_DockingTabControl_0|',
                'Дерево',
                'D3View'
            )
            observedNodes = [ordered]@{
                managementPanel = if ($null -ne $management) { [ordered]@{ automationId = $management.AutomationId; rect = $management.BoundingRect.ClientPhysicalPx } } else { $null }
                treeTab = if ($null -ne $treeTab) { [ordered]@{ name = $treeTab.Name; automationId = $treeTab.AutomationId; rect = $treeTab.BoundingRect.ClientPhysicalPx } } else { $null }
                graphicsBacking = if ($null -ne $graphics) { [ordered]@{ className = $graphics.ClassName; rect = $graphics.BoundingRect.ClientPhysicalPx } } else { $null }
            }
        }
        result = if ($pass) { 'PASS' } else { 'FAIL' }
    }
}

function Get-KompasEnvironment {
    param(
        [Parameter(Mandatory)] $Window,
        [Parameter(Mandatory)] $UiaTree,
        [Parameter(Mandatory)] $KompasSettingsEvidence,
        [Parameter(Mandatory)] $WindowsAccessibility,
        [Parameter(Mandatory)] [string] $DpiAwareness,
        [Parameter(Mandatory)] [string] $CaptureToolGitSha
    )

    $capturedAt = [DateTimeOffset]::UtcNow.ToString('o')
    $file = Get-Item -LiteralPath $Window.ProcessPath
    $version = $file.VersionInfo
    $os = Get-CimInstance Win32_OperatingSystem
    $systemTheme = Get-WindowsThemeValue -PropertyName 'SystemUsesLightTheme'
    $appTheme = Get-WindowsThemeValue -PropertyName 'AppsUseLightTheme'
    $settings = $KompasSettingsEvidence.observations

    $versionPass = $version.ProductVersion -eq 'v25' -and $Window.Title -match '^(КОМПАС-3D|KOMPAS-3D) v25'
    $languagePass = $null -ne $settings.uiLanguage -and $settings.uiLanguage.displayedValue -eq 'Русский (Россия)'
    $themePass = $null -ne $settings.theme -and $settings.theme.displayedValue -eq 'Согласно теме ОС' -and $appTheme -eq 'light'
    $uiSizePass = $null -ne $settings.uiSize -and $settings.uiSize.displayedValue -eq 'Стандартный'
    $iconStylePass = $null -ne $settings.iconStyle -and $settings.iconStyle.displayedValue -eq 'Монохромные'
    $textScalePass = $null -ne $WindowsAccessibility.textScalePercent -and [int]$WindowsAccessibility.textScalePercent -eq 100
    $highContrastPass = $null -ne $WindowsAccessibility.highContrastEnabled -and [bool]$WindowsAccessibility.highContrastEnabled -eq $false
    $panel = Get-PanelConfigurationConfirmation -UiaTree $UiaTree -CapturedAt $capturedAt
    $settingsScreenshot = $KompasSettingsEvidence.screenshot

    $baselineFields = [ordered]@{
        kompasVersion = [ordered]@{
            expected = 'v25'
            observed = $version.ProductVersion
            source = 'win32-file-version-and-window-title'
            evidence = [ordered]@{
                settingName = 'KOMPAS product version'
                displayedValue = $Window.Title
                verifiedBy = 'Win32 executable version metadata plus visible main-window title'
                capturedAt = $capturedAt
            }
            result = if ($versionPass) { 'PASS' } else { 'FAIL' }
        }
        uiLanguage = [ordered]@{
            expected = 'ru-RU'
            observed = if ($null -ne $settings.uiLanguage) { $settings.uiLanguage.displayedValue } else { $null }
            source = 'official-kompas-ui'
            evidence = [ordered]@{
                settingName = 'Язык'
                displayedValue = if ($null -ne $settings.uiLanguage) { $settings.uiLanguage.displayedValue } else { $null }
                verifiedBy = $KompasSettingsEvidence.verifiedBy
                capturedAt = $KompasSettingsEvidence.capturedAt
                screenshot = $settingsScreenshot
            }
            result = if ($languagePass) { 'PASS' } else { 'FAIL' }
        }
        theme = [ordered]@{
            expected = 'light/effective-light'
            observed = if ($null -ne $settings.theme) { "$($settings.theme.displayedValue) (effective $appTheme)" } else { $null }
            source = 'official-kompas-ui'
            evidence = [ordered]@{
                settingName = 'Тема'
                displayedValue = if ($null -ne $settings.theme) { $settings.theme.displayedValue } else { $null }
                verifiedBy = "$($KompasSettingsEvidence.verifiedBy); effective theme resolved from HKCU Personalize AppsUseLightTheme"
                capturedAt = $KompasSettingsEvidence.capturedAt
                effectiveTheme = $appTheme
                screenshot = $settingsScreenshot
            }
            result = if ($themePass) { 'PASS' } else { 'FAIL' }
        }
        uiSize = [ordered]@{
            expected = 'standard'
            observed = if ($null -ne $settings.uiSize) { $settings.uiSize.displayedValue } else { $null }
            source = 'official-kompas-ui'
            evidence = [ordered]@{
                settingName = 'Размер значков и текста'
                displayedValue = if ($null -ne $settings.uiSize) { $settings.uiSize.displayedValue } else { $null }
                verifiedBy = $KompasSettingsEvidence.verifiedBy
                capturedAt = $KompasSettingsEvidence.capturedAt
                screenshot = $settingsScreenshot
            }
            result = if ($uiSizePass) { 'PASS' } else { 'FAIL' }
        }
        iconStyle = [ordered]@{
            expected = 'monochrome'
            observed = if ($null -ne $settings.iconStyle) { $settings.iconStyle.displayedValue } else { $null }
            source = 'official-kompas-ui'
            evidence = [ordered]@{
                settingName = 'Значки'
                displayedValue = if ($null -ne $settings.iconStyle) { $settings.iconStyle.displayedValue } else { $null }
                verifiedBy = $KompasSettingsEvidence.verifiedBy
                capturedAt = $KompasSettingsEvidence.capturedAt
                screenshot = $settingsScreenshot
            }
            result = if ($iconStylePass) { 'PASS' } else { 'FAIL' }
        }
        panelConfiguration = $panel
        windowsTextScale = [ordered]@{
            expected = 100
            observed = $WindowsAccessibility.textScalePercent
            source = 'windows-runtime-api'
            evidence = [ordered]@{
                settingName = 'Windows Text size'
                displayedValue = $WindowsAccessibility.textScalePercent
                verifiedBy = 'Windows.UI.ViewManagement.UISettings.TextScaleFactor'
                capturedAt = $WindowsAccessibility.capturedAt
                error = $WindowsAccessibility.error
            }
            result = if ($textScalePass) { 'PASS' } else { 'FAIL' }
        }
        highContrast = [ordered]@{
            expected = $false
            observed = $WindowsAccessibility.highContrastEnabled
            source = 'windows-runtime-api'
            evidence = [ordered]@{
                settingName = 'Windows High Contrast'
                displayedValue = $WindowsAccessibility.highContrastEnabled
                verifiedBy = 'Windows.UI.ViewManagement.AccessibilitySettings.HighContrast'
                capturedAt = $WindowsAccessibility.capturedAt
                error = $WindowsAccessibility.error
            }
            result = if ($highContrastPass) { 'PASS' } else { 'FAIL' }
        }
    }
    $requiredFields = @('kompasVersion', 'uiLanguage', 'theme', 'uiSize', 'iconStyle', 'panelConfiguration', 'windowsTextScale', 'highContrast')
    $baselinePass = @($requiredFields | Where-Object { $baselineFields[$_].result -ne 'PASS' }).Count -eq 0

    [ordered]@{
        schemaVersion = 1
        capturedAt = $capturedAt
        canonicalBaselineConfirmed = $baselinePass
        referenceProduct = 'KOMPAS-3D v25'
        baselineConfirmation = [ordered]@{
            capturedAt = $capturedAt
            requiredFields = $requiredFields
            fields = $baselineFields
            errors = @(@(
                    $KompasSettingsEvidence.error
                    $WindowsAccessibility.error
                ) | Where-Object { -not [string]::IsNullOrWhiteSpace($_) })
            result = if ($baselinePass) { 'PASS' } else { 'FAIL' }
        }
        kompas = [ordered]@{
            productVersion = $version.ProductVersion
            fileVersion = $version.FileVersion
            productName = $version.ProductName
            processName = $Window.ProcessName
            processPath = $Window.ProcessPath
            processId = $Window.ProcessId
            windowTitle = $Window.Title
            uiLanguage = if ($languagePass) { 'ru-RU' } else { $null }
            theme = if ($themePass) { 'light' } else { 'unknown' }
            themeDisplayedName = if ($null -ne $settings.theme) { $settings.theme.displayedValue } else { $null }
            uiSizeMode = if ($uiSizePass) { 'standard' } else { 'unknown' }
            uiSizeDisplayedName = if ($null -ne $settings.uiSize) { $settings.uiSize.displayedValue } else { $null }
            iconStyle = if ($iconStylePass) { 'monochrome' } else { 'unknown' }
            iconStyleDisplayedName = if ($null -ne $settings.iconStyle) { $settings.iconStyle.displayedValue } else { $null }
            activeDocumentType = 'part-empty'
            panelConfiguration = if ($panel.result -eq 'PASS') { 'normal-docked-desktop' } else { 'unknown' }
        }
        windows = [ordered]@{
            caption = $os.Caption
            version = $os.Version
            build = $os.BuildNumber
            architecture = $os.OSArchitecture
            language = [Globalization.CultureInfo]::CurrentUICulture.Name
            dpiAwareness = $DpiAwareness
            dpi = [ordered]@{ x = $Window.DpiX; y = $Window.DpiY }
            scalePercent = $Window.WindowsScalePercent
            textScalePercent = Get-WindowsTextScalePercent -AccessibilitySnapshot $WindowsAccessibility
            highContrastEnabled = $WindowsAccessibility.highContrastEnabled
            systemTheme = $systemTheme
            appTheme = $appTheme
            systemAccentColor = 'unknown'
            fontSmoothingEnabled = 'unknown'
            hdrMode = 'unknown'
        }
        monitor = [ordered]@{
            id = $Window.MonitorDeviceName
            boundsPhysicalPx = $Window.MonitorBoundsPhysicalPx
            workAreaPhysicalPx = $Window.MonitorWorkAreaPhysicalPx
        }
        window = [ordered]@{
            hwnd = ('0x{0:X}' -f $Window.Hwnd)
            windowRectPhysicalPx = $Window.WindowRectPhysicalPx
            extendedFrameRectPhysicalPx = $Window.ExtendedFrameRectPhysicalPx
            clientRectScreenPhysicalPx = $Window.ClientRectScreenPhysicalPx
        }
        captureTool = [ordered]@{
            version = 1
            gitSha = $CaptureToolGitSha
        }
    }
}
