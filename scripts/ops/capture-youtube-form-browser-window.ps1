param(
    [Parameter(Mandatory = $true)]
    [string]$Url,

    [Parameter(Mandatory = $true)]
    [string]$OutputPath,

    [string]$FindText = "",
    [ValidateSet("", "plain", "host-curator", "host-curator-fallback", "tv-player")]
    [string]$Scenario = "",
    [int]$LoadSeconds = 8
)

$ErrorActionPreference = "Stop"

$browserPath = "C:\Program Files\Google\Chrome\Application\chrome.exe"
$browserProcessName = "chrome"
if (-not (Test-Path -LiteralPath $browserPath)) {
    throw "Google Chrome was not found at $browserPath"
}

$outputFullPath = [System.IO.Path]::GetFullPath((Join-Path (Get-Location) $OutputPath))
$outputDirectory = Split-Path -Parent $outputFullPath
New-Item -ItemType Directory -Force -Path $outputDirectory | Out-Null

$profileRoot = Join-Path $env:TEMP ("beaurocks-youtube-evidence-" + [Guid]::NewGuid().ToString("N"))
$remoteDebugPort = Get-Random -Minimum 9300 -Maximum 9800
$startedAt = Get-Date
$arguments = @(
    "--new-window",
    "--window-size=1296,816",
    "--window-position=0,0",
    "--no-first-run",
    "--no-default-browser-check",
    "--disable-default-apps",
    "--disable-extensions",
    "--remote-debugging-port=$remoteDebugPort",
    "--remote-allow-origins=*",
    "--user-data-dir=$profileRoot",
    $Url
)

Start-Process -FilePath $browserPath -ArgumentList $arguments | Out-Null
Start-Sleep -Seconds $LoadSeconds

Add-Type -AssemblyName System.Drawing
Add-Type -AssemblyName System.Windows.Forms
Add-Type @"
using System;
using System.Runtime.InteropServices;

public static class EvidenceWindowApi
{
    [StructLayout(LayoutKind.Sequential)]
    public struct Rect
    {
        public int Left;
        public int Top;
        public int Right;
        public int Bottom;
    }

    [DllImport("user32.dll")]
    public static extern bool GetWindowRect(IntPtr hWnd, out Rect rect);

    [DllImport("user32.dll")]
    public static extern bool SetForegroundWindow(IntPtr hWnd);

    [DllImport("user32.dll")]
    public static extern bool ShowWindow(IntPtr hWnd, int command);

    [DllImport("user32.dll")]
    public static extern bool MoveWindow(IntPtr hWnd, int x, int y, int width, int height, bool repaint);

    [DllImport("user32.dll")]
    public static extern IntPtr SetThreadDpiAwarenessContext(IntPtr dpiContext);
}
"@

# Use physical pixels for both window bounds and CopyFromScreen so a scaled
# display cannot make the capture spill onto an adjacent monitor.
[EvidenceWindowApi]::SetThreadDpiAwarenessContext([IntPtr](-4)) | Out-Null

if (-not $Scenario) {
    $Scenario = "plain"
}

& node "scripts/ops/prepare-youtube-form-browser-window.mjs" `
    "--port=$remoteDebugPort" `
    "--scenario=$Scenario" `
    "--url=$Url" `
    "--find-text=$FindText"
if ($LASTEXITCODE -ne 0) {
    throw "Browser preparation failed for scenario $Scenario."
}

$profilePattern = [Regex]::Escape($profileRoot)
$mainBrowserProcess = Get-CimInstance Win32_Process -Filter "Name = 'chrome.exe'" -ErrorAction SilentlyContinue |
    Where-Object { $_.CommandLine -match $profilePattern -and $_.CommandLine -notmatch "--type=" } |
    Select-Object -First 1
$browserWindow = if ($mainBrowserProcess) {
    Get-Process -Id $mainBrowserProcess.ProcessId -ErrorAction SilentlyContinue
}

if (-not $browserWindow) {
    throw "Could not find the isolated BeauRocks evidence window."
}

[EvidenceWindowApi]::ShowWindow($browserWindow.MainWindowHandle, 9) | Out-Null
[EvidenceWindowApi]::MoveWindow($browserWindow.MainWindowHandle, 0, 0, 1296, 816, $true) | Out-Null
[EvidenceWindowApi]::SetForegroundWindow($browserWindow.MainWindowHandle) | Out-Null
Start-Sleep -Seconds 2

$rect = New-Object EvidenceWindowApi+Rect
if (-not [EvidenceWindowApi]::GetWindowRect($browserWindow.MainWindowHandle, [ref]$rect)) {
    throw "Could not read the Chrome window bounds."
}

$windowWidth = $rect.Right - $rect.Left
$windowHeight = $rect.Bottom - $rect.Top
$width = [Math]::Min(1280, $windowWidth)
$height = [Math]::Min(800, $windowHeight)
if ($width -lt 1280 -or $height -lt 720) {
    throw "Evidence window is only ${width}x${height}; Google requires at least 1280x720."
}

$bitmap = New-Object System.Drawing.Bitmap $width, $height
$graphics = [System.Drawing.Graphics]::FromImage($bitmap)
try {
    $graphics.CopyFromScreen($rect.Left, $rect.Top, 0, 0, $bitmap.Size)
    $bitmap.Save($outputFullPath, [System.Drawing.Imaging.ImageFormat]::Png)
}
finally {
    $graphics.Dispose()
    $bitmap.Dispose()
}

Get-CimInstance Win32_Process -Filter "Name = 'chrome.exe'" -ErrorAction SilentlyContinue |
    Where-Object { $_.CommandLine -match $profilePattern } |
    ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }

Write-Output "Captured $outputFullPath (${width}x${height})"
