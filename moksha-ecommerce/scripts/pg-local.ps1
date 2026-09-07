<#
.SYNOPSIS
    Runs a private PostgreSQL cluster for local development, without Docker.

.DESCRIPTION
    `docker compose up` is the supported path and the one the README documents. This script is a
    fallback for a machine where the Docker WSL backend is unavailable, and it deliberately does
    NOT touch any PostgreSQL service already installed on the host:

      * its own data directory  (moksha-ecommerce/.pgdata, gitignored)
      * its own port            (55432, so it cannot collide with a stock 5432 install)
      * its own superuser       (moksha / moksha_dev_pw — development only, never deployed)

    It reuses the postgres binaries already on the machine, so nothing is downloaded and no
    administrator rights are required.

.EXAMPLE
    ./scripts/pg-local.ps1 init     # create the cluster and both databases (run once)
    ./scripts/pg-local.ps1 start
    ./scripts/pg-local.ps1 status
    ./scripts/pg-local.ps1 stop
    ./scripts/pg-local.ps1 destroy  # delete the data directory entirely
#>
[CmdletBinding()]
param(
    [Parameter(Position = 0)]
    [ValidateSet('init', 'start', 'stop', 'status', 'destroy')]
    [string]$Command = 'status'
)

$ErrorActionPreference = 'Stop'

$Port = 55432
$User = 'moksha'
$Password = 'moksha_dev_pw'
$Root = Split-Path -Parent $PSScriptRoot
$DataDir = Join-Path $Root '.pgdata'
$LogFile = Join-Path $DataDir 'server.log'

# Prefer the newest installed major version; the schema uses nothing version-specific.
$Bin = Get-ChildItem 'C:\Program Files\PostgreSQL\*\bin\pg_ctl.exe' -ErrorAction SilentlyContinue |
    Sort-Object { [int]($_.FullName -replace '.*PostgreSQL\\(\d+)\\.*', '$1') } -Descending |
    Select-Object -First 1 -ExpandProperty DirectoryName

if (-not $Bin) {
    throw "No PostgreSQL installation found under 'C:\Program Files\PostgreSQL'. Use 'docker compose up' instead."
}

function Start-Cluster {
    <#
        `pg_ctl start` has to be launched detached on Windows.

        Run inline, it hands its console handles to the postgres child, and the calling shell
        then blocks until the *server* exits — so the script appears to hang even though the
        database started fine.

        The argument list is one pre-quoted string rather than an array: `-o` takes a single
        argument that itself contains spaces, and Start-Process does not quote array elements,
        so the array form silently passes `-p`, `55432` and the rest as separate arguments.
        pg_ctl then fails before writing anything to the log, which looks exactly like the
        server refusing to start.
    #>
    $options = "-p $Port -c listen_addresses=127.0.0.1"
    $arguments = '-D "{0}" -o "{1}" -l "{2}" start' -f $DataDir, $options, $LogFile

    # Fully detached: no -Wait, and both streams redirected to files. Sharing a stdout handle
    # with the postgres child is what makes the calling shell block until the *server* stops,
    # and -Wait alone does not avoid that. Readiness is confirmed by polling instead.
    $ctlLog = Join-Path $DataDir 'pg_ctl.log'
    Start-Process -FilePath "$Bin\pg_ctl.exe" -ArgumentList $arguments `
        -WindowStyle Hidden `
        -RedirectStandardOutput $ctlLog -RedirectStandardError "$ctlLog.err" | Out-Null

    # Wait for the port to actually accept a connection — the only signal that matters.
    #
    # 90s, not 15s: after an unclean shutdown Postgres replays the WAL before accepting anything,
    # and during that it answers "the database system is starting up". A short timeout turns a
    # perfectly healthy recovery into a scary error and an abandoned cluster.
    for ($i = 0; $i -lt 180; $i++) {
        & "$Bin\pg_isready.exe" -h 127.0.0.1 -p $Port -q
        if ($LASTEXITCODE -eq 0) {
            Write-Host "PostgreSQL is accepting connections on 127.0.0.1:$Port."
            return
        }
        Start-Sleep -Milliseconds 500
    }
    throw "Cluster did not become ready within 90s. See $LogFile and $ctlLog.err"
}

function Invoke-Psql([string]$Database, [string]$Sql) {
    $env:PGPASSWORD = $Password
    & "$Bin\psql.exe" -h 127.0.0.1 -p $Port -U $User -d $Database -v ON_ERROR_STOP=1 -c $Sql
}

switch ($Command) {
    'init' {
        if (Test-Path (Join-Path $DataDir 'PG_VERSION')) {
            Write-Host "Cluster already initialised at $DataDir. Nothing to do."
            break
        }
        New-Item -ItemType Directory -Force -Path $DataDir | Out-Null
        $pwFile = Join-Path ([System.IO.Path]::GetTempPath()) "moksha-pg-$([guid]::NewGuid()).txt"
        try {
            Set-Content -Path $pwFile -Value $Password -Encoding ascii -NoNewline
            & "$Bin\initdb.exe" -D $DataDir -U $User --pwfile=$pwFile -E UTF8 --locale=C
        } finally {
            # The password must not outlive initdb, even on a development machine.
            Remove-Item $pwFile -Force -ErrorAction SilentlyContinue
        }
        Start-Cluster
        Invoke-Psql 'postgres' "CREATE DATABASE moksha OWNER $User;"
        # Separate test database: the oversell test needs real SELECT ... FOR UPDATE, so the
        # suite runs against Postgres — but never against the database holding the demo data.
        Invoke-Psql 'postgres' "CREATE DATABASE moksha_test OWNER $User;"
        Write-Host "`nReady. Add to moksha-ecommerce/backend/.env.local:"
        Write-Host "  DATABASE_URL=postgresql+psycopg://${User}:${Password}@127.0.0.1:${Port}/moksha"
    }
    'start' {
        Start-Cluster
    }
    'stop' {
        & "$Bin\pg_ctl.exe" -D $DataDir -m fast stop
    }
    'status' {
        & "$Bin\pg_ctl.exe" -D $DataDir status
    }
    'destroy' {
        & "$Bin\pg_ctl.exe" -D $DataDir -m immediate stop 2>$null
        Remove-Item -Recurse -Force $DataDir
        Write-Host "Removed $DataDir."
    }
}
