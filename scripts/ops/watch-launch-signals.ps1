param(
  [string]$ProjectId = "",
  [int]$WindowMinutes = 60,
  [string]$OutFile = ""
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

function Resolve-ProjectId {
  param([string]$InputProjectId)
  if ($InputProjectId) { return $InputProjectId }
  $resolved = (gcloud config get-value project 2>$null).Trim()
  if (-not $resolved) { throw "ProjectId not provided and gcloud project is empty." }
  return $resolved
}

function Read-Logs {
  param(
    [Parameter(Mandatory = $true)][string]$Project,
    [Parameter(Mandatory = $true)][string]$Filter,
    [int]$Limit = 200
  )
  $raw = gcloud logging read "$Filter" --project=$Project --freshness="$($WindowMinutes)m" --limit=$Limit --format=json 2>$null
  if ($LASTEXITCODE -ne 0 -or -not $raw) { return @() }
  $parsed = $raw | ConvertFrom-Json
  if ($parsed -is [System.Array]) { return $parsed }
  return @($parsed)
}

function Read-FieldOrNull {
  param(
    [Parameter(Mandatory = $true)][object]$Entry,
    [Parameter(Mandatory = $true)][string]$FieldName
  )
  $props = $Entry.PSObject.Properties.Name
  if ($props -contains $FieldName) {
    return $Entry.$FieldName
  }
  return $null
}

$project = Resolve-ProjectId -InputProjectId $ProjectId

$errorFilter = 'resource.type="cloud_run_revision" AND severity>=ERROR'
$appCheckMissingFilter = 'resource.type="cloud_run_revision" AND textPayload:"[app-check]"'
$hostUpdateFilter = 'resource.type="cloud_run_revision" AND resource.labels.service_name="updateroomashost"'
$awardPointsFilter = 'resource.type="cloud_run_revision" AND resource.labels.service_name="awardroompoints"'
$demoDirectorFilter = 'resource.type="cloud_run_revision" AND resource.labels.service_name="rundemodirectoraction"'

$errorLogs = Read-Logs -Project $project -Filter $errorFilter
$appCheckMissingLogs = Read-Logs -Project $project -Filter $appCheckMissingFilter
$hostUpdateLogs = Read-Logs -Project $project -Filter $hostUpdateFilter
$awardPointsLogs = Read-Logs -Project $project -Filter $awardPointsFilter
$demoDirectorLogs = Read-Logs -Project $project -Filter $demoDirectorFilter

$summary = [ordered]@{
  projectId = $project
  windowMinutes = $WindowMinutes
  checkedAt = (Get-Date).ToString("o")
  counts = [ordered]@{
    errors = (@($errorLogs)).Count
    appCheckMissing = (@($appCheckMissingLogs)).Count
    updateRoomAsHost = (@($hostUpdateLogs)).Count
    awardRoomPoints = (@($awardPointsLogs)).Count
    runDemoDirectorAction = (@($demoDirectorLogs)).Count
  }
  samples = [ordered]@{
    errors = @($errorLogs | Select-Object -First 5 | ForEach-Object {
      [ordered]@{
        timestamp = Read-FieldOrNull -Entry $_ -FieldName "timestamp"
        severity = Read-FieldOrNull -Entry $_ -FieldName "severity"
        textPayload = Read-FieldOrNull -Entry $_ -FieldName "textPayload"
      }
    })
    appCheckMissing = @($appCheckMissingLogs | Select-Object -First 5 | ForEach-Object {
      [ordered]@{
        timestamp = Read-FieldOrNull -Entry $_ -FieldName "timestamp"
        severity = Read-FieldOrNull -Entry $_ -FieldName "severity"
        textPayload = Read-FieldOrNull -Entry $_ -FieldName "textPayload"
      }
    })
  }
}

$json = $summary | ConvertTo-Json -Depth 12
$json

if (-not $OutFile) {
  $stamp = Get-Date -Format "yyyyMMdd-HHmmss"
  $OutDir = Join-Path (Resolve-Path ".").Path "artifacts/launch-watch"
  New-Item -ItemType Directory -Path $OutDir -Force | Out-Null
  $OutFile = Join-Path $OutDir "watch-$stamp.json"
}

Set-Content -Path $OutFile -Value $json -Encoding UTF8
Write-Host "Wrote launch watch snapshot: $OutFile"
