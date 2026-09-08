$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

$package = Get-Content (Join-Path $PSScriptRoot '../package.json') -Raw | ConvertFrom-Json
$config = Get-Content (Join-Path $PSScriptRoot '../src-tauri/tauri.conf.json') -Raw | ConvertFrom-Json
$version = $package.version
if ($version -notmatch '^\d+\.\d+\.\d+$') {
    throw "Windows MSI release requires a numeric major.minor.patch version: $version"
}
if ($config.version -ne $version) {
    throw "package.json and tauri.conf.json versions do not agree"
}
$cargo = Get-Content (Join-Path $PSScriptRoot '../src-tauri/Cargo.toml') -Raw
if ($cargo -notmatch '(?m)^version\s*=\s*"([^\"]+)"' -or $Matches[1] -ne $version) {
    throw 'Cargo.toml package version does not match package.json'
}
$macPackage = Join-Path $PSScriptRoot "../downloads/AI-Coding-v$version-macOS-aarch64.dmg"
if (-not (Test-Path $macPackage -PathType Leaf)) {
    throw "The same-version Mac package must be committed before releasing: $macPackage"
}
$artifactName = "ai-coding-v$version-windows-x64-$env:GITHUB_RUN_ID-$env:GITHUB_RUN_ATTEMPT"
"version=$version" >> $env:GITHUB_OUTPUT
"artifact-name=$artifactName" >> $env:GITHUB_OUTPUT
Write-Host "Building AI Coding v$version for Windows x64"
