param([string]$GccCompiler)
$ErrorActionPreference='Stop'
$project=Split-Path -Parent $PSScriptRoot
& (Join-Path $project 'Build-Launcher.ps1') -GccCompiler $GccCompiler
if(-not $GccCompiler){
  $compiler=Get-Command gcc.exe -ErrorAction SilentlyContinue
  if($compiler){$GccCompiler=$compiler.Source}
  else{$GccCompiler=@('C:\msys64\ucrt64\bin\gcc.exe','C:\msys64\mingw64\bin\gcc.exe','C:\mingw64\bin\gcc.exe') | Where-Object{Test-Path -LiteralPath $_} | Select-Object -First 1}
}
$lab=Join-Path $project ('.test-lab\launcher-'+[Guid]::NewGuid().ToString('N'))
$root=Join-Path $lab ('Myify installed '+[char]0x00E9+' with spaces')
$null=New-Item -ItemType Directory -Path (Join-Path $root 'desktop'),(Join-Path $lab 'profile') -Force
Copy-Item -LiteralPath (Join-Path $project 'dist\Myify.exe') -Destination $root
$manager=Join-Path $root 'Manager.ps1'
@'
param([string]$Action,[switch]$Quiet)
[IO.File]::WriteAllText((Join-Path $PSScriptRoot 'action.txt'),$Action)
exit 0
'@ | Set-Content -LiteralPath $manager -Encoding UTF8
$stub=Join-Path $lab 'stub.c'
@'
#include <windows.h>
#include <wchar.h>
int WINAPI wWinMain(HINSTANCE a,HINSTANCE b,PWSTR c,int d){
  wchar_t p[32768];GetModuleFileNameW(NULL,p,32768);wcscpy(wcsrchr(p,92)+1,L"opened.txt");
  HANDLE f=CreateFileW(p,GENERIC_WRITE,FILE_SHARE_READ,NULL,CREATE_ALWAYS,0,NULL);
  if(f==INVALID_HANDLE_VALUE)return 1;DWORD n;WriteFile(f,"opened",6,&n,NULL);CloseHandle(f);return 0;
}
'@ | Set-Content -LiteralPath $stub -Encoding UTF8
& $GccCompiler -municode -mwindows -static $stub -o (Join-Path $lab 'fixture-desktop.exe')
if($LASTEXITCODE-ne 0){throw 'Fixture build failed'}
Copy-Item -LiteralPath (Join-Path $lab 'fixture-desktop.exe') -Destination (Join-Path $root 'desktop\MyifyDesktop.exe')
function Run-Launcher([string]$Path,[string]$Arguments=''){
  $options=@{FilePath=$Path;WindowStyle='Hidden';PassThru=$true;Wait=$true}
  if($Arguments){$options.ArgumentList=$Arguments}
  return (Start-Process @options).ExitCode
}
$originalLocal=$env:LOCALAPPDATA
try{
  $env:LOCALAPPDATA=Join-Path $lab 'profile'
  $exe=Join-Path $root 'Myify.exe'
  if((Run-Launcher $exe '--check')-ne 0){throw 'Check failed in a path with spaces / Unicode'}
  if([IO.File]::ReadAllText((Join-Path $root 'action.txt'))-ne 'Check'){throw 'Check did not reach the installed manager'}
  if(Test-Path -LiteralPath (Join-Path $root 'desktop\opened.txt')){throw 'Check opened desktop tools'}
  if((Run-Launcher $exe)-ne 0){throw 'Launch failed'}
  for($i=0;$i-lt 30 -and -not(Test-Path -LiteralPath (Join-Path $root 'desktop\opened.txt'));$i++){Start-Sleep -Milliseconds 100}
  if(-not(Test-Path -LiteralPath (Join-Path $root 'desktop\opened.txt'))){throw 'Desktop tools were not launched'}
  if([IO.File]::ReadAllText((Join-Path $root 'action.txt'))-ne 'Launch'){throw 'Launch did not use the managed startup path'}
  if((Run-Launcher $exe)-ne 0){throw 'Repeated launch failed'}
  "param([string]`$Action,[switch]`$Quiet); Write-Error 'fixture startup failure'; exit 23" | Set-Content -LiteralPath $manager -Encoding UTF8
  if((Run-Launcher $exe '--check')-ne 4){throw 'Manager failure was silently accepted'}
  if(-not(Select-String -LiteralPath (Join-Path $env:LOCALAPPDATA 'SpotifyNativeEnhancerData\launcher.log') -Pattern 'fixture startup failure' -Quiet)){throw 'Manager failure was not captured in diagnostics'}
  $missing=Join-Path $lab 'Incomplete install';$null=New-Item -ItemType Directory -Path $missing
  Copy-Item -LiteralPath $exe -Destination $missing
  if((Run-Launcher (Join-Path $missing 'Myify.exe') '--check')-ne 2){throw 'Missing install files were silently accepted'}
  Write-Output 'PASS: native launcher check/launch/relaunch, Unicode and spaces, read-only check, manager error logging, missing-file rejection.'
}finally{$env:LOCALAPPDATA=$originalLocal}
