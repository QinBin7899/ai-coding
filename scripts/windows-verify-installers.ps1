param(
    [Parameter(Mandatory = $true)]
    [ValidatePattern('^\d+\.\d+\.\d+$')]
    [string]$Version
)

$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest
if (-not $IsWindows -or $env:GITHUB_ACTIONS -ne 'true') {
    throw 'Installer smoke checks run only on the disposable Windows GitHub runner.'
}

$root = Split-Path $PSScriptRoot -Parent
$target = Join-Path $root 'src-tauri/target/x86_64-pc-windows-msvc/release'
$output = Join-Path $root 'release/windows'
$logs = Join-Path $root 'release/windows-logs'
New-Item -ItemType Directory -Force $output, $logs | Out-Null

function Get-PeMachine([string]$Path) {
    $stream = [IO.File]::OpenRead($Path)
    $reader = [IO.BinaryReader]::new($stream)
    try {
        if ($reader.ReadUInt16() -ne 0x5a4d) { throw "Invalid DOS header: $Path" }
        $stream.Position = 0x3c
        $offset = $reader.ReadUInt32()
        if ($offset -gt $stream.Length - 6) { throw "Invalid PE offset: $Path" }
        $stream.Position = $offset
        if ($reader.ReadUInt32() -ne 0x4550) { throw "Invalid PE signature: $Path" }
        return $reader.ReadUInt16()
    }
    finally { $reader.Dispose(); $stream.Dispose() }
}

function Assert-PeVersion([string]$Path) {
    $info = [Diagnostics.FileVersionInfo]::GetVersionInfo($Path)
    $actual = "$($info.FileMajorPart).$($info.FileMinorPart).$($info.FileBuildPart)"
    if ($actual -ne $Version) { throw "Unexpected executable version $actual at $Path; expected $Version" }
    return $info.FileVersion
}

$appBinary = Join-Path $target 'ai-coding.exe'
if ((Get-PeMachine $appBinary) -ne 0x8664) { throw 'Application binary is not x64 PE.' }
$appVersion = Assert-PeVersion $appBinary
$nsisPackages = @(Get-ChildItem (Join-Path $target 'bundle/nsis') -Filter '*.exe' -File)
$msiPackages = @(Get-ChildItem (Join-Path $target 'bundle/msi') -Filter '*.msi' -File)
if ($nsisPackages.Count -ne 1 -or $msiPackages.Count -ne 1) {
    throw "Expected one NSIS and one MSI installer; got $($nsisPackages.Count) and $($msiPackages.Count)."
}
$nsisPath = Join-Path $output "AI-Coding-v$Version-windows-x64-setup.exe"
$msiPath = Join-Path $output "AI-Coding-v$Version-windows-x64.msi"
Copy-Item $nsisPackages[0].FullName $nsisPath
Copy-Item $msiPackages[0].FullName $msiPath
# NSIS uses an x86 bootstrapper even when its application payload is x64.
$nsisMachine = Get-PeMachine $nsisPath
if ($nsisMachine -notin @(0x14c, 0x8664)) { throw 'Unexpected NSIS PE architecture.' }
$nsisVersion = Assert-PeVersion $nsisPath

$installer = New-Object -ComObject WindowsInstaller.Installer
$database = $installer.OpenDatabase($msiPath, 0)
function Get-MsiProperty([string]$Name) {
    $view = $database.OpenView("SELECT ``Value`` FROM ``Property`` WHERE ``Property`` = '$Name'")
    $view.Execute()
    $record = $view.Fetch()
    if ($null -eq $record) { throw "MSI property missing: $Name" }
    $value = $record.StringData(1)
    $view.Close()
    return $value
}
$msiVersion = Get-MsiProperty 'ProductVersion'
$msiProduct = Get-MsiProperty 'ProductName'
$productCode = Get-MsiProperty 'ProductCode'
$summary = $database.SummaryInformation(0)
$msiTemplate = $summary.Property(7)
if ($msiVersion -ne $Version -or $msiProduct -ne 'AI Coding') {
    throw "Unexpected MSI product/version: $msiProduct $msiVersion"
}
if ($msiTemplate -notmatch '^x64;') { throw "MSI package is not x64: $msiTemplate" }
if ($productCode -notmatch '^\{[0-9A-Fa-f-]{36}\}$') { throw 'Invalid MSI ProductCode' }
[void][Runtime.InteropServices.Marshal]::FinalReleaseComObject($summary)
[void][Runtime.InteropServices.Marshal]::FinalReleaseComObject($database)
[void][Runtime.InteropServices.Marshal]::FinalReleaseComObject($installer)

