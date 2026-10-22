$ErrorActionPreference = 'Stop'
Set-Location -LiteralPath $PSScriptRoot
if (-not (Test-Path -LiteralPath 'node_modules')) {
    npm.cmd ci
    if ($LASTEXITCODE -ne 0) { throw 'Dependency installation failed' }
}
if (-not (Test-Path -LiteralPath '.next/BUILD_ID')) {
    npm.cmd run build
    if ($LASTEXITCODE -ne 0) { throw 'Production build failed' }
}
Write-Host 'Open http://localhost:3000 for SecondRoute.'
npm.cmd start
