$ErrorActionPreference = 'Stop'
Set-Location -LiteralPath $PSScriptRoot
node scripts/start-local.mjs
if ($LASTEXITCODE -ne 0) { throw 'SecondRoute could not start. Check the output above.' }
