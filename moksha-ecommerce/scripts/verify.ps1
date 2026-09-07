<#
.SYNOPSIS
    Runs every quality gate this project has, in one command.

.DESCRIPTION
    The gates a reviewer would otherwise have to discover and run individually:

      backend   ruff (lint + format check) · mypy --strict · pytest
      frontend  tsc --strict · oxlint · vitest · vite build

    Needs a running PostgreSQL — the suite exercises SELECT ... FOR UPDATE, which
    SQLite does not implement, so it runs against the real thing. Start one with
    `docker compose up -d db` or `./scripts/pg-local.ps1 start`.

.EXAMPLE
    ./scripts/verify.ps1
#>
[CmdletBinding()]
param()

$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
$failed = @()

function Invoke-Gate([string]$Name, [scriptblock]$Body) {
    Write-Host "`n=== $Name " -NoNewline -ForegroundColor Cyan
    Write-Host ('=' * [Math]::Max(0, 60 - $Name.Length)) -ForegroundColor Cyan
    try {
        & $Body
        if ($LASTEXITCODE -ne 0) { throw "exit $LASTEXITCODE" }
        Write-Host "PASS  $Name" -ForegroundColor Green
    } catch {
        Write-Host "FAIL  $Name — $_" -ForegroundColor Red
        $script:failed += $Name
    }
}

Push-Location (Join-Path $root 'backend')
try {
    $py = '.venv\Scripts\python.exe'
    if (-not (Test-Path $py)) { throw "No virtualenv at backend/.venv — run: python -m venv .venv; .venv\Scripts\pip install -e '.[dev]'" }

    Invoke-Gate 'backend · ruff lint'   { & .venv\Scripts\ruff.exe check app tests scripts run.py }
    Invoke-Gate 'backend · ruff format' { & .venv\Scripts\ruff.exe format --check app tests scripts run.py }
    Invoke-Gate 'backend · mypy strict' { & .venv\Scripts\mypy.exe app }
    Invoke-Gate 'backend · pytest'      { & $py -m pytest -q }
} finally { Pop-Location }

Push-Location (Join-Path $root 'frontend')
try {
    if (-not (Test-Path 'node_modules')) { throw 'No node_modules — run: npm install' }

    # `npm run` rather than `npx`: the scripts are declared in package.json (so the exact
    # invocation is versioned with the project), and npx resolves unreliably under PowerShell.
    Invoke-Gate 'frontend · tsc strict' { & npm.cmd run --silent typecheck }
    Invoke-Gate 'frontend · oxlint'     { & npm.cmd run --silent lint }
    Invoke-Gate 'frontend · vitest'     { & npm.cmd run --silent test }
    Invoke-Gate 'frontend · build'      { & npm.cmd run --silent build }
} finally { Pop-Location }

Write-Host ''
if ($failed.Count -eq 0) {
    Write-Host 'All gates passed.' -ForegroundColor Green
    exit 0
}
Write-Host "Failed: $($failed -join ', ')" -ForegroundColor Red
exit 1
