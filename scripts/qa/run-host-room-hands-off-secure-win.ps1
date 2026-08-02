[CmdletBinding()]
param(
    [switch]$CheckOnly,
    [switch]$KeepSanitizedLog,
    [string]$CredentialPath = "",
    [string]$AppCheckTokenPath = ""
)

$ErrorActionPreference = 'Stop'

function Write-Info($Message) {
    Write-Host "[qa-core-night-secure-win] $Message"
}

function Normalize-EmailList($Value) {
    return @(
        ($Value -split ',') |
            ForEach-Object { [string]$_ } |
            ForEach-Object { $_.Trim().ToLowerInvariant() } |
            Where-Object { $_ }
    )
}

function Redact-Text($Text, $Email, $Password, $AppCheckToken) {
    $safe = [string]$Text
    if ($Email) {
        $safe = $safe -replace [regex]::Escape($Email), '[QA_HOST_EMAIL]'
    }
    if ($Password) {
        $safe = $safe -replace [regex]::Escape($Password), '[QA_HOST_PASSWORD]'
    }
    if ($AppCheckToken) {
        $safe = $safe -replace [regex]::Escape($AppCheckToken), '[QA_APP_CHECK_DEBUG_TOKEN]'
    }
    $safe = $safe -replace '[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}', '[EMAIL_REDACTED]'
    return $safe
}

if (-not $IsWindows -and $PSVersionTable.PSEdition -eq 'Core') {
    throw 'This secure runner uses Windows DPAPI via Import-Clixml and must run on Windows.'
}

if (-not $CredentialPath) {
    $appDataRoot = [Environment]::GetFolderPath([Environment+SpecialFolder]::ApplicationData)
    $CredentialPath = Join-Path $appDataRoot 'BeauRocks\qa\qa-host-credential.xml'
}

if (-not $AppCheckTokenPath) {
    $appDataRoot = [Environment]::GetFolderPath([Environment+SpecialFolder]::ApplicationData)
    $AppCheckTokenPath = Join-Path $appDataRoot 'BeauRocks\qa\qa-app-check-debug-token.xml'
}

if (-not (Test-Path -LiteralPath $CredentialPath)) {
    throw 'Stored QA credential is missing. Initialize it with npm run qa:admin:prod:secure:win -- -SaveCredential.'
}

$qaCredential = Import-Clixml -LiteralPath $CredentialPath
$qaEmail = [string]$qaCredential.UserName
$networkCredential = $qaCredential.GetNetworkCredential()
$qaPassword = if ($null -ne $networkCredential) { [string]$networkCredential.Password } else { '' }
if (-not $qaEmail -or -not $qaPassword) {
    throw 'Stored QA credential could not be decrypted or is incomplete.'
}

$qaAppCheckToken = ''
if (Test-Path -LiteralPath $AppCheckTokenPath) {
    $secureAppCheckToken = Import-Clixml -LiteralPath $AppCheckTokenPath
    $appCheckCredential = New-Object System.Net.NetworkCredential('', $secureAppCheckToken)
    $qaAppCheckToken = [string]$appCheckCredential.Password
} elseif ($env:QA_APP_CHECK_DEBUG_TOKEN) {
    $qaAppCheckToken = [string]$env:QA_APP_CHECK_DEBUG_TOKEN
}
if (-not $qaAppCheckToken) {
    throw 'A Windows-encrypted App Check debug token or QA_APP_CHECK_DEBUG_TOKEN is required before running production core-night QA.'
}

$allowedEmails = Normalize-EmailList $env:QA_ALLOWED_HOST_EMAILS
if ($allowedEmails.Count -eq 0) {
    throw 'QA_ALLOWED_HOST_EMAILS is required and must include the dedicated QA host email.'
}

$normalizedEmail = $qaEmail.Trim().ToLowerInvariant()
if ($allowedEmails -notcontains $normalizedEmail) {
    throw 'Stored QA host email is not in QA_ALLOWED_HOST_EMAILS. Refusing to run production QA.'
}

$blockedEmails = @('hello@beauross.com') + (Normalize-EmailList $env:SUPER_ADMIN_EMAILS) + (Normalize-EmailList $env:QA_BLOCKED_HOST_EMAILS)
$allowSuperAdmin = @('1', 'true', 'yes', 'on') -contains ([string]$env:QA_ALLOW_SUPERADMIN).Trim().ToLowerInvariant()
if (-not $allowSuperAdmin -and $blockedEmails -contains $normalizedEmail) {
    throw 'Stored QA host email matches the blocked/super-admin policy. Use a dedicated low-privilege QA account.'
}

if ($CheckOnly) {
    $qaPassword = $null
    $qaAppCheckToken = $null
    Write-Info 'Credential loaded, encrypted App Check token present, and QA host email is allowlisted.'
    exit 0
}

$tmpDir = Join-Path (Get-Location).Path 'tmp'
New-Item -ItemType Directory -Force -Path $tmpDir | Out-Null
$sanitizedLogPath = Join-Path $tmpDir 'qa-core-night.sanitized.log'

Write-Info 'Running the production core-night gate with the saved Windows-encrypted credential.'

$psi = [System.Diagnostics.ProcessStartInfo]::new()
$psi.FileName = if ($env:ComSpec) { $env:ComSpec } else { 'cmd.exe' }
$psi.Arguments = '/d /c "npm run qa:golden:host-room-hands-off"'
$psi.WorkingDirectory = (Get-Location).Path
$psi.UseShellExecute = $false
$psi.RedirectStandardOutput = $true
$psi.RedirectStandardError = $true
$psi.EnvironmentVariables['QA_HOST_EMAIL'] = $qaEmail
$psi.EnvironmentVariables['QA_HOST_PASSWORD'] = $qaPassword
$psi.EnvironmentVariables['QA_APP_CHECK_DEBUG_TOKEN'] = $qaAppCheckToken
$psi.EnvironmentVariables['DEBUG'] = ''

$process = [System.Diagnostics.Process]::new()
$process.StartInfo = $psi
[void]$process.Start()
$stdout = $process.StandardOutput.ReadToEnd()
$stderr = $process.StandardError.ReadToEnd()
$process.WaitForExit()
$exitCode = $process.ExitCode

$combinedOutput = $stdout
if ($stderr) {
    $combinedOutput = $combinedOutput + [Environment]::NewLine + $stderr
}
$sanitized = Redact-Text -Text $combinedOutput -Email $qaEmail -Password $qaPassword -AppCheckToken $qaAppCheckToken

if ($KeepSanitizedLog -or $exitCode -ne 0) {
    $logText = $sanitized + [Environment]::NewLine + "EXIT_CODE=$exitCode" + [Environment]::NewLine
    Set-Content -LiteralPath $sanitizedLogPath -Value $logText -NoNewline
    Write-Info "Sanitized log: $sanitizedLogPath"
}

$qaPassword = $null
$qaAppCheckToken = $null
$secureAppCheckToken = $null
$appCheckCredential = $null
$networkCredential = $null
$qaCredential = $null

Write-Output $sanitized
Write-Info "Exit code: $exitCode"
exit $exitCode
