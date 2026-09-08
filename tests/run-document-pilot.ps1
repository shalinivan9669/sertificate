param(
  [Parameter(Mandatory = $true)][string]$ArtifactRoot,
  [string]$PythonPath = ''
)
$ErrorActionPreference = 'Stop'
$repositoryRoot = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$isolatedRoot = (Resolve-Path -LiteralPath $ArtifactRoot).Path
if ((Split-Path $isolatedRoot -Leaf) -notlike 'ot-document-pilot-*' -or $isolatedRoot.StartsWith($repositoryRoot, [StringComparison]::OrdinalIgnoreCase)) { throw 'Use an explicit isolated ot-document-pilot-* directory outside the repository' }
$serverEntry = Join-Path $isolatedRoot '.output\server\index.mjs'
if (-not (Test-Path -LiteralPath $serverEntry -PathType Leaf)) { throw 'Copy an existing verified Node .output into the isolated directory first' }
if ((Test-NetConnection 127.0.0.1 -Port 3103 -WarningAction SilentlyContinue).TcpTestSucceeded) { throw 'Port 3103 is already occupied; do not interrupt another process' }
$runDirectory = Join-Path $isolatedRoot ('.data\run-' + (Get-Date -Format 'yyyyMMdd-HHmmss'))
New-Item -ItemType Directory -Path $runDirectory | Out-Null
$migrationDirectory = Join-Path $isolatedRoot 'migrations'
if (-not (Test-Path -LiteralPath $migrationDirectory)) { New-Item -ItemType Directory -Path $migrationDirectory | Out-Null }
foreach ($migration in Get-ChildItem -LiteralPath (Join-Path $repositoryRoot 'server\db\migrations') -Filter '*.sql' -File) {
  $destination = Join-Path $migrationDirectory $migration.Name
  if (-not (Test-Path -LiteralPath $destination)) { Copy-Item -LiteralPath $migration.FullName -Destination $destination }
}
$env:NODE_ENV = 'test'
$env:OT_APP_ENV = 'test'
$env:OT_ALLOW_TEST_SEED = '1'
$env:OT_DATABASE_PATH = Join-Path $runDirectory 'document-pilot.sqlite'
$env:BETTER_AUTH_URL = 'http://127.0.0.1:3103'
$env:BETTER_AUTH_SECRET = 'isolated-document-pilot-secret-local-only-2026'
$env:NUXT_PUBLIC_SITE_URL = 'http://127.0.0.1:3103'
$env:OT_EMAIL_DELIVERY_ENABLED = '0'
$env:OT_CRM_DELIVERY_ENABLED = '0'
$env:OT_PAYMENT_PROVIDER = 'disabled'
$env:OT_INVOICE_ENABLED = '0'
$env:OT_MIGRATIONS_DIR = Join-Path $isolatedRoot 'migrations'
$env:PORT = '3103'
$env:HOST = '127.0.0.1'
$env:TEST_BASE_URL = 'http://127.0.0.1:3103'
$env:OT_PILOT_ARTIFACT_ROOT = $isolatedRoot
if ($PythonPath) { $env:PYTHONPATH = $PythonPath }
Remove-Item Env:VERCEL,Env:TURSO_DATABASE_URL,Env:TURSO_AUTH_TOKEN,Env:SMTP_URL,Env:MAIL_FROM,Env:AMO_ACCESS_TOKEN,Env:AMO_LONG_TOKEN -ErrorAction SilentlyContinue
Set-Location -LiteralPath $repositoryRoot
node --import tsx tests/document-pilot-fixtures.ts
if ($LASTEXITCODE -ne 0) { throw 'Synthetic fixture failed' }
$server = Start-Process -FilePath (Get-Command node).Source -ArgumentList @('"' + $serverEntry + '"') -WorkingDirectory $isolatedRoot -WindowStyle Hidden -PassThru -RedirectStandardOutput (Join-Path $runDirectory 'server.log') -RedirectStandardError (Join-Path $runDirectory 'server-error.log')
try {
  $ready = $false
  for ($attempt = 0; $attempt -lt 30; $attempt++) {
    try { $ready = (Invoke-RestMethod -Uri 'http://127.0.0.1:3103/api/ready' -TimeoutSec 2).status -eq 'ready' } catch { }
    if ($ready) { break }
    Start-Sleep -Milliseconds 300
  }
  if (-not $ready) { throw 'Isolated pilot server failed readiness' }
  node tests/document-pilot-browser.mjs
  $pilotExit = $LASTEXITCODE
} finally {
  if (-not $server.HasExited) { Stop-Process -Id $server.Id }
}
exit $pilotExit
