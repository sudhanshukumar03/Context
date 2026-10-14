param(
  [ValidateSet('Start', 'Status', 'Smoke', 'Stop', 'Migrate')][string]$Action = 'Status',
  [ValidateRange(1024, 65535)][int]$DashboardPort = 31800,
  [ValidateRange(1024, 65535)][int]$ApiPort = 31801,
  [ValidateSet('', 'demo', 'clerk')][string]$AuthMode = '',
  [ValidateSet('', 'off', 'gemini')][string]$AiMode = ''
)
$ErrorActionPreference = 'Stop'
$projectRoot = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
$runtimeRoot = Join-Path $projectRoot 'runtime'
$legacyRoot = Join-Path $projectRoot 'tmp/local-test'
$configRoot = Join-Path $runtimeRoot 'config'
$dataRoot = Join-Path $runtimeRoot 'data'
$logRoot = Join-Path $runtimeRoot 'logs'
$stateRoot = Join-Path $runtimeRoot 'state'
$configPath = Join-Path $configRoot 'config.json'
$processPath = Join-Path $stateRoot 'processes.json'
# Status and Stop can still manage an old installation before its migration.
if (Test-Path -LiteralPath (Join-Path $legacyRoot 'config.json')) {
  $configPath = Join-Path $legacyRoot 'config.json'
  $processPath = Join-Path $legacyRoot 'processes.json'
  $logRoot = $legacyRoot
}
$runner = Join-Path $PSScriptRoot 'local-test-server.mjs'
$node = (Get-Command node).Source