$smokeRoot = Join-Path $env:RUNNER_TEMP "ai-coding-msi-smoke-$env:GITHUB_RUN_ID"
$installParent = Join-Path $smokeRoot 'Programs'
$installDir = Join-Path $installParent 'AI Coding'
$testHome = Join-Path $smokeRoot 'application-data'
$sharedPrograms = Join-Path ([Environment]::GetFolderPath('LocalApplicationData')) 'Programs'
New-Item -ItemType Directory -Force $installParent, $testHome, $sharedPrograms | Out-Null
$sentinelText = "AI Coding uninstall must preserve this unrelated file: $env:GITHUB_RUN_ID"
$sentinels = @(
    (Join-Path $installParent 'unrelated-application-sentinel.txt'),
    (Join-Path $sharedPrograms "ai-coding-uninstall-sentinel-$env:GITHUB_RUN_ID.txt"),
    (Join-Path $testHome 'user-data-sentinel.txt')
)
foreach ($sentinel in $sentinels) { Set-Content $sentinel $sentinelText -NoNewline }

function Invoke-Msi([string]$Arguments, [string]$LogPath) {
    $process = Start-Process msiexec.exe -ArgumentList "$Arguments /qn /norestart /L*v `"$LogPath`"" -PassThru
    if (-not $process.WaitForExit(300000)) { throw 'MSI operation did not finish within five minutes.' }
    if ($process.ExitCode -notin @(0, 3010)) { throw "MSI failed with exit code $($process.ExitCode); see $LogPath" }
}

$appProcess = $null
$installationAttempted = $false
$installationSucceeded = $false
$smokeSucceeded = $false
try {
    $installationAttempted = $true
    # Leave AUTOLAUNCHAPP unset: in MSI conditions even the string "0" is truthy.
    Invoke-Msi "/i `"$msiPath`" INSTALLDIR=`"$installDir`"" (Join-Path $logs 'msi-install.log')
    $installationSucceeded = $true
    $installedBinary = Join-Path $installDir 'ai-coding.exe'
    if (-not (Test-Path $installedBinary -PathType Leaf)) { throw 'MSI did not install the application executable.' }
    if ((Get-FileHash $installedBinary).Hash -ne (Get-FileHash $appBinary).Hash) {
        throw 'Installed application differs from the validated build.'
    }
    $startInfo = [Diagnostics.ProcessStartInfo]::new($installedBinary)
    $startInfo.UseShellExecute = $false
    $startInfo.WorkingDirectory = $testHome
    $startInfo.Environment['CC_SWITCH_TEST_HOME'] = $testHome
    $startInfo.Environment['WEBVIEW2_USER_DATA_FOLDER'] = Join-Path $smokeRoot 'webview2-data'
    $appProcess = [Diagnostics.Process]::Start($startInfo)
    if ($appProcess.WaitForExit(15000)) {
        throw "Installed application exited during startup (code $($appProcess.ExitCode))."
    }
    $smokeSucceeded = $true
    Write-Host "Installed AI Coding process $($appProcess.Id) remained alive for 15 seconds."
}
finally {
    # Stop only the native application process created above; never enumerate or kill browsers.
    if ($null -ne $appProcess -and -not $appProcess.HasExited) {
        [void]$appProcess.CloseMainWindow()
        if (-not $appProcess.WaitForExit(5000)) {
            $appProcess.Kill()
            $appProcess.WaitForExit()
        }
    }
    if ($installationAttempted) {
        # /x targets exactly the just-built ProductCode, never another installed application.
        try { Invoke-Msi "/x $productCode" (Join-Path $logs 'msi-uninstall.log') }
        catch { if ($installationSucceeded) { throw }; Write-Warning $_ }
    }
    foreach ($sentinel in $sentinels) {
        if (-not (Test-Path $sentinel) -or (Get-Content $sentinel -Raw) -ne $sentinelText) {
            throw "MSI uninstall changed unrelated data: $sentinel"
        }
    }
}
if (Test-Path (Join-Path $installDir 'ai-coding.exe')) { throw 'MSI uninstall left the installed application executable behind.' }

$report = [ordered]@{
    version = $Version
    commit = $env:GITHUB_SHA
    target = 'x86_64-pc-windows-msvc'
    applicationPeMachine = '0x8664'
    applicationFileVersion = $appVersion
    nsisBootstrapperPeMachine = ('0x{0:x4}' -f $nsisMachine)
    nsisFileVersion = $nsisVersion
    msiProductVersion = $msiVersion
    msiTemplate = $msiTemplate
    msiInstallAndStartupPassed = $smokeSucceeded
    msiUninstallPreservedSentinels = $true
    startupObservationSeconds = 15
}
$report | ConvertTo-Json | Set-Content (Join-Path $output 'WINDOWS-VALIDATION.json') -Encoding utf8
Get-ChildItem $output -File | Where-Object Name -ne 'WINDOWS-SHA256SUMS' | Sort-Object Name | ForEach-Object {
    '{0}  {1}' -f (Get-FileHash $_.FullName -Algorithm SHA256).Hash.ToLowerInvariant(), $_.Name
} | Set-Content (Join-Path $output 'WINDOWS-SHA256SUMS') -Encoding ascii
Write-Host 'Windows PE checks, MSI installation/startup/uninstallation, and checksum generation passed.'
