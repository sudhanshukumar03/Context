$ErrorActionPreference = 'Stop'
$projectRoot = [System.IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
$runId = [guid]::NewGuid().ToString('N')
$testRoot = Join-Path $projectRoot "tmp/db-$runId"
$cluster = Join-Path $testRoot 'cluster'
New-Item -ItemType Directory -Path $testRoot -Force | Out-Null
$listener = [System.Net.Sockets.TcpListener]::new([System.Net.IPAddress]::Loopback, 0)
$listener.Start()
$testPort = $listener.LocalEndpoint.Port
$listener.Stop()
$previousDatabase = $env:DATABASE_URL
$previousTestDatabase = $env:CONTEXT_TEST_DATABASE_URL
$started = $false
$pgCtl = (Get-Command pg_ctl).Source
try {
  & initdb -D $cluster -U context_test -A trust | Out-Null
  if ($LASTEXITCODE -ne 0) { throw 'Disposable cluster initialization failed' }
  $start = Start-Process -FilePath $pgCtl -ArgumentList @('-D', "`"$cluster`"", '-l', "`"$(Join-Path $testRoot 'postgres.log')`"", '-o', "`"-h 127.0.0.1 -p $testPort -F`"", '-w', 'start') -WindowStyle Hidden -PassThru -RedirectStandardOutput (Join-Path $testRoot 'startup.out') -RedirectStandardError (Join-Path $testRoot 'startup.err')
  $null = $start.Handle
  if (!$start.WaitForExit(30000)) { throw 'Disposable database startup timed out' }
  if ($start.ExitCode -ne 0) { throw 'Disposable database startup failed' }
  $started = $true
  $databaseName = "context_disposable_$runId"
  & createdb -h 127.0.0.1 -p $testPort -U context_test $databaseName
  if ($LASTEXITCODE -ne 0) { throw 'Disposable database creation failed' }
  $env:CONTEXT_TEST_DATABASE_URL = "postgresql://context_test@127.0.0.1:$testPort/$databaseName"
  $env:DATABASE_URL = $env:CONTEXT_TEST_DATABASE_URL
  Push-Location $projectRoot
  try { & pnpm exec vitest run --config vitest.integration.config.ts; $testExitCode = $LASTEXITCODE }
  finally { Pop-Location }
  if ($testExitCode -ne 0) { throw 'Disposable database tests failed' }
} finally {
  if ($started) { Start-Process -FilePath $pgCtl -ArgumentList @('-D', "`"$cluster`"", '-m', 'immediate', '-w', 'stop') -WindowStyle Hidden -Wait | Out-Null }
  $env:DATABASE_URL = $previousDatabase
  $env:CONTEXT_TEST_DATABASE_URL = $previousTestDatabase
}
