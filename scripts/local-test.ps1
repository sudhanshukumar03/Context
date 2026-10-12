param(
  [ValidateSet('Start', 'Status', 'Smoke', 'Stop')][string]$Action = 'Status',
  [ValidateRange(1024, 65535)][int]$DashboardPort = 31800,
  [ValidateRange(1024, 65535)][int]$ApiPort = 31801,
  [ValidateSet('', 'demo', 'clerk')][string]$AuthMode = ''
)
$ErrorActionPreference = 'Stop'
$projectRoot = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
$testRoot = Join-Path $projectRoot 'tmp/local-test'
$configPath = Join-Path $testRoot 'config.json'
$processPath = Join-Path $testRoot 'processes.json'
$runner = Join-Path $PSScriptRoot 'local-test-server.mjs'
$node = (Get-Command node).Source

function Save-Json($Path, $Value) {
  [IO.File]::WriteAllText($Path, ($Value | ConvertTo-Json -Depth 5), [Text.UTF8Encoding]::new($false))
}
function Read-Config {
  if (!(Test-Path -LiteralPath $configPath)) { throw 'Run with -Action Start first.' }
  & $node $runner check
  if ($LASTEXITCODE -ne 0) { throw 'Local configuration did not pass isolation checks.' }
  return (Get-Content -Raw -LiteralPath $configPath | ConvertFrom-Json)
}
function Check-Port($Port) {
  $listener = [Net.Sockets.TcpListener]::new([Net.IPAddress]::Loopback, $Port)
  try { $listener.Start() } finally { $listener.Stop() }
}
function Get-OwnedProcess($Record, $Mode) {
  if (!$Record) { return $null }
  $process = Get-Process -Id $Record.id -ErrorAction SilentlyContinue
  if (!$process) { return $null }
  $details = Get-CimInstance Win32_Process -Filter "ProcessId = $($Record.id)"
  if ($process.ProcessName -ne 'node' -or $process.StartTime.ToUniversalTime().Ticks.ToString() -ne $Record.started -or
    !$details.CommandLine -or $details.CommandLine -notmatch [regex]::Escape($runner) -or
    $details.CommandLine -notmatch "\s$Mode(?:\s|$)") {
    throw 'Saved process identity does not match the local test runner; no process was stopped.'
  }
  return $process
}
function Stop-Local($Config) {
  if (Test-Path -LiteralPath $processPath) {
    $records = Get-Content -Raw -LiteralPath $processPath | ConvertFrom-Json
    foreach ($mode in @('dashboard', 'api')) {
      $process = Get-OwnedProcess $records.$mode $mode
      if ($process) { Stop-Process -Id $process.Id }
    }
    Save-Json $processPath @{}
  }
  if (Test-Path -LiteralPath (Join-Path $Config.cluster 'PG_VERSION')) {
    & pg_ctl -D $Config.cluster status *> $null
    if ($LASTEXITCODE -eq 0) {
      $pgCtl = (Get-Command pg_ctl).Source
      $stop = Start-Process -FilePath $pgCtl -ArgumentList @('-D', "`"$($Config.cluster)`"", '-m', 'fast', '-w', 'stop') -WindowStyle Hidden -PassThru -RedirectStandardOutput (Join-Path $testRoot 'stop.out') -RedirectStandardError (Join-Path $testRoot 'stop.err')
      $null = $stop.Handle
      if (!$stop.WaitForExit(30000) -or $stop.ExitCode -ne 0) { throw 'Local database shutdown failed; see tmp/local-test/stop.err.' }
    }
  }
}
function Wait-Ready($Url, $Process) {
  for ($attempt = 0; $attempt -lt 60; $attempt++) {
    $Process.Refresh()
    if ($Process.HasExited) { throw 'Local server exited; inspect tmp/local-test/*.err and *.out.' }
    try {
      $response = Invoke-WebRequest -Uri $Url -UseBasicParsing -TimeoutSec 2
      if ($response.StatusCode -eq 200) { return }
    } catch { }
    Start-Sleep -Milliseconds 500
  }
  throw "Local server readiness timed out: $Url"
}

if ($Action -eq 'Smoke') {
  $null = Read-Config
  & $node (Join-Path $PSScriptRoot 'local-test-smoke.mjs')
  if ($LASTEXITCODE -ne 0) { throw 'Local smoke checks failed.' }
  return
}
if ($Action -eq 'Stop') {
  $config = Read-Config
  Stop-Local $config
  Write-Output 'Local test stopped. Its separate database is retained for the next start.'
  return
}
if ($Action -eq 'Status') {
  if (!(Test-Path -LiteralPath $configPath)) { Write-Output 'Local test has not been created.'; return }
  $config = Read-Config
  $records = if (Test-Path -LiteralPath $processPath) { Get-Content -Raw -LiteralPath $processPath | ConvertFrom-Json } else { $null }
  foreach ($mode in @('api', 'dashboard')) {
    $process = if ($records) { Get-OwnedProcess $records.$mode $mode } else { $null }
    Write-Output "$mode running: $([bool]$process)"
  }
  Write-Output "Dashboard: http://127.0.0.1:$($config.dashboardPort)"
  $displayMode = if ($config.authMode) { $config.authMode } else { 'demo' }
  Write-Output "Authentication: $displayMode"
  return
}

foreach ($command in @('initdb', 'pg_ctl', 'createdb', 'psql', 'pnpm')) { $null = Get-Command $command }
if ($ApiPort -eq $DashboardPort) { throw 'API and dashboard ports must differ.' }
New-Item -ItemType Directory -Path $testRoot -Force | Out-Null
if (!(Test-Path -LiteralPath $configPath)) {
  $runId = [guid]::NewGuid().ToString('N')
  $listener = [Net.Sockets.TcpListener]::new([Net.IPAddress]::Loopback, 0)
  $listener.Start(); $databasePort = $listener.LocalEndpoint.Port; $listener.Stop()
  $bytes = New-Object byte[] 32
  $random = [Security.Cryptography.RandomNumberGenerator]::Create()
  try { $random.GetBytes($bytes) } finally { $random.Dispose() }
  Save-Json $configPath @{
    runId = $runId; cluster = Join-Path $testRoot "cluster-$runId"; databasePort = $databasePort
    databaseUrl = "postgresql://context_test@127.0.0.1:$databasePort/context_local_$runId"
    apiPort = $ApiPort; dashboardPort = $DashboardPort; sessionSecret = [BitConverter]::ToString($bytes).Replace('-', '').ToLowerInvariant()
  }
}
$config = Read-Config
$selectedAuth = if ($AuthMode) { $AuthMode } elseif ($config.authMode) { $config.authMode } else { 'demo' }
& $node $runner check-auth $selectedAuth
if ($LASTEXITCODE -ne 0) { throw 'Clerk configuration is incomplete. The running demo and saved authentication mode were not changed.' }
if (Test-Path -LiteralPath $processPath) {
  $records = Get-Content -Raw -LiteralPath $processPath | ConvertFrom-Json
  foreach ($mode in @('api', 'dashboard')) {
    if (Get-OwnedProcess $records.$mode $mode) { throw 'Local test is already running. Use -Action Status or Stop.' }
  }
}
Check-Port $config.apiPort
Check-Port $config.dashboardPort
$config | Add-Member -NotePropertyName authMode -NotePropertyValue $selectedAuth -Force
Save-Json $configPath $config
Push-Location $projectRoot
try {
  & pnpm --filter '@workspace/api-server' run build
  if ($LASTEXITCODE -ne 0) { throw 'API build failed.' }
} finally { Pop-Location }
$processes = @{}
try {
  $fresh = !(Test-Path -LiteralPath (Join-Path $config.cluster 'PG_VERSION'))
  if ($fresh) {
    & initdb -D $config.cluster -U context_test -A trust *> (Join-Path $testRoot 'initdb.out')
    if ($LASTEXITCODE -ne 0) { throw 'Isolated database initialization failed; see tmp/local-test/initdb.out.' }
  }
  & pg_ctl -D $config.cluster status *> $null
  if ($LASTEXITCODE -ne 0) {
    Check-Port $config.databasePort
    $pgCtl = (Get-Command pg_ctl).Source
    $start = Start-Process -FilePath $pgCtl -ArgumentList @('-D', "`"$($config.cluster)`"", '-l', "`"$(Join-Path $testRoot 'postgres.log')`"", '-o', "`"-h 127.0.0.1 -p $($config.databasePort)`"", '-w', 'start') -WindowStyle Hidden -PassThru -RedirectStandardOutput (Join-Path $testRoot 'postgres-start.out') -RedirectStandardError (Join-Path $testRoot 'postgres-start.err')
    $null = $start.Handle
    if (!$start.WaitForExit(30000) -or $start.ExitCode -ne 0) { throw 'Isolated database startup failed.' }
  }
  # On an interrupted first start, finish provisioning only this generated database.
  $databaseExists = & psql -h 127.0.0.1 -p $config.databasePort -U context_test -d postgres -tAc "SELECT 1 FROM pg_database WHERE datname = 'context_local_$($config.runId)'"
  if ($LASTEXITCODE -ne 0) { throw 'Cannot inspect isolated database.' }
  if ($databaseExists -ne '1') {
    & createdb -h 127.0.0.1 -p $config.databasePort -U context_test "context_local_$($config.runId)"
    if ($LASTEXITCODE -ne 0) { throw 'Isolated database creation failed.' }
  }
  $tableCount = & psql -h 127.0.0.1 -p $config.databasePort -U context_test -d "context_local_$($config.runId)" -tAc "SELECT count(*) FROM information_schema.tables WHERE table_schema='public' AND table_type='BASE TABLE'"
  if ($LASTEXITCODE -ne 0) { throw 'Cannot inspect isolated schema.' }
  if ($tableCount -eq '0') {
    & $node $runner initialize
    if ($LASTEXITCODE -ne 0) { throw 'Isolated schema initialization failed.' }
  }
  foreach ($mode in @('api', 'dashboard')) {
    $process = Start-Process -FilePath $node -ArgumentList @("`"$runner`"", $mode) -WorkingDirectory $projectRoot -WindowStyle Hidden -PassThru -RedirectStandardOutput (Join-Path $testRoot "$mode.out") -RedirectStandardError (Join-Path $testRoot "$mode.err")
    $processes[$mode] = @{ id = $process.Id; started = $process.StartTime.ToUniversalTime().Ticks.ToString() }
    Save-Json $processPath $processes
    $url = if ($mode -eq 'api') { "http://127.0.0.1:$($config.apiPort)/api/healthz" } else { "http://127.0.0.1:$($config.dashboardPort)" }
    Wait-Ready $url $process
  }
  & $node (Join-Path $PSScriptRoot 'local-test-smoke.mjs')
  if ($LASTEXITCODE -ne 0) { throw 'Local smoke checks failed.' }
  Write-Output "Local test ready: http://127.0.0.1:$($config.dashboardPort)"
  if ($selectedAuth -eq 'clerk') { Write-Output 'Clerk test sign-in is enabled; demo sign-in is disabled. Complete browser sign-in and team checks.' }
  else { Write-Output 'Demo sign-in is enabled on loopback only. Existing data and account keys are not used.' }
  Write-Output 'Stop: powershell -NoProfile -File scripts/local-test.ps1 -Action Stop'
} catch {
  $startupError = $_
  try { Stop-Local $config } catch { Write-Warning 'Cleanup could not complete. Use -Action Status and inspect tmp/local-test logs.' }
  throw $startupError
}
