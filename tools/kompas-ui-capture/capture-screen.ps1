Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

function Save-KompasClientScreenshot {
    param(
        [Parameter(Mandatory)] [long] $Hwnd,
        [Parameter(Mandatory)] [string] $Path
    )

    $result = [AsaCad.KompasCapture.NativeCapture]::CaptureClientPng($Hwnd, $Path)
    if (-not (Test-Path -LiteralPath $result.LocalPath)) {
        throw "Screenshot was not created at $($result.LocalPath)"
    }
    $hash = (Get-FileHash -LiteralPath $result.LocalPath -Algorithm SHA256).Hash.ToLowerInvariant()
    [ordered]@{
        captureMethod = $result.CaptureMethod
        localPath = $result.LocalPath
        width = $result.Width
        height = $result.Height
        sha256 = $hash
        capturedAt = [DateTimeOffset]::UtcNow.ToString('o')
        captureRectPhysicalPx = $result.CaptureRectPhysicalPx
        windowWasForeground = $result.WindowWasForeground
        windowWasUnobscured = $result.WindowWasUnobscured
        cursorIncluded = $result.CursorIncluded
        scaledAfterCapture = $false
    }
}
