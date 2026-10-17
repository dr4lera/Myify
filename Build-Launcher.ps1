param([string]$GccCompiler)
$ErrorActionPreference='Stop'
if(-not $GccCompiler){
  $compiler=Get-Command gcc.exe -ErrorAction SilentlyContinue
  if($compiler){$GccCompiler=$compiler.Source}
  else{$GccCompiler=@('C:\msys64\ucrt64\bin\gcc.exe','C:\msys64\mingw64\bin\gcc.exe','C:\mingw64\bin\gcc.exe') | Where-Object{Test-Path -LiteralPath $_} | Select-Object -First 1}
}
if(-not $GccCompiler){throw 'Install a Windows MinGW-w64 GCC compiler, or pass -GccCompiler to Build-Launcher.ps1 / Build-Installer.ps1.'}
$output=Join-Path $PSScriptRoot 'dist\Myify.exe'
[IO.Directory]::CreateDirectory((Split-Path -Parent $output))|Out-Null
& $GccCompiler -municode -mwindows -static -Os -s -Wall -Wextra -Werror '-Wl,--dynamicbase,--nxcompat' (Join-Path $PSScriptRoot 'launcher\main.c') -o $output -lshell32
if($LASTEXITCODE-ne 0){throw 'Native Myify launcher build failed.'}
Write-Output $output
