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

function Get-WindowsTextScalePercent {
    $settings = Get-ItemProperty -LiteralPath 'HKCU:\Software\Microsoft\Accessibility' -ErrorAction SilentlyContinue
    if ($null -eq $settings -or 'TextScaleFactor' -notin $settings.PSObject.Properties.Name) { return 100 }
    return [int]$settings.TextScaleFactor
}

function Get-KompasEnvironment {
    param(
        [Parameter(Mandatory)] $Window,
        [Parameter(Mandatory)] [string] $DpiAwareness,
        [Parameter(Mandatory)] [string] $CaptureToolGitSha,
        [Parameter(Mandatory)] [bool] $CanonicalBaselineConfirmed,
        [Parameter(Mandatory)] [string] $KompasTheme,
        [Parameter(Mandatory)] [string] $KompasThemeDisplayedName,
        [Parameter(Mandatory)] [string] $KompasUiSize,
        [Parameter(Mandatory)] [string] $KompasUiSizeDisplayedName,
        [Parameter(Mandatory)] [string] $KompasIconStyle,
        [Parameter(Mandatory)] [string] $KompasIconStyleDisplayedName,
        [Parameter(Mandatory)] [string] $PanelConfiguration
    )

    $file = Get-Item -LiteralPath $Window.ProcessPath
    $version = $file.VersionInfo
    $os = Get-CimInstance Win32_OperatingSystem
    $personalize = Get-ItemProperty -LiteralPath 'HKCU:\Software\Microsoft\Windows\CurrentVersion\Themes\Personalize' -ErrorAction SilentlyContinue
    $highContrast = Get-ItemProperty -LiteralPath 'HKCU:\Control Panel\Accessibility\HighContrast' -ErrorAction SilentlyContinue
    $highContrastEnabled = $false
    if ($null -ne $highContrast -and $null -ne $highContrast.Flags) {
        $highContrastEnabled = ([int]$highContrast.Flags -band 1) -eq 1
    }

    [ordered]@{
        schemaVersion = 1
        capturedAt = [DateTimeOffset]::UtcNow.ToString('o')
        canonicalBaselineConfirmed = $CanonicalBaselineConfirmed
        referenceProduct = 'KOMPAS-3D v25'
        kompas = [ordered]@{
            productVersion = $version.ProductVersion
            fileVersion = $version.FileVersion
            productName = $version.ProductName
            processName = $Window.ProcessName
            processPath = $Window.ProcessPath
            processId = $Window.ProcessId
            windowTitle = $Window.Title
            uiLanguage = 'ru-RU'
            theme = $KompasTheme
            themeDisplayedName = $KompasThemeDisplayedName
            uiSizeMode = $KompasUiSize
            uiSizeDisplayedName = $KompasUiSizeDisplayedName
            iconStyle = $KompasIconStyle
            iconStyleDisplayedName = $KompasIconStyleDisplayedName
            activeDocumentType = 'part-empty'
            panelConfiguration = $PanelConfiguration
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
            textScalePercent = Get-WindowsTextScalePercent
            highContrastEnabled = $highContrastEnabled
            systemTheme = if ($personalize.SystemUsesLightTheme -eq 1) { 'light' } else { 'dark' }
            appTheme = if ($personalize.AppsUseLightTheme -eq 1) { 'light' } else { 'dark' }
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
