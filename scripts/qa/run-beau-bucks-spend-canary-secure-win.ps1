[CmdletBinding()]
param(
    [string]$CredentialPath = ""
)

$ErrorActionPreference = 'Stop'

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
    if ($Email) { $safe = $safe -replace [regex]::Escape($Email), '[QA_HOST_EMAIL]' }
    if ($Password) { $safe = $safe -replace [regex]::Escape($Password), '[QA_HOST_PASSWORD]' }
    return $safe -replace '[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}', '[EMAIL_REDACTED]'
}

if (-not $CredentialPath) {
    $appDataRoot = if ($env:APPDATA) { $env:APPDATA } else { Join-Path $HOME 'AppData\Roaming' }
    $CredentialPath = Join-Path $appDataRoot 'BeauRocks\qa\qa-host-credential.xml'
}
if (-not (Test-Path -LiteralPath $CredentialPath)) {
    throw "Stored QA credential not found. Initialize it with the admin secure runner: $CredentialPath"
}
if (-not $env:QA_APP_CHECK_DEBUG_TOKEN) {
    throw 'QA_APP_CHECK_DEBUG_TOKEN is required.'
}

$credential = Import-Clixml -LiteralPath $CredentialPath
$qaEmail = [string]$credential.UserName
$qaPassword = $credential.GetNetworkCredential().Password
if (-not $qaEmail -or -not $qaPassword) { throw 'Stored QA credential is incomplete.' }

$allowedEmails = Normalize-EmailList $env:QA_ALLOWED_HOST_EMAILS
if ($allowedEmails.Count -eq 0 -or $allowedEmails -notcontains $qaEmail.Trim().ToLowerInvariant()) {
    throw 'Stored QA host email is not explicitly allowlisted in QA_ALLOWED_HOST_EMAILS.'
}

$npmCommand = (Get-Command npm.cmd -ErrorAction Stop).Source
$psi = [System.Diagnostics.ProcessStartInfo]::new()
$psi.FileName = $npmCommand
$psi.Arguments = 'run qa:beaubucks:spend-canary'
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

$combined = if ($stderr) { "$stdout`r`n$stderr" } else { $stdout }
$sanitized = Redact-Text -Text $combined -Email $qaEmail -Password $qaPassword
$qaPassword = $null
Write-Output $sanitized
exit $process.ExitCode
