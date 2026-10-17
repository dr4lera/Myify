param([string]$InnoCompiler,[string]$DesktopPayload,[string]$GccCompiler)
$ErrorActionPreference='Stop'
& node (Join-Path $PSScriptRoot 'scripts\build.cjs')
if($LASTEXITCODE-ne 0){throw 'Loader build failed.'}
& (Join-Path $PSScriptRoot 'Build-Launcher.ps1') -GccCompiler $GccCompiler
$payload=Join-Path $PSScriptRoot 'installer\payload'
[IO.Directory]::CreateDirectory($payload)|Out-Null
foreach($name in @('Engine.psm1','Manager.ps1','supported-build.json')){Copy-Item -LiteralPath (Join-Path $PSScriptRoot ('installer\'+$name)) -Destination $payload -Force}
Copy-Item -LiteralPath (Join-Path $PSScriptRoot 'dist\native-loader.js') -Destination $payload -Force
Copy-Item -LiteralPath (Join-Path $PSScriptRoot 'README.txt') -Destination $payload -Force
Copy-Item -LiteralPath (Join-Path $PSScriptRoot 'LICENSE') -Destination $payload -Force
Copy-Item -LiteralPath (Join-Path $PSScriptRoot 'dist\Myify.exe') -Destination $payload -Force
if(-not $DesktopPayload){$DesktopPayload=Join-Path $PSScriptRoot 'dist\desktop-build\MyifyDesktop'}
if(-not(Test-Path -LiteralPath (Join-Path $DesktopPayload 'MyifyDesktop.exe'))){throw 'Build the integrated desktop tools with Build-Desktop.ps1 before building the installer.'}
$desktopDestination=[IO.Path]::GetFullPath((Join-Path $payload 'desktop'))
if(-not $desktopDestination.StartsWith([IO.Path]::GetFullPath($PSScriptRoot)+[IO.Path]::DirectorySeparatorChar,[StringComparison]::OrdinalIgnoreCase)){throw 'Desktop staging directory escaped the project.'}
if(Test-Path -LiteralPath $desktopDestination){Remove-Item -LiteralPath $desktopDestination -Recurse -Force}
Copy-Item -LiteralPath $DesktopPayload -Destination (Join-Path $payload 'desktop') -Recurse -Force
if(-not $InnoCompiler){$candidate=Get-Command ISCC.exe -ErrorAction SilentlyContinue;if($candidate){$InnoCompiler=$candidate.Source}else{$InnoCompiler=Join-Path ${env:ProgramFiles(x86)} 'Inno Setup 6\ISCC.exe'}}
if(-not(Test-Path -LiteralPath $InnoCompiler)){throw 'Install Inno Setup 6 or pass -InnoCompiler.'}
& $InnoCompiler (Join-Path $PSScriptRoot 'installer\Myify.iss')
if($LASTEXITCODE-ne 0){throw 'Installer compiler failed.'}
$version=(Get-Content (Join-Path $PSScriptRoot 'package.json') -Raw|ConvertFrom-Json).version
$exe=Join-Path $PSScriptRoot "dist\Myify-Setup-$version.exe"
$hash=(Get-FileHash -LiteralPath $exe -Algorithm SHA256).Hash.ToLowerInvariant()
[IO.File]::WriteAllText((Join-Path $PSScriptRoot 'dist\SHA256SUMS'),"$hash  Myify-Setup-$version.exe`n",[Text.UTF8Encoding]::new($false))
Write-Output $exe
