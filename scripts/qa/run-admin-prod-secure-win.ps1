[CmdletBinding()]
param(
    [switch]$SaveCredential,
    [switch]$ResetCredential,
    [switch]$ForgetCredential,
    [switch]$CheckOnly,
    [switch]$KeepRawLog,
    [string]$CredentialPath = ""
)

$ErrorActionPreference = 'Stop'

function Write-Info($Message) {
    Write-Host "[qa-admin-prod-secure-win] $Message"
}

function Normalize-EmailList($Value) {
    return @(
        ($Value -split ',') |
            ForEach-Object { [string]$_ } |
            ForEach-Object { $_.Trim().ToLowerInvariant() } |
            Where-Object { $_ }
    )
}

function Redact-Text($Text, $Email, $Password) {
    $safe = [string]$Text
    if ($Email) {
        $safe = $safe -replace [regex]::Escape($Email), '[QA_HOST_EMAIL]'
    }
    if ($Password) {
        $safe = $safe -replace [regex]::Escape($Password), '[QA_HOST_PASSWORD]'
    }
    $safe = $safe -replace '[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}', '[EMAIL_REDACTED]'
    return $safe
}

if (-not $IsWindows -and $PSVersionTable.PSEdition -eq 'Core') {
    throw 'This secure runner uses Windows DPAPI via Export-Clixml and must run on Windows.'
}

if (-not $CredentialPath) {
    $appDataRoot = if ($env:APPDATA) { $env:APPDATA } else { Join-Path $HOME 'AppData\Roaming' }
    $CredentialPath = Join-Path $appDataRoot 'BeauRocks\qa\qa-host-credential.xml'
}

$credentialDir = Split-Path -Parent $CredentialPath
New-Item -ItemType Directory -Force -Path $credentialDir | Out-Null
New-Item -ItemType Directory -Force -Path 'tmp' | Out-Null

if ($ForgetCredential) {
    if (Test-Path -LiteralPath $CredentialPath) {
        Remove-Item -LiteralPath $CredentialPath -Force
        Write-Info "Removed stored credential: $CredentialPath"
    } else {
        Write-Info "No stored credential found at: $CredentialPath"
    }
    exit 0
}

if ($ResetCredential -and (Test-Path -LiteralPath $CredentialPath)) {
    Remove-Item -LiteralPath $CredentialPath -Force
    Write-Info 'Removed previous stored credential before reset.'
}

if ($SaveCredential -or -not (Test-Path -LiteralPath $CredentialPath)) {
    Write-Info 'Opening Windows credential prompt. Use the dedicated low-privilege QA host account.'
    $credential = Get-Credential -Message 'Enter BeauRocks QA host email and password'
    if (-not $credential -or -not $credential.UserName) {
        throw 'No QA host credential was provided.'
    }
    $credential | Export-Clixml -LiteralPath $CredentialPath
    Write-Info "Stored Windows-encrypted credential at: $CredentialPath"
}

$qaCredential = Import-Clixml -LiteralPath $CredentialPath
if (-not $qaCredential -or -not $qaCredential.UserName) {
    throw "Could not load stored QA credential from: $CredentialPath"
}

$qaEmail = [string]$qaCredential.UserName
$qaPassword = $qaCredential.GetNetworkCredential().Password
if (-not $qaEmail -or -not $qaPassword) {
    throw 'Stored QA credential is incomplete. Run again with -ResetCredential.'
}

if (-not $env:QA_APP_CHECK_DEBUG_TOKEN) {
    throw 'QA_APP_CHECK_DEBUG_TOKEN is required in the current environment before running production admin QA.'
}

$allowedEmails = Normalize-EmailList $env:QA_ALLOWED_HOST_EMAILS
if ($allowedEmails.Count -eq 0) {
    throw 'QA_ALLOWED_HOST_EMAILS is required and must include the dedicated QA host email.'
}

$normalizedEmail = $qaEmail.Trim().ToLowerInvariant()
if ($allowedEmails -notcontains $normalizedEmail) {
    throw 'Stored QA host email is not in QA_ALLOWED_HOST_EMAILS. Refusing to run production QA with this account.'
}

if ($CheckOnly) {
    Write-Info 'Credential loaded, App Check token present, and QA host email is allowlisted.'
    Write-Info "Credential path: $CredentialPath"
    exit 0
}

$rawLogPath = 'tmp\qa-admin-prod.raw.log'
$sanitizedLogPath = 'tmp\qa-admin-prod.sanitized.log'
if (Test-Path -LiteralPath $rawLogPath) { Remove-Item -LiteralPath $rawLogPath -Force }
if (Test-Path -LiteralPath $sanitizedLogPath) { Remove-Item -LiteralPath $sanitizedLogPath -Force }

Write-Info 'Running npm run qa:admin:prod with QA credentials scoped to the child process.'

$psi = [System.Diagnostics.ProcessStartInfo]::new()
$psi.FileName = if ($env:ComSpec) { $env:ComSpec } else { 'cmd.exe' }
$psi.ArgumentList.Add('/d')
$psi.ArgumentList.Add('/c')
$psi.ArgumentList.Add('npm run qa:admin:prod')
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

$rawOutput = $stdout
if ($stderr) {
    $rawOutput = "$rawOutput`r`n$stderr"
}

$sanitized = Redact-Text -Text $rawOutput -Email $qaEmail -Password $qaPassword
$sanitized = "$sanitized`r`nEXIT_CODE=$exitCode`r`n"
Set-Content -LiteralPath $sanitizedLogPath -Value $sanitized -NoNewline

if ($KeepRawLog) {
    $raw = Redact-Text -Text $rawOutput -Email $qaEmail -Password $qaPassword
    Set-Content -LiteralPath $rawLogPath -Value $raw -NoNewline
    Write-Info "Kept redacted raw log at: $rawLogPath"
}

$env:QA_HOST_EMAIL = $null
$env:QA_HOST_PASSWORD = $null
$qaPassword = $null

Write-Info "Sanitized log: $sanitizedLogPath"
Write-Info "Exit code: $exitCode"
exit $exitCode