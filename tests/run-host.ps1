param([string]$Compiler = 'gcc')
$ErrorActionPreference = 'Stop'
Push-Location (Split-Path $PSScriptRoot -Parent)
try {
    New-Item -ItemType Directory -Path tests/output -Force | Out-Null
    & node tests/format-test.cjs
    if ($LASTEXITCODE) { throw 'Encoder tests failed' }
    & $Compiler -std=c99 -Wall -Wextra -Werror tests/gallery-test.c src/gallery.c -o tests/output/gallery-test.exe
    if ($LASTEXITCODE) { throw 'Parser test build failed' }
    & tests/output/gallery-test.exe
    if ($LASTEXITCODE) { throw 'Parser tests failed' }
    & $Compiler -std=c99 -DSIMULATOR=1 -Dmain=app_main -c src/main.c -o tests/output/main-test.o
    if ($LASTEXITCODE) { throw 'Viewer test build failed' }
    & $Compiler tests/runtime-test.c tests/output/main-test.o src/gallery.c -lm -o tests/output/runtime-test.exe
    if ($LASTEXITCODE) { throw 'Viewer test link failed' }
    & tests/output/runtime-test.exe
    if ($LASTEXITCODE) { throw 'Viewer tests failed' }
} finally { Pop-Location }
