param([string]$InnoCompiler)
$ErrorActionPreference='Stop'
& node (Join-Path $PSScriptRoot 'scripts\build.cjs')
if($LASTEXITCODE-ne 0){throw 'Loader build failed.'}
$payload=Join-Path $PSScriptRoot 'installer\payload'
[IO.Directory]::CreateDirectory($payload)|Out-Null
foreach($name in @('Engine.psm1','Manager.ps1','supported-build.json')){Copy-Item -LiteralPath (Join-Path $PSScriptRoot ('installer\'+$name)) -Destination $payload -Force}
Copy-Item -LiteralPath (Join-Path $PSScriptRoot 'dist\native-loader.js') -Destination $payload -Force
Copy-Item -LiteralPath (Join-Path $PSScriptRoot 'README.txt') -Destination $payload -Force
Copy-Item -LiteralPath (Join-Path $PSScriptRoot 'LICENSE') -Destination $payload -Force
if(-not $InnoCompiler){$candidate=Get-Command ISCC.exe -ErrorAction SilentlyContinue;if($candidate){$InnoCompiler=$candidate.Source}else{$InnoCompiler=Join-Path ${env:ProgramFiles(x86)} 'Inno Setup 6\ISCC.exe'}}
if(-not(Test-Path -LiteralPath $InnoCompiler)){throw 'Install Inno Setup 6 or pass -InnoCompiler.'}
& $InnoCompiler (Join-Path $PSScriptRoot 'installer\Myify.iss')
if($LASTEXITCODE-ne 0){throw 'Installer compiler failed.'}
$version=(Get-Content (Join-Path $PSScriptRoot 'package.json') -Raw|ConvertFrom-Json).version
$exe=Join-Path $PSScriptRoot "dist\Myify-Setup-$version.exe"
$hash=(Get-FileHash -LiteralPath $exe -Algorithm SHA256).Hash.ToLowerInvariant()
[IO.File]::WriteAllText((Join-Path $PSScriptRoot 'dist\SHA256SUMS'),"$hash  Myify-Setup-$version.exe`n",[Text.UTF8Encoding]::new($false))
Write-Output $exe
