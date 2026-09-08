param(
    [Parameter(Mandatory = $true)]
    [ValidatePattern('^\d+\.\d+\.\d+$')]
    [string]$Version
)

$ErrorActionPreference = 'Stop'
$PSNativeCommandUseErrorActionPreference = $true
Set-StrictMode -Version Latest
if ($env:GITHUB_ACTIONS -ne 'true' -or $env:GITHUB_REF -ne 'refs/heads/main') {
    throw 'Automatic releases may only run from main on GitHub Actions.'
}
$root = Split-Path $PSScriptRoot -Parent
$windowsDir = Join-Path $root 'release/windows'
$tag = "v$Version"
$macFile = "AI-Coding-v$Version-macOS-aarch64.dmg"
$macPath = Join-Path $root "downloads/$macFile"
$validation = Get-Content (Join-Path $windowsDir 'WINDOWS-VALIDATION.json') -Raw | ConvertFrom-Json
if ($validation.version -ne $Version -or $validation.commit -ne $env:GITHUB_SHA -or
    -not $validation.msiInstallAndStartupPassed -or -not $validation.msiUninstallPreservedSentinels) {
    throw 'Windows validation report does not match this release source or lacks a successful smoke test.'
}

function Assert-ChecksumManifest([string]$Directory, [string]$Manifest) {
    foreach ($line in Get-Content (Join-Path $Directory $Manifest)) {
        if ([string]::IsNullOrWhiteSpace($line)) { continue }
        if ($line -notmatch '^([0-9a-fA-F]{64})\s+\*?([^/\\]+)$') { throw "Invalid checksum entry in $Manifest" }
        $expected = $Matches[1]
        $name = $Matches[2]
        $actual = (Get-FileHash (Join-Path $Directory $name) -Algorithm SHA256).Hash
        if ($actual -ne $expected) { throw "Checksum verification failed: $name" }
    }
}
Assert-ChecksumManifest $windowsDir 'WINDOWS-SHA256SUMS'
$macManifest = Join-Path $root 'downloads/SHA256SUMS'
$macChecksum = @(Get-Content $macManifest | Where-Object { $_ -match "\s+\*?$([regex]::Escape($macFile))$" })
if ($macChecksum.Count -ne 1) { throw 'The matching Mac DMG needs exactly one entry in downloads/SHA256SUMS.' }
$macHash = (Get-FileHash $macPath -Algorithm SHA256).Hash.ToLowerInvariant()
if (-not $macChecksum[0].StartsWith($macHash, [StringComparison]::OrdinalIgnoreCase)) { throw 'Mac DMG checksum mismatch.' }
$macChecksum | Set-Content (Join-Path $windowsDir 'MACOS-SHA256SUMS') -Encoding ascii

# A rerun may update assets only when the existing tag identifies the exact same source.
# Never move a previously published tag to a newer commit.
$headers = @{
    Authorization = "Bearer $env:GH_TOKEN"
    Accept = 'application/vnd.github+json'
    'X-GitHub-Api-Version' = '2022-11-28'
}
$apiBase = "$env:GITHUB_API_URL/repos/$env:GITHUB_REPOSITORY"
$mainCommit = Invoke-RestMethod "$apiBase/commits/main" -Headers $headers
if ($mainCommit.sha -ne $env:GITHUB_SHA) {
    throw 'Main has advanced since this build started. Only the current main commit may publish a new release.'
}
$existingCommit = Invoke-RestMethod "$apiBase/commits/$tag" -Headers $headers -SkipHttpErrorCheck -StatusCodeVariable commitStatus
if ($commitStatus -eq 200 -and $existingCommit.sha -ne $env:GITHUB_SHA) {
    throw "Tag $tag already refers to a different commit. Bump the package version instead of replacing a published release."
}
if ($commitStatus -notin @(200, 404)) { throw "Could not verify existing release tag (HTTP $commitStatus)." }
$existingRelease = Invoke-RestMethod "$apiBase/releases/tags/$tag" -Headers $headers -SkipHttpErrorCheck -StatusCodeVariable releaseStatus
if ($releaseStatus -notin @(200, 404)) { throw "Could not inspect release (HTTP $releaseStatus)." }

$assets = @(
    (Join-Path $windowsDir "AI-Coding-v$Version-windows-x64-setup.exe"),
    (Join-Path $windowsDir "AI-Coding-v$Version-windows-x64.msi"),
    (Join-Path $windowsDir 'WINDOWS-SHA256SUMS'),
    (Join-Path $windowsDir 'WINDOWS-VALIDATION.json'),
    (Join-Path $windowsDir 'MACOS-SHA256SUMS'),
    $macPath
)
foreach ($asset in $assets) {
    if (-not (Test-Path $asset -PathType Leaf)) { throw "Release asset missing: $asset" }
}
if ($releaseStatus -eq 404) {
    $notesPath = Join-Path $root "docs/release-notes/$tag.md"
    $arguments = @('release', 'create', $tag, '--repo', $env:GITHUB_REPOSITORY,
        '--target', $env:GITHUB_SHA, '--title', "AI Coding $tag", '--draft')
    if (Test-Path $notesPath) { $arguments += @('--notes-file', $notesPath) }
    else { $arguments += @('--generate-notes') }
    # Publish only after all Windows and Mac assets upload successfully.
    gh @arguments
}
gh release upload $tag @assets --clobber --repo $env:GITHUB_REPOSITORY
if ($releaseStatus -eq 404 -or $existingRelease.draft) {
    gh release edit $tag --draft=false --latest --repo $env:GITHUB_REPOSITORY
}
$release = gh release view $tag --repo $env:GITHUB_REPOSITORY --json url,assets | ConvertFrom-Json
$uploadedNames = @($release.assets | ForEach-Object { $_.name })
foreach ($asset in $assets) {
    if ((Split-Path $asset -Leaf) -notin $uploadedNames) { throw "Release did not retain uploaded asset: $asset" }
}
$publishedCommit = Invoke-RestMethod "$apiBase/commits/$tag" -Headers $headers
if ($publishedCommit.sha -ne $env:GITHUB_SHA) { throw 'Published release tag does not identify the validated build commit.' }
"Published release: $($release.url)" >> $env:GITHUB_STEP_SUMMARY
Write-Host "Published and verified $($release.url)"
