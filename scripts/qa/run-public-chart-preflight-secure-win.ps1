[CmdletBinding()]
param(
    [string]$CredentialPath = ""
)

$ErrorActionPreference = 'Stop'

function Redact-Text($Text, $Email, $Password) {
    $safe = [string]$Text
    if ($Email) { $safe = $safe -replace [regex]::Escape($Email), '[QA_HOST_EMAIL]' }
    if ($Password) { $safe = $safe -replace [regex]::Escape($Password), '[QA_HOST_PASSWORD]' }
    $safe = $safe -replace '[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}', '[EMAIL_REDACTED]'
    return $safe
}

if (-not $CredentialPath) {
    $appDataRoot = if ($env:APPDATA) { $env:APPDATA } else { Join-Path $HOME 'AppData\Roaming' }
    $CredentialPath = Join-Path $appDataRoot 'BeauRocks\qa\qa-host-credential.xml'
}
if (-not (Test-Path -LiteralPath $CredentialPath)) {
    throw 'Stored QA credential is missing. Run run-admin-prod-secure-win.ps1 -SaveCredential first.'
}

$credential = Import-Clixml -LiteralPath $CredentialPath
$credentialIsValid = $null -ne $credential -and -not [string]::IsNullOrWhiteSpace([string]$credential.UserName)
if (-not $credentialIsValid) { throw 'Stored QA credential could not be loaded.' }
$qaEmail = [string]$credential.UserName
$networkCredential = $credential.GetNetworkCredential()
if ($null -eq $networkCredential) { throw 'Stored QA credential could not be decrypted for this Windows user.' }
$qaPassword = [string]$networkCredential.Password
if (-not $qaEmail -or -not $qaPassword) { throw 'Stored QA credential is incomplete.' }

$allowedEmailText = [string]$env:QA_ALLOWED_HOST_EMAILS
if ([string]::IsNullOrWhiteSpace($allowedEmailText)) { throw 'QA_ALLOWED_HOST_EMAILS is required.' }
$allowedEmails = @(($allowedEmailText -split ',') | ForEach-Object { ([string]$_).Trim().ToLowerInvariant() } | Where-Object { $_ })
if ($allowedEmails -notcontains $qaEmail.Trim().ToLowerInvariant()) {
    throw 'Stored QA host email is not allowlisted.'
}

New-Item -ItemType Directory -Force -Path 'tmp' | Out-Null
$sanitizedLogPath = 'tmp\public-chart-launch-preflight.sanitized.log'

$psi = [System.Diagnostics.ProcessStartInfo]::new()
$psi.FileName = 'node.exe'
$psi.Arguments = '"scripts/qa/public-chart-launch-preflight.mjs"'
$psi.WorkingDirectory = (Get-Location).Path
$psi.UseShellExecute = $false
$psi.RedirectStandardOutput = $true
$psi.RedirectStandardError = $true
$psi.Environment['QA_HOST_EMAIL'] = $qaEmail
$psi.Environment['QA_HOST_PASSWORD'] = $qaPassword

$process = [System.Diagnostics.Process]::new()
$process.StartInfo = $psi
[void]$process.Start()
$stdout = $process.StandardOutput.ReadToEnd()
$stderr = $process.StandardError.ReadToEnd()
$process.WaitForExit()
$exitCode = $process.ExitCode

$combined = $stdout
if ($stderr) { $combined = "$combined`r`n$stderr" }
$sanitized = Redact-Text -Text $combined -Email $qaEmail -Password $qaPassword
$sanitized = "$sanitized`r`nEXIT_CODE=$exitCode`r`n"
Set-Content -LiteralPath $sanitizedLogPath -Value $sanitized -NoNewline

$env:QA_HOST_EMAIL = $null
$env:QA_HOST_PASSWORD = $null
$qaPassword = $null

Write-Host $sanitized
Write-Host "[public-chart-preflight] Sanitized log: $sanitizedLogPath"
exit $exitCode
