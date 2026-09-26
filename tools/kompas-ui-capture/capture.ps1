[CmdletBinding()]
param(
    [ValidateSet('part-empty')]
    [string] $State = 'part-empty',
    [string] $OutputRoot = (Join-Path (Resolve-Path (Join-Path $PSScriptRoot '..\..')) 'spec\ui\kompas-v25'),
    [string] $ScreenshotRoot = 'C:\Users\spike\Documents\VisualReviews\ASA-CAD\KOMPAS-v25',
    [int] $TargetClientWidth = 1920,
    [int] $TargetClientHeight = 1080,
    [switch] $SkipResize,
    [switch] $KeepCaptureSize
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
. (Join-Path $PSScriptRoot 'capture-ui.ps1')
. (Join-Path $PSScriptRoot 'capture-screen.ps1')

function Write-JsonUtf8Lf {
    param(
        [Parameter(Mandatory)] $Value,
        [Parameter(Mandatory)] [string] $Path
    )
    $json = ($Value | ConvertTo-Json -Depth 100) -replace "`r`n", "`n"
    [IO.File]::WriteAllText($Path, $json + "`n", [Text.UTF8Encoding]::new($false))
}

Import-KompasCaptureNative
$dpiAwareness = [AsaCad.KompasCapture.NativeCapture]::EnsureDpiAwareness()
$window = Get-KompasCaptureWindow
$originalOuterRect = $window.WindowRectPhysicalPx
$captureToolGitSha = (& git -C (Join-Path $PSScriptRoot '..\..') log -1 --format=%H -- tools/kompas-ui-capture).Trim()
if ([string]::IsNullOrWhiteSpace($captureToolGitSha)) {
    throw 'Capture tool must be committed before producing provenance-bearing reference data.'
}

$stateDir = Join-Path $OutputRoot "states\$State"
$screenshotDir = Join-Path $ScreenshotRoot $State
$screenshotPath = Join-Path $screenshotDir 'kompas.png'
$baselineEvidencePath = Join-Path $ScreenshotRoot 'baseline-evidence\kompas-interface.png'
New-Item -ItemType Directory -Force -Path $stateDir, $screenshotDir | Out-Null

try {
    $resize = if ($SkipResize) {
        [ordered]@{ attempted = $false; success = $true; targetWidth = $TargetClientWidth; targetHeight = $TargetClientHeight; message = 'resize skipped by operator' }
    } else {
        [AsaCad.KompasCapture.NativeCapture]::ResizeClient($window.Hwnd, $TargetClientWidth, $TargetClientHeight)
    }
    $kompasSettingsEvidence = Get-KompasOfficialSettingsEvidence -MainWindow $window -ScreenshotPath $baselineEvidencePath
    $windowsAccessibility = Get-WindowsAccessibilitySnapshot
    $stable = Get-KompasStableState -Hwnd $window.Hwnd
    $window = [AsaCad.KompasCapture.NativeCapture]::ReadWindow($window.Hwnd)
    $screenshot = Save-KompasClientScreenshot -Hwnd $window.Hwnd -Path $screenshotPath
    $environment = Get-KompasEnvironment -Window $window -UiaTree $stable.tree -KompasSettingsEvidence $kompasSettingsEvidence -WindowsAccessibility $windowsAccessibility -DpiAwareness $dpiAwareness -CaptureToolGitSha $captureToolGitSha

    $environmentPath = Join-Path $OutputRoot 'environment.json'
    Write-JsonUtf8Lf -Value $environment -Path $environmentPath
    $environmentHash = (Get-FileHash -LiteralPath $environmentPath -Algorithm SHA256).Hash.ToLowerInvariant()

    $uia = [ordered]@{
        schemaVersion = 1
        stateId = $State
        capturedAt = [DateTimeOffset]::UtcNow.ToString('o')
        view = $stable.tree.View
        coverage = if ($stable.tree.VisibleNodeCount -gt 0) { 'partial' } else { 'fail' }
        totalNodeCount = $stable.tree.TotalNodeCount
        visibleNodeCount = $stable.tree.VisibleNodeCount
        validBoundingRectCount = $stable.tree.ValidBoundingRectCount
        namedNodeCount = $stable.tree.NamedNodeCount
        truncated = $stable.tree.Truncated
        root = $stable.tree.Root
    }
    $uiaPath = Join-Path $stateDir 'uia-tree.json'
    Write-JsonUtf8Lf -Value $uia -Path $uiaPath

    $raw = [ordered]@{
        schemaVersion = 1
        stateId = $State
        canonicalBaselineConfirmed = $environment.canonicalBaselineConfirmed
        environmentPath = 'environment.json'
        environmentSha256 = $environmentHash
        captureToolGitSha = $captureToolGitSha
        window = $window
        resize = $resize
        stability = $stable | Select-Object -ExcludeProperty tree
        screenshot = $screenshot
        uiaPath = 'uia-tree.json'
    }
    $rawPath = Join-Path $stateDir '.capture-raw.json'
    Write-JsonUtf8Lf -Value $raw -Path $rawPath

    & node (Join-Path $PSScriptRoot 'normalize-layout.mjs') --root $OutputRoot --state $State
    if ($LASTEXITCODE -ne 0) { throw "normalize-layout.mjs failed with exit code $LASTEXITCODE" }
}
finally {
    if (-not $KeepCaptureSize) {
        [AsaCad.KompasCapture.NativeCapture]::RestoreWindow($window.Hwnd, $originalOuterRect)
    }
}
