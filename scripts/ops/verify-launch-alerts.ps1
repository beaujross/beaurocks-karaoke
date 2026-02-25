param(
  [string]$ProjectId = "",
  [string]$BillingAccountId = ""
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

$project = Resolve-ProjectId -InputProjectId $ProjectId
$requiredPolicies = @(
  "[Launch] Firestore Write Surge",
  "[Launch] Firestore Read Surge",
  "[Launch] Functions 5xx Error Burst",
  "[Launch] Functions Request Surge"
)
$requiredBudget = "[Launch] Monthly Firestore+Functions Guardrail"

$existingPoliciesRaw = gcloud monitoring policies list --project=$project --format=json
if ($LASTEXITCODE -ne 0) {
  throw "Failed to list monitoring policies."
}
$existingPolicies = @()
if ($existingPoliciesRaw) {
  $parsed = $existingPoliciesRaw | ConvertFrom-Json
  if ($parsed -is [System.Array]) { $existingPolicies = $parsed } else { $existingPolicies = @($parsed) }
}
$existingPolicyNames = @($existingPolicies | ForEach-Object { [string]$_.displayName })
$missingPolicies = @($requiredPolicies | Where-Object { $_ -notin $existingPolicyNames })

$budgetStatus = "not_checked"
$missingBudget = @()
$budgetError = ""
if ($BillingAccountId) {
  try {
    $budgetRaw = gcloud billing budgets list --billing-account=$BillingAccountId --format=json
    if ($LASTEXITCODE -ne 0) {
      throw "Failed to list billing budgets for account $BillingAccountId."
    }
    $budgets = @()
    if ($budgetRaw) {
      $parsedBudget = $budgetRaw | ConvertFrom-Json
      if ($parsedBudget -is [System.Array]) { $budgets = $parsedBudget } else { $budgets = @($parsedBudget) }
    }
    $budgetNames = @($budgets | ForEach-Object { [string]$_.displayName })
    if ($requiredBudget -notin $budgetNames) {
      $missingBudget = @($requiredBudget)
      $budgetStatus = "missing"
    } else {
      $budgetStatus = "ok"
    }
  } catch {
    $budgetStatus = "error"
    $budgetError = $_.Exception.Message
  }
}

$result = [ordered]@{
  ok = ($missingPolicies.Count -eq 0 -and ($budgetStatus -in @("not_checked", "ok")))
  projectId = $project
  monitoringPolicyCount = $existingPolicies.Count
  requiredPolicies = $requiredPolicies
  missingPolicies = $missingPolicies
  billingAccountId = $BillingAccountId
  budgetStatus = $budgetStatus
  missingBudget = $missingBudget
  budgetError = $budgetError
  checkedAt = (Get-Date).ToString("o")
}

$result | ConvertTo-Json -Depth 8
if (-not $result.ok) {
  exit 1
}
