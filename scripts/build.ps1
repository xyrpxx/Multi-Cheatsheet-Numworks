param(
    [ValidateSet('device', 'simulator')][string]$Platform = 'device',
    [string]$DepsRoot = '',
    [switch]$BundledSimulator
)
$ErrorActionPreference = 'Stop'
$root = Split-Path $PSScriptRoot -Parent
if (!$DepsRoot) { $DepsRoot = [IO.Path]::GetFullPath((Join-Path $root '..\..\Numworks app\.deps')) }
$make = Join-Path $DepsRoot 'msys2\msys64\usr\bin\make.exe'
if (!(Test-Path -LiteralPath $make)) { throw 'MSYS2 not found. Supply -DepsRoot or use the Makefile with your own toolchain.' }
$oldPath = $env:PATH
Push-Location $root
try {
    $env:PATH = "$(Join-Path $DepsRoot 'arm-toolchain\bin');$(Join-Path $DepsRoot 'msys2\msys64\mingw64\bin');$(Join-Path $DepsRoot 'msys2\msys64\usr\bin');$oldPath"
    $nwlink = (Join-Path $DepsRoot 'npm\node_modules\nwlink\bin\nwlink').Replace('\', '/')
    if ($Platform -eq 'device') {
        & $make build "NWLINK=node `"$nwlink`""
    } elseif ($BundledSimulator) {
        & $make output/sim/app.dll
    } else {
        $lib = Join-Path $DepsRoot 'epsilon\epsilon\external_apps\epsilon_simulators\windows\libepsilon.a'
        if (!(Test-Path -LiteralPath $lib)) { throw 'Official simulator library not found; use -BundledSimulator for the legacy simulator.' }
        New-Item -ItemType Directory -Path output/sim-current -Force | Out-Null
        Copy-Item -LiteralPath $lib -Destination output/sim-current/libepsilon.a
        & $make output/sim-current/app.dll BUILD_DIR_TEST=output/sim-current SIM_LIB=output/sim-current/libepsilon.a SIM_SPLIT_API=1
    }
    if ($LASTEXITCODE -ne 0) { throw "Build failed: $LASTEXITCODE" }
} finally { $env:PATH = $oldPath; Pop-Location }