function Save-Json($Path, $Value) {
  $pending = "$Path.pending"
  try {
    [IO.File]::WriteAllText($pending, ($Value | ConvertTo-Json -Depth 5), [Text.UTF8Encoding]::new($false))
    Move-Item -LiteralPath $pending -Destination $Path -Force
  } finally { if (Test-Path -LiteralPath $pending) { Remove-Item -LiteralPath $pending } }
}
function Assert-LocalPath($Path) {
  $absolute = [IO.Path]::GetFullPath($Path)
  if (!$absolute.StartsWith($projectRoot + [IO.Path]::DirectorySeparatorChar, [StringComparison]::OrdinalIgnoreCase)) {
    throw 'A local path leaves the project; operation refused.'
  }
  $ancestor = $absolute
  while ($ancestor -ne $projectRoot) {
    if (Test-Path -LiteralPath $ancestor) {
      if ((Get-Item -LiteralPath $ancestor -Force).Attributes -band [IO.FileAttributes]::ReparsePoint) {
        throw 'Linked local paths are not supported.'
      }
    }
    $ancestor = [IO.Path]::GetDirectoryName($ancestor)
  }
}
function Migrate-Layout {
  $layoutScript = Join-Path $PSScriptRoot 'local-runtime.mjs'
  $plan = & $node $layoutScript migration-plan
  if ($LASTEXITCODE -ne 0) { throw 'Local migration preflight failed; no files were moved.' }
  $moves = ConvertFrom-Json -InputObject $plan
  $moves = @($moves)
  if ($moves.Count -eq 0) { Write-Output 'The local installation already uses runtime/.'; return }
  $config = Read-Config
  Stop-Local $config
  # Shutdown may create its own logs; include them in the final plan.
  $plan = & $node $layoutScript migration-plan
  if ($LASTEXITCODE -ne 0) { throw 'Migration preflight failed after shutdown; original files remain in place.' }
  $moves = ConvertFrom-Json -InputObject $plan
  $moves = @($moves)
  $originalConfig = [IO.File]::ReadAllText($configPath)
  $repairs = @{}
  foreach ($move in $moves) {
    if ([IO.Path]::GetFileName($move.source) -like 'encoding-repair-*.json') {
      $repairs[$move.destination] = [IO.File]::ReadAllText($move.source)
    }
  }
  $completed = [Collections.Generic.List[object]]::new()
  try {
    foreach ($move in $moves) {
      Assert-LocalPath $move.source
      Assert-LocalPath $move.destination
      if (Test-Path -LiteralPath $move.destination) { throw 'Migration destination appeared; refusing to overwrite it.' }
      New-Item -ItemType Directory -Path ([IO.Path]::GetDirectoryName($move.destination)) -Force | Out-Null
      Move-Item -LiteralPath $move.source -Destination $move.destination
      $completed.Add($move)
    }
    $config.cluster = Join-Path $dataRoot "cluster-$($config.runId)"
    $newConfig = Join-Path $configRoot 'config.json'
    Save-Json $newConfig $config
    foreach ($path in $repairs.Keys) {
      $record = $repairs[$path] | ConvertFrom-Json
      $oldBackup = [IO.Path]::GetFullPath($record.backup)
      $backupMove = $moves | Where-Object { $_.source -eq $oldBackup }
      if (!$backupMove) { throw 'Encoding recovery record references an unexpected backup; migration rolled back.' }
      $record.backup = $backupMove.destination
      Save-Json $path $record
    }
    & $node $runner check
    if ($LASTEXITCODE -ne 0) { throw 'Migrated configuration failed validation.' }
  } catch {
    $migrationError = $_
    # Restore metadata before returning files, including the original cluster path.
    $newConfig = Join-Path $configRoot 'config.json'
    if ($completed | Where-Object { $_.destination -eq $newConfig }) {
      [IO.File]::WriteAllText($newConfig, $originalConfig, [Text.UTF8Encoding]::new($false))
    }
    foreach ($path in $repairs.Keys) {
      if ($completed | Where-Object { $_.destination -eq $path }) {
        [IO.File]::WriteAllText($path, $repairs[$path], [Text.UTF8Encoding]::new($false))
      }
    }
    for ($index = $completed.Count - 1; $index -ge 0; $index--) {
      $move = $completed[$index]
      Assert-LocalPath $move.source
      Assert-LocalPath $move.destination
      if (Test-Path -LiteralPath $move.source) { throw 'Rollback destination exists; preserved files require manual recovery.' }
      Move-Item -LiteralPath $move.destination -Destination $move.source
    }
    # Remove only empty folders created by this attempt, so a retry remains possible.
    if (Test-Path -LiteralPath $runtimeRoot) {
      $emptyCandidates = @(Get-ChildItem -LiteralPath $runtimeRoot -Directory -Recurse -Force | Sort-Object { $_.FullName.Length } -Descending)
      foreach ($directory in $emptyCandidates) {
        Assert-LocalPath $directory.FullName
        if (@(Get-ChildItem -LiteralPath $directory.FullName -Force).Count -eq 0) { Remove-Item -LiteralPath $directory.FullName }
      }
      Assert-LocalPath $runtimeRoot
      if (@(Get-ChildItem -LiteralPath $runtimeRoot -Force).Count -eq 0) { Remove-Item -LiteralPath $runtimeRoot }
    }
    throw $migrationError
  }
  Assert-LocalPath $legacyRoot
  if (@(Get-ChildItem -LiteralPath $legacyRoot -Force).Count -eq 0) { Remove-Item -LiteralPath $legacyRoot }
  $script:configPath = Join-Path $configRoot 'config.json'
  $script:processPath = Join-Path $stateRoot 'processes.json'
  $script:logRoot = Join-Path $runtimeRoot 'logs'
  Write-Output 'Local installation moved to runtime/. Database, credentials, modes, ports, and backups preserved.'
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
    $databaseStatus = $LASTEXITCODE
    if ($databaseStatus -notin @(0, 3)) { throw 'Could not establish local database status; shutdown/migration refused.' }
    if ($databaseStatus -eq 0) {
      $pgCtl = (Get-Command pg_ctl).Source
      $stop = Start-Process -FilePath $pgCtl -ArgumentList @('-D', "`"$($Config.cluster)`"", '-m', 'fast', '-w', 'stop') -WindowStyle Hidden -PassThru -RedirectStandardOutput (Join-Path $logRoot 'stop.out') -RedirectStandardError (Join-Path $logRoot 'stop.err')
      $null = $stop.Handle
      if (!$stop.WaitForExit(30000) -or $stop.ExitCode -ne 0) { throw 'Local database shutdown failed; see runtime/logs/stop.err.' }
      & pg_ctl -D $Config.cluster status *> $null
      if ($LASTEXITCODE -ne 3) { throw 'Local database did not confirm shutdown; migration refused.' }
    }
  }
}
function Wait-Ready($Url, $Process) {
  for ($attempt = 0; $attempt -lt 60; $attempt++) {
    $Process.Refresh()
    if ($Process.HasExited) { throw 'Local server exited; inspect runtime/logs/*.err and *.out.' }
    try {
      $response = Invoke-WebRequest -Uri $Url -UseBasicParsing -TimeoutSec 2
      if ($response.StatusCode -eq 200) { return }
    } catch { }
    Start-Sleep -Milliseconds 500
  }
  throw "Local server readiness timed out: $Url"
}

if ($Action -eq 'Migrate') { Migrate-Layout; return }
if ($Action -eq 'Start' -and (Test-Path -LiteralPath (Join-Path $legacyRoot 'config.json'))) { Migrate-Layout }
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
  $displayAi = if ($config.aiMode) { $config.aiMode } else { 'off' }
  Write-Output "AI: $displayAi"
  return
}

foreach ($command in @('initdb', 'pg_ctl', 'createdb', 'psql', 'pg_dump', 'pg_restore', 'pnpm')) { $null = Get-Command $command }
if ($ApiPort -eq $DashboardPort) { throw 'API and dashboard ports must differ.' }
foreach ($directory in @($configRoot, $dataRoot, $logRoot, $stateRoot)) {
  Assert-LocalPath $directory
  New-Item -ItemType Directory -Path $directory -Force | Out-Null
}
if (!(Test-Path -LiteralPath $configPath)) {
  $runId = [guid]::NewGuid().ToString('N')
  $listener = [Net.Sockets.TcpListener]::new([Net.IPAddress]::Loopback, 0)
  $listener.Start(); $databasePort = $listener.LocalEndpoint.Port; $listener.Stop()
  $bytes = New-Object byte[] 32
  $random = [Security.Cryptography.RandomNumberGenerator]::Create()
  try { $random.GetBytes($bytes) } finally { $random.Dispose() }
  Save-Json $configPath @{
    runId = $runId; cluster = Join-Path $dataRoot "cluster-$runId"; databasePort = $databasePort
    databaseUrl = "postgresql://context_test@127.0.0.1:$databasePort/context_local_$runId"
    apiPort = $ApiPort; dashboardPort = $DashboardPort; sessionSecret = [BitConverter]::ToString($bytes).Replace('-', '').ToLowerInvariant()
  }
}
$config = Read-Config
$selectedAuth = if ($AuthMode) { $AuthMode } elseif ($config.authMode) { $config.authMode } else { 'demo' }
& $node $runner check-auth $selectedAuth
if ($LASTEXITCODE -ne 0) { throw 'Clerk configuration is incomplete. The running demo and saved authentication mode were not changed.' }
$selectedAi = if ($AiMode) { $AiMode } elseif ($config.aiMode) { $config.aiMode } else { 'off' }
& $node $runner check-ai $selectedAi
if ($LASTEXITCODE -ne 0) { throw 'Local AI configuration is incomplete; saved mode and running processes were not changed.' }
if (Test-Path -LiteralPath $processPath) {
  $records = Get-Content -Raw -LiteralPath $processPath | ConvertFrom-Json
  foreach ($mode in @('api', 'dashboard')) {
    if (Get-OwnedProcess $records.$mode $mode) { throw 'Local test is already running. Use -Action Status or Stop.' }
  }
}
Check-Port $config.apiPort
Check-Port $config.dashboardPort
$config | Add-Member -NotePropertyName authMode -NotePropertyValue $selectedAuth -Force
$config | Add-Member -NotePropertyName aiMode -NotePropertyValue $selectedAi -Force
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
    & initdb -D $config.cluster -U context_test -A trust --encoding=UTF8 --locale=C *> (Join-Path $logRoot 'initdb.out')
    if ($LASTEXITCODE -ne 0) { throw 'Isolated database initialization failed; see runtime/logs/initdb.out.' }
  }
  & pg_ctl -D $config.cluster status *> $null
  if ($LASTEXITCODE -ne 0) {
    Check-Port $config.databasePort
    $pgCtl = (Get-Command pg_ctl).Source
    $start = Start-Process -FilePath $pgCtl -ArgumentList @('-D', "`"$($config.cluster)`"", '-l', "`"$(Join-Path $logRoot 'postgres.log')`"", '-o', "`"-h 127.0.0.1 -p $($config.databasePort)`"", '-w', 'start') -WindowStyle Hidden -PassThru -RedirectStandardOutput (Join-Path $logRoot 'postgres-start.out') -RedirectStandardError (Join-Path $logRoot 'postgres-start.err')
    $null = $start.Handle
    if (!$start.WaitForExit(30000) -or $start.ExitCode -ne 0) { throw 'Isolated database startup failed.' }
  }
  # On an interrupted first start, finish provisioning only this generated database.
  $databaseExists = & psql -h 127.0.0.1 -p $config.databasePort -U context_test -d postgres -tAc "SELECT 1 FROM pg_database WHERE datname = 'context_local_$($config.runId)'"
  if ($LASTEXITCODE -ne 0) { throw 'Cannot inspect isolated database.' }
  if ($databaseExists -ne '1') {
    & createdb -h 127.0.0.1 -p $config.databasePort -U context_test --template=template0 --encoding=UTF8 --locale=C "context_local_$($config.runId)"
    if ($LASTEXITCODE -ne 0) { throw 'Isolated database creation failed.' }
  }
  & $node (Join-Path $PSScriptRoot 'local-database-encoding.mjs') --repair
  if ($LASTEXITCODE -ne 0) { throw 'Local UTF8 validation/repair failed; original data is preserved.' }
  $tableCount = & psql -h 127.0.0.1 -p $config.databasePort -U context_test -d "context_local_$($config.runId)" -tAc "SELECT count(*) FROM information_schema.tables WHERE table_schema='public' AND table_type='BASE TABLE'"
  if ($LASTEXITCODE -ne 0) { throw 'Cannot inspect isolated schema.' }
  if ($tableCount -eq '0') {
    & $node $runner initialize
    if ($LASTEXITCODE -ne 0) { throw 'Isolated schema initialization failed.' }
  }
  foreach ($mode in @('api', 'dashboard')) {
    $process = Start-Process -FilePath $node -ArgumentList @("`"$runner`"", $mode) -WorkingDirectory $projectRoot -WindowStyle Hidden -PassThru -RedirectStandardOutput (Join-Path $logRoot "$mode.out") -RedirectStandardError (Join-Path $logRoot "$mode.err")
    $processes[$mode] = @{ id = $process.Id; started = $process.StartTime.ToUniversalTime().Ticks.ToString() }
    Save-Json $processPath $processes
    $url = if ($mode -eq 'api') { "http://127.0.0.1:$($config.apiPort)/api/healthz" } else { "http://127.0.0.1:$($config.dashboardPort)" }
    Wait-Ready $url $process
  }
  & $node (Join-Path $PSScriptRoot 'local-test-smoke.mjs')
  if ($LASTEXITCODE -ne 0) { throw 'Local smoke checks failed.' }
  Write-Output "Local test ready: http://127.0.0.1:$($config.dashboardPort)"
  if ($selectedAuth -eq 'clerk') { Write-Output 'Clerk test sign-in is enabled; demo sign-in is disabled. Complete browser sign-in and team checks.' }
  else { Write-Output 'Demo sign-in is enabled on loopback only. The existing application database is not used.' }
  Write-Output "AI mode: $selectedAi"
  Write-Output 'Stop: powershell -NoProfile -File scripts/local-test.ps1 -Action Stop'
} catch {
  $startupError = $_
  try { Stop-Local $config } catch { Write-Warning 'Cleanup could not complete. Use -Action Status and inspect runtime/logs.' }
  throw $startupError
}
