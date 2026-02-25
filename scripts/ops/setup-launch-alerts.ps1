param(
  [string]$ProjectId = "",
  [string]$BillingAccountId = "",
  [double]$BudgetAmountUsd = 300,
  [string[]]$NotificationChannels = @(),
  [switch]$DryRun
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

function Invoke-Gcloud {
  param(
    [Parameter(Mandatory = $true)][string[]]$Args
  )
  if ($DryRun) {
    Write-Host "[dry-run] gcloud $($Args -join ' ')" -ForegroundColor Yellow
    return
  }
  & gcloud @Args
  if ($LASTEXITCODE -ne 0) {
    throw "gcloud command failed: gcloud $($Args -join ' ')"
  }
}

function To-JsonFile {
  param(
    [Parameter(Mandatory = $true)][object]$Data,
    [Parameter(Mandatory = $true)][string]$Path
  )
  $json = $Data | ConvertTo-Json -Depth 20
  Set-Content -Path $Path -Value $json -Encoding UTF8
}

$project = Resolve-ProjectId -InputProjectId $ProjectId
Write-Host "Project: $project"

Invoke-Gcloud -Args @("services", "enable", "monitoring.googleapis.com", "--project", $project)
if ($BillingAccountId) {
  Invoke-Gcloud -Args @("services", "enable", "billingbudgets.googleapis.com", "--project", $project)
}

$tmpDir = Join-Path $env:TEMP "beaurocks-launch-alerts"
New-Item -ItemType Directory -Path $tmpDir -Force | Out-Null

$requiredDisplayNames = @(
  "[Launch] Firestore Write Surge",
  "[Launch] Firestore Read Surge",
  "[Launch] Functions 5xx Error Burst",
  "[Launch] Functions Request Surge"
)

$existingRaw = gcloud monitoring policies list --project $project --format=json
$existing = @()
if ($existingRaw) {
  $parsed = $existingRaw | ConvertFrom-Json
  if ($parsed -is [System.Array]) { $existing = $parsed } else { $existing = @($parsed) }
}

foreach ($displayName in $requiredDisplayNames) {
  $match = $existing | Where-Object { $_.displayName -eq $displayName }
  foreach ($policy in $match) {
    $policyName = [string]$policy.name
    if ($policyName) {
      Write-Host "Replacing existing policy: $displayName"
      Invoke-Gcloud -Args @("monitoring", "policies", "delete", $policyName, "--project", $project, "--quiet")
    }
  }
}

$commonChannels = @()
if ($NotificationChannels.Count -gt 0) {
  $commonChannels = $NotificationChannels
}

$policies = @(
  @{
    file = "firestore-write-surge.json"
    body = @{
      displayName = "[Launch] Firestore Write Surge"
      combiner = "OR"
      notificationChannels = $commonChannels
      conditions = @(
        @{
          displayName = "Firestore writes exceed threshold"
          conditionThreshold = @{
            filter = 'resource.type="firestore_instance" AND metric.type="firestore.googleapis.com/document/write_count"'
            comparison = "COMPARISON_GT"
            thresholdValue = 100
            duration = "300s"
            aggregations = @(
              @{
                alignmentPeriod = "60s"
                perSeriesAligner = "ALIGN_RATE"
              }
            )
            trigger = @{
              count = 1
            }
          }
        }
      )
      alertStrategy = @{
        autoClose = "1800s"
      }
      enabled = $true
    }
  },
  @{
    file = "firestore-read-surge.json"
    body = @{
      displayName = "[Launch] Firestore Read Surge"
      combiner = "OR"
      notificationChannels = $commonChannels
      conditions = @(
        @{
          displayName = "Firestore reads exceed threshold"
          conditionThreshold = @{
            filter = 'resource.type="firestore_instance" AND metric.type="firestore.googleapis.com/document/read_count"'
            comparison = "COMPARISON_GT"
            thresholdValue = 400
            duration = "300s"
            aggregations = @(
              @{
                alignmentPeriod = "60s"
                perSeriesAligner = "ALIGN_RATE"
              }
            )
            trigger = @{
              count = 1
            }
          }
        }
      )
      alertStrategy = @{
        autoClose = "1800s"
      }
      enabled = $true
    }
  },
  @{
    file = "functions-5xx-burst.json"
    body = @{
      displayName = "[Launch] Functions 5xx Error Burst"
      combiner = "OR"
      notificationChannels = $commonChannels
      conditions = @(
        @{
          displayName = "Cloud Run function 5xx exceeds threshold"
          conditionThreshold = @{
            filter = 'resource.type="cloud_run_revision" AND metric.type="run.googleapis.com/request_count" AND metric.labels.response_code_class="5xx"'
            comparison = "COMPARISON_GT"
            thresholdValue = 5
            duration = "300s"
            aggregations = @(
              @{
                alignmentPeriod = "60s"
                perSeriesAligner = "ALIGN_RATE"
              }
            )
            trigger = @{
              count = 1
            }
          }
        }
      )
      alertStrategy = @{
        autoClose = "1800s"
      }
      enabled = $true
    }
  },
  @{
    file = "functions-request-surge.json"
    body = @{
      displayName = "[Launch] Functions Request Surge"
      combiner = "OR"
      notificationChannels = $commonChannels
      conditions = @(
        @{
          displayName = "Cloud Run function request rate exceeds threshold"
          conditionThreshold = @{
            filter = 'resource.type="cloud_run_revision" AND metric.type="run.googleapis.com/request_count"'
            comparison = "COMPARISON_GT"
            thresholdValue = 200
            duration = "300s"
            aggregations = @(
              @{
                alignmentPeriod = "60s"
                perSeriesAligner = "ALIGN_RATE"
              }
            )
            trigger = @{
              count = 1
            }
          }
        }
      )
      alertStrategy = @{
        autoClose = "1800s"
      }
      enabled = $true
    }
  }
)

foreach ($entry in $policies) {
  $path = Join-Path $tmpDir $entry.file
  To-JsonFile -Data $entry.body -Path $path
  Write-Host "Creating policy: $($entry.body.displayName)"
  Invoke-Gcloud -Args @("monitoring", "policies", "create", "--project", $project, "--policy-from-file", $path)
}

if ($BillingAccountId) {
  $budgetName = "[Launch] Monthly Firestore+Functions Guardrail"
  Write-Host "Ensuring budget: $budgetName"
  if ($DryRun) {
    Write-Host "[dry-run] gcloud billing budgets create --billing-account=$BillingAccountId --display-name=$budgetName ..."
  } else {
    $existingBudgetRaw = gcloud billing budgets list --billing-account=$BillingAccountId --format=json
    if ($LASTEXITCODE -ne 0) {
      throw "Unable to list budgets for billing account $BillingAccountId."
    }
    $existingBudgets = @()
    if ($existingBudgetRaw) {
      $parsedBudgets = $existingBudgetRaw | ConvertFrom-Json
      if ($parsedBudgets -is [System.Array]) { $existingBudgets = $parsedBudgets } else { $existingBudgets = @($parsedBudgets) }
    }
    $hasBudget = $existingBudgets | Where-Object { $_.displayName -eq $budgetName }
    if (-not $hasBudget) {
      $createArgs = @(
        "billing", "budgets", "create",
        "--billing-account=$BillingAccountId",
        "--display-name=$budgetName",
        "--budget-amount=$($BudgetAmountUsd)USD",
        "--project=$project",
        "--threshold-rule=percent=0.5",
        "--threshold-rule=percent=0.8",
        "--threshold-rule=percent=1.0"
      )
      Invoke-Gcloud -Args $createArgs
      Write-Host "Created budget: $budgetName"
    } else {
      Write-Host "Budget already exists: $budgetName"
    }
  }
}

Write-Host "Launch alert setup complete."
