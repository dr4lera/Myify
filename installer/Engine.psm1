$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.IO.Compression.FileSystem
Add-Type -AssemblyName System.IO.Compression
$script:Bootstrap = '<script src="/local-enhancer.js"></script>'
$script:UpdateFlags = '--update-endpoint-override=http://127.0.0.1:9/ --disable-update-restarts'
$script:BlockMarker = 'Spotify Native Enhancer update staging lock v1'

function Initialize-Enhancer {
  param([string]$SpotifyRoot,[string]$DataRoot,[string]$LocalSpotifyRoot)
  if (-not $DataRoot) { $DataRoot=Join-Path $env:LOCALAPPDATA 'SpotifyNativeEnhancerData' }
  if (-not $LocalSpotifyRoot) { $LocalSpotifyRoot=Join-Path $env:LOCALAPPDATA 'Spotify' }
  if (-not $SpotifyRoot) {
    $saved=Read-Json (Join-Path $DataRoot 'installation.json')
    if($saved -and $saved.spotifyRoot){$SpotifyRoot=$saved.spotifyRoot}
    else {
      $candidates=@((Join-Path $env:APPDATA 'Spotify'),(Join-Path $env:LOCALAPPDATA 'Spotify'),(Join-Path $env:LOCALAPPDATA 'Programs\Spotify'))
      if($env:ProgramFiles){$candidates+=Join-Path $env:ProgramFiles 'Spotify'}
      if(${env:ProgramFiles(x86)}){$candidates+=Join-Path ${env:ProgramFiles(x86)} 'Spotify'}
      $SpotifyRoot=$candidates | Where-Object{(Test-Path -LiteralPath (Join-Path $_ 'Spotify.exe')) -and (Test-Path -LiteralPath (Join-Path $_ 'Apps\xpui.spa'))} | Select-Object -First 1
      if(-not $SpotifyRoot){$SpotifyRoot=Join-Path $env:APPDATA 'Spotify'}
    }
  }
  $script:SpotifyRoot=[IO.Path]::GetFullPath($SpotifyRoot)
  $script:DataRoot=[IO.Path]::GetFullPath($DataRoot)
  $script:LocalSpotifyRoot=[IO.Path]::GetFullPath($LocalSpotifyRoot)
  $script:InstallRoot=$PSScriptRoot
  $script:Exe=Join-Path $script:SpotifyRoot 'Spotify.exe'
  $script:UI=Join-Path $script:SpotifyRoot 'Apps\xpui.spa'
  $script:Receipt=Join-Path $script:DataRoot 'installation.json'
  $script:Protection=Join-Path $script:DataRoot 'update-protection.json'
  $script:Builds=Get-Content -LiteralPath (Join-Path $PSScriptRoot 'supported-build.json') -Raw|ConvertFrom-Json
}
function FileHash([string]$Path) { $stream=[IO.File]::OpenRead($Path);$sha=[Security.Cryptography.SHA256]::Create();try{return ([BitConverter]::ToString($sha.ComputeHash($stream))).Replace('-','').ToLowerInvariant()}finally{$stream.Dispose();$sha.Dispose()} }
function BytesHash([byte[]]$Bytes) { $sha=[Security.Cryptography.SHA256]::Create();try{return ([BitConverter]::ToString($sha.ComputeHash($Bytes))).Replace('-','').ToLowerInvariant()}finally{$sha.Dispose()} }
function Read-Entry($Entry) { $memory=[IO.MemoryStream]::new();$stream=$Entry.Open();try{$stream.CopyTo($memory);return ,$memory.ToArray()}finally{$stream.Dispose();$memory.Dispose()} }
function Write-Json([string]$Path,$Value) { [IO.Directory]::CreateDirectory([IO.Path]::GetDirectoryName($Path))|Out-Null;[IO.File]::WriteAllText($Path+'.new',($Value|ConvertTo-Json -Depth 12),[Text.UTF8Encoding]::new($false));Move-Item -LiteralPath ($Path+'.new') -Destination $Path -Force }
function Read-Json([string]$Path) { if(Test-Path -LiteralPath $Path){return Get-Content -LiteralPath $Path -Raw|ConvertFrom-Json};return $null }
function Get-SpotifyVersion([string]$Path) {
  $info=(Get-Item -LiteralPath $Path).VersionInfo
  return '{0}.{1}.{2}.{3}' -f $info.FileMajorPart,$info.FileMinorPart,$info.FileBuildPart,$info.FilePrivatePart
}
function Assert-Supported {
  if(-not(Test-Path -LiteralPath $script:Exe)){throw "Spotify.exe was not found in $script:SpotifyRoot. Select the folder containing your standalone desktop Spotify.exe. Microsoft Store packages are not supported."}
  $version=Get-SpotifyVersion $script:Exe
  if($version -ne $script:Builds.spotifyVersion){throw "Detected Spotify $version at $script:Exe. This release supports $($script:Builds.spotifyVersion). Spotify was not patched."}
  return $version
}
function Test-SpotifyContent([string]$Path,[switch]$AllowEnhancer) {
  $zip=[IO.Compression.ZipFile]::OpenRead($Path)
  try{
    $expected=$script:Builds.entries
    foreach($property in $expected.PSObject.Properties){
      $entry=$zip.GetEntry($property.Name);if(-not $entry){throw "Spotify resource missing: $($property.Name)"}
      $bytes=Read-Entry $entry
      if($AllowEnhancer -and $property.Name -eq 'index.html'){$html=[Text.Encoding]::UTF8.GetString($bytes);$html=$html.Replace($script:Bootstrap,'');$bytes=[Text.Encoding]::UTF8.GetBytes($html)}
      if((BytesHash $bytes) -ne $property.Value){throw "Spotify resource differs from the tested build: $($property.Name)"}
    }
    foreach($entry in $zip.Entries){
      if(-not $entry.Name){continue}
      if($expected.PSObject.Properties.Name -contains $entry.FullName){continue}
      if($AllowEnhancer -and $entry.FullName -eq 'local-enhancer.js'){continue}
      throw "An unknown Spotify modification is present: $($entry.FullName)"
    }
    return $true
  }finally{$zip.Dispose()}
}
function Edit-Archive([string]$Path,[switch]$Remove) {
  $zip=[IO.Compression.ZipFile]::Open($Path,[IO.Compression.ZipArchiveMode]::Update)
  try{
    $index=$zip.GetEntry('index.html');$html=[Text.Encoding]::UTF8.GetString((Read-Entry $index));$html=$html.Replace($script:Bootstrap,'');$index.Delete()
    $old=$zip.GetEntry('local-enhancer.js');if($old){$old.Delete()}
    if(-not $Remove){$anchor='<script defer="defer" src="/xpui-snapshot.js"></script>';if(($html.Split(@($anchor),[StringSplitOptions]::None).Count-1)-ne 1){throw 'Spotify startup entry changed.'};$html=$html.Replace($anchor,$script:Bootstrap+$anchor)}
    $entry=$zip.CreateEntry('index.html',[IO.Compression.CompressionLevel]::Optimal);$writer=[IO.StreamWriter]::new($entry.Open(),[Text.UTF8Encoding]::new($false));try{$writer.Write($html)}finally{$writer.Dispose()}
    if(-not $Remove){$entry=$zip.CreateEntry('local-enhancer.js',[IO.Compression.CompressionLevel]::Optimal);$writer=[IO.StreamWriter]::new($entry.Open(),[Text.UTF8Encoding]::new($false));try{$config=Get-BridgeConfiguration;$loader=[IO.File]::ReadAllText((Join-Path $PSScriptRoot 'native-loader.js'));$writer.Write($loader.Replace('/*MYIFY_CONFIG*/null',($config|ConvertTo-Json -Compress)))}finally{$writer.Dispose()}}
  }finally{$zip.Dispose()}
}
function Stop-Spotify {
  $main=Get-CimInstance Win32_Process -Filter "Name='Spotify.exe'" -ErrorAction SilentlyContinue|Where-Object{ $_.ExecutablePath -and [IO.Path]::GetFullPath($_.ExecutablePath) -eq $script:Exe -and $_.CommandLine -notmatch '--type=' }
  if($main){$config=Read-Json (Join-Path $script:DataRoot 'bridge.json');if($config){try{Invoke-RestMethod -Uri ('http://127.0.0.1:'+$config.port+'/prepare') -Method Post -Headers @{Origin='https://xpui.app.spotify.com';Authorization=('Bearer '+$config.token)} -ContentType 'application/json' -Body '{}' -TimeoutSec 2|Out-Null;for($i=0;$i-lt 20;$i++){if(-not($main|Where-Object{Get-Process -Id $_.ProcessId -ErrorAction SilentlyContinue})){break};Start-Sleep -Milliseconds 150}}catch{}}}
  foreach($process in $main){
    $p=Get-Process -Id $process.ProcessId -ErrorAction SilentlyContinue
    if($p -and $p.MainWindowHandle -ne 0){$null=$p.CloseMainWindow();Start-Sleep -Milliseconds 800}
    if(Get-Process -Id $process.ProcessId -ErrorAction SilentlyContinue){Stop-Process -Id $process.ProcessId -ErrorAction Stop}
  }
  for($i=0;$i-lt 30;$i++){
    $remaining=Get-Process Spotify -ErrorAction SilentlyContinue|Where-Object{$_.Path -and [IO.Path]::GetFullPath($_.Path)-eq $script:Exe}
    if(-not $remaining){return};Start-Sleep -Milliseconds 100
  }
  throw 'Spotify did not finish closing. Close it and retry.'
}
function Install-Enhancer {
  param([switch]$CloseSpotify,[switch]$ProtectUpdates,[switch]$SkipShortcuts)
  $version=Assert-Supported
  $null=Get-BridgeConfiguration
  $null=Test-SpotifyContent $script:UI -AllowEnhancer
  [IO.Directory]::CreateDirectory($script:DataRoot)|Out-Null
  $original=Join-Path $script:DataRoot ('backup-'+$version+'.spa')
  if(-not(Test-Path -LiteralPath $original)){
    Copy-Item -LiteralPath $script:UI -Destination ($original+'.new')
    Edit-Archive ($original+'.new') -Remove
    $null=Test-SpotifyContent ($original+'.new')
    Move-Item -LiteralPath ($original+'.new') -Destination $original
  }else{$null=Test-SpotifyContent $original}
  $previous=Read-Json $script:Receipt
  $loader=[IO.File]::ReadAllText((Join-Path $PSScriptRoot 'native-loader.js')).Replace('/*MYIFY_CONFIG*/null',((Get-BridgeConfiguration)|ConvertTo-Json -Compress))
  $loaderHash=BytesHash ([Text.Encoding]::UTF8.GetBytes($loader))
  if($previous -and $previous.loaderSha256-eq $loaderHash -and $previous.patchedSha256-eq(FileHash $script:UI)){
    if($CloseSpotify){Stop-DesktopTools}
    if($ProtectUpdates){Enable-UpdateProtection -SkipShortcuts:$SkipShortcuts}
    return Get-EnhancerStatus
  }
  $patch=Join-Path $script:DataRoot 'prepared-xpui.spa'
  Copy-Item -LiteralPath $original -Destination $patch -Force;Edit-Archive $patch
  $null=Test-SpotifyContent $patch -AllowEnhancer
  if($CloseSpotify){Stop-Spotify;Stop-DesktopTools}else{if(Get-Process Spotify -ErrorAction SilentlyContinue|Where-Object{$_.Path -eq $script:Exe}){throw 'Close Spotify before applying the enhancement.'}}
  $rollback=Join-Path $script:DataRoot 'previous-xpui.spa';Copy-Item -LiteralPath $script:UI -Destination $rollback -Force
  try{
    Copy-Item -LiteralPath $patch -Destination $script:UI -Force
    if((FileHash $script:UI)-ne(FileHash $patch)){throw 'Installed archive failed verification.'}
    Write-Json $script:Receipt ([ordered]@{enhancerVersion='0.4.1';spotifyVersion=$version;spotifyRoot=$script:SpotifyRoot;originalBackup=$original;originalSha256=(FileHash $original);patchedSha256=(FileHash $patch);loaderSha256=$loaderHash;installedAt=(Get-Date).ToString('o')})
    if($ProtectUpdates){Enable-UpdateProtection -SkipShortcuts:$SkipShortcuts}
  }catch{Copy-Item -LiteralPath $rollback -Destination $script:UI -Force;if($previous){Write-Json $script:Receipt $previous}elseif(Test-Path -LiteralPath $script:Receipt){Remove-Item -LiteralPath $script:Receipt};throw}
  return Get-EnhancerStatus
}
function Enable-UpdateProtection {
  param([switch]$SkipShortcuts)
  $null=Assert-Supported
  $existing=Read-Json $script:Protection
  if($existing -and $existing.enabled){
    $missing=@($existing.paths|Where-Object{-not(Test-Path -LiteralPath $_.path -PathType Leaf) -or [IO.File]::ReadAllText($_.path)-ne $script:BlockMarker})
    if(-not $missing.Count){return};Disable-UpdateProtection
  }
  $record=[ordered]@{enabled=$false;paths=@();shortcuts=@();startup=$null;flags=$script:UpdateFlags}
  [IO.Directory]::CreateDirectory($script:DataRoot)|Out-Null
  try{
    $roots=@($script:SpotifyRoot,$script:LocalSpotifyRoot)|Select-Object -Unique
    $index=0
    foreach($root in $roots){
      $target=[IO.Path]::GetFullPath((Join-Path $root 'Update'))
      if([IO.Path]::GetDirectoryName($target)-ne [IO.Path]::GetFullPath($root)){throw 'Update staging target failed containment validation.'}
      [IO.Directory]::CreateDirectory($root)|Out-Null
      $item=Get-Item -LiteralPath $target -Force -ErrorAction SilentlyContinue
      if($item -and ($item.Attributes-band[IO.FileAttributes]::ReparsePoint)){throw 'Update staging is a link; protection was not applied.'}
      $saved=$null
      if($item){$saved=Join-Path $script:DataRoot ('update-staging-backup-'+$index);if(Test-Path -LiteralPath $saved){throw 'An earlier update staging backup already exists.'};Move-Item -LiteralPath $target -Destination $saved}
      $pathRecord=[ordered]@{path=$target;backup=$saved;created=$false}
      $record.paths+=,$pathRecord;Write-Json $script:Protection $record
      [IO.File]::WriteAllText($target,$script:BlockMarker,[Text.UTF8Encoding]::new($false));[IO.File]::SetAttributes($target,[IO.FileAttributes]::ReadOnly);$pathRecord.created=$true
      Write-Json $script:Protection $record;$index++
    }
    if(-not $SkipShortcuts){
      $shell=New-Object -ComObject WScript.Shell
      $folders=@([Environment]::GetFolderPath('Desktop'),(Join-Path $env:APPDATA 'Microsoft\Windows\Start Menu\Programs'),(Join-Path $env:APPDATA 'Microsoft\Internet Explorer\Quick Launch\User Pinned\TaskBar'))|Select-Object -Unique
      $counter=0
      foreach($folder in $folders){foreach($link in Get-ChildItem -LiteralPath $folder -Filter '*Spotify*.lnk' -File -ErrorAction SilentlyContinue){
        $shortcut=$shell.CreateShortcut($link.FullName)
        if($shortcut.TargetPath-ne $script:Exe){continue}
        $backup=Join-Path $script:DataRoot ('shortcut-'+$counter+'.lnk');Copy-Item -LiteralPath $link.FullName -Destination $backup -Force
        $entry=[ordered]@{path=$link.FullName;backup=$backup;modifiedSha256=$null};$record.shortcuts+=,$entry;Write-Json $script:Protection $record
        if($shortcut.Arguments-notmatch '--update-endpoint-override='){$shortcut.Arguments=($shortcut.Arguments+' '+$script:UpdateFlags).Trim();$shortcut.Save()}
        $entry.modifiedSha256=FileHash $link.FullName;Write-Json $script:Protection $record;$counter++
      }}
      $run='HKCU:\Software\Microsoft\Windows\CurrentVersion\Run'
      $startup=Get-ItemPropertyValue -LiteralPath $run -Name Spotify -ErrorAction SilentlyContinue
      if($startup -and $startup.IndexOf($script:Exe,[StringComparison]::OrdinalIgnoreCase)-ge 0 -and $startup-notmatch '--update-endpoint-override='){
        $record.startup=@{original=$startup;modified=($startup+' '+$script:UpdateFlags)};Write-Json $script:Protection $record;Set-ItemProperty -LiteralPath $run -Name Spotify -Value $record.startup.modified
      }
    }
    $record.enabled=$true;Write-Json $script:Protection $record
  }catch{Write-Json $script:Protection $record;Disable-UpdateProtection;throw}
}
function Disable-UpdateProtection {
  $record=Read-Json $script:Protection;if(-not $record){return}
  foreach($entry in $record.paths){
    if(Test-Path -LiteralPath $entry.path){
      $item=Get-Item -LiteralPath $entry.path -Force
      if(-not $item.PSIsContainer -and [IO.File]::ReadAllText($entry.path)-eq $script:BlockMarker){[IO.File]::SetAttributes($entry.path,[IO.FileAttributes]::Normal);Remove-Item -LiteralPath $entry.path -Force}
      elseif($entry.backup){throw "Spotify update staging changed. Original staging backup is retained at $($entry.backup)."}
    }
    if($entry.backup -and (Test-Path -LiteralPath $entry.backup) -and -not(Test-Path -LiteralPath $entry.path)){
      $allowed=@((Join-Path $script:SpotifyRoot 'Update'),(Join-Path $script:LocalSpotifyRoot 'Update'))|ForEach-Object{[IO.Path]::GetFullPath($_)}
      $source=[IO.Path]::GetFullPath($entry.backup);$destination=[IO.Path]::GetFullPath($entry.path)
      if(-not $source.StartsWith($script:DataRoot+[IO.Path]::DirectorySeparatorChar,[StringComparison]::OrdinalIgnoreCase)-or $allowed-notcontains $destination){throw 'Staging restore failed path containment validation.'}
      Move-Item -LiteralPath $source -Destination $destination
    }
  }
  foreach($entry in $record.shortcuts){if((Test-Path -LiteralPath $entry.path)-and(Test-Path -LiteralPath $entry.backup)-and($entry.modifiedSha256-eq(FileHash $entry.path))){Copy-Item -LiteralPath $entry.backup -Destination $entry.path -Force}}
  if($record.startup){$run='HKCU:\Software\Microsoft\Windows\CurrentVersion\Run';$current=Get-ItemPropertyValue -LiteralPath $run -Name Spotify -ErrorAction SilentlyContinue;if($current-eq $record.startup.modified){Set-ItemProperty -LiteralPath $run -Name Spotify -Value $record.startup.original}}
  $record.enabled=$false;Write-Json $script:Protection $record
}
function Get-EnhancerStatus {
  $receipt=Read-Json $script:Receipt;$protection=Read-Json $script:Protection
  $version=if(Test-Path -LiteralPath $script:Exe){(Get-SpotifyVersion $script:Exe)}else{'Not installed'}
  $patched=$false;if($receipt-and(Test-Path -LiteralPath $script:UI)){$patched=(FileHash $script:UI)-eq $receipt.patchedSha256}
  $blocks=@();if($protection){foreach($entry in $protection.paths){$valid=(Test-Path -LiteralPath $entry.path -PathType Leaf)-and([IO.File]::ReadAllText($entry.path)-eq $script:BlockMarker);$blocks+=@{path=$entry.path;active=$valid}}}
  return [ordered]@{spotifyRoot=$script:SpotifyRoot;spotifyVersion=$version;supported=($version-eq $script:Builds.spotifyVersion);enhancerVersion=if($receipt){$receipt.enhancerVersion}else{$null};patched=$patched;updatesPinned=[bool]($protection-and $protection.enabled);stagingLocksIntact=[bool]($protection-and $protection.enabled-and @($blocks|Where-Object{-not $_.active}).Count-eq 0);blocks=$blocks;dataRoot=$script:DataRoot}
}
function Start-ProtectedSpotify {
  param([int]$DebugPort=0)
  $status=Get-EnhancerStatus
  if(-not $status.supported){throw "Detected Spotify $($status.spotifyVersion). Myify requires $($script:Builds.spotifyVersion)."}
  if($status.supported-and-not $status.patched){$null=Install-Enhancer -CloseSpotify}
  if($status.updatesPinned){
    $protection=Read-Json $script:Protection
    foreach($entry in $protection.paths){if(-not(Test-Path -LiteralPath $entry.path)){[IO.File]::WriteAllText($entry.path,$script:BlockMarker,[Text.UTF8Encoding]::new($false));[IO.File]::SetAttributes($entry.path,[IO.FileAttributes]::ReadOnly)}}
  }
  $arguments=@();if($status.updatesPinned){$arguments+=@('--update-endpoint-override=http://127.0.0.1:9/','--disable-update-restarts')}
  if($DebugPort-gt 0){$arguments+=@('--remote-debugging-port='+$DebugPort,'--remote-debugging-address=127.0.0.1')}
  $desktop=Join-Path $PSScriptRoot 'desktop\MyifyDesktop.exe'
  if(Test-Path -LiteralPath $desktop){Start-Process -FilePath $desktop -ArgumentList @('--hidden','--data-root',('"'+$script:DataRoot+'"')) -WindowStyle Hidden}
  if($arguments.Count){Start-Process -FilePath $script:Exe -ArgumentList $arguments -WindowStyle Hidden}else{Start-Process -FilePath $script:Exe -WindowStyle Hidden}
}
function Remove-Enhancer {
  param([switch]$CloseSpotify)
  Stop-DesktopTools
  Disable-UpdateProtection
  $receipt=Read-Json $script:Receipt
  if($receipt-and(Test-Path -LiteralPath $script:UI)-and(FileHash $script:UI)-eq $receipt.patchedSha256){
    if((FileHash $receipt.originalBackup)-ne $receipt.originalSha256){throw 'Original backup failed verification.'}
    if($CloseSpotify){Stop-Spotify}
    Copy-Item -LiteralPath $receipt.originalBackup -Destination $script:UI -Force
  }
}
function Get-BridgeConfiguration {
  $path=Join-Path $script:DataRoot 'bridge.json'
  $config=Read-Json $path
  if($config -and $config.token -match '^[a-f0-9]{64}$' -and $config.port -ge 1024 -and $config.port -le 65535){return $config}
  $bytes=New-Object byte[] 32;$rng=[Security.Cryptography.RandomNumberGenerator]::Create();try{$rng.GetBytes($bytes)}finally{$rng.Dispose()}
  $listener=[Net.Sockets.TcpListener]::new([Net.IPAddress]::Loopback,0);$listener.Start();try{$port=$listener.LocalEndpoint.Port}finally{$listener.Stop()}
  $config=[ordered]@{token=([BitConverter]::ToString($bytes)).Replace('-','').ToLowerInvariant();port=$port}
  Write-Json $path $config
  return $config
}
function Stop-DesktopTools {
  $config=Read-Json (Join-Path $script:DataRoot 'bridge.json')
  if(-not $config){return}
  try{$reply=Invoke-RestMethod -Uri ('http://127.0.0.1:'+$config.port+'/open') -Method Post -Headers @{Origin='https://xpui.app.spotify.com';Authorization=('Bearer '+$config.token)} -ContentType 'application/json' -Body '{"action":"quit"}' -TimeoutSec 2}catch{return}
  if($reply.pid){for($i=0;$i-lt 50;$i++){if(-not(Get-Process -Id ([int]$reply.pid) -ErrorAction SilentlyContinue)){return};Start-Sleep -Milliseconds 200};throw 'Myify desktop tools are still closing. Wait for the current task to stop and run setup again.'}else{Start-Sleep -Milliseconds 800}
}
Export-ModuleMember -Function Assert-Supported,Initialize-Enhancer,Install-Enhancer,Get-EnhancerStatus,Enable-UpdateProtection,Disable-UpdateProtection,Start-ProtectedSpotify,Remove-Enhancer,Stop-Spotify,Test-SpotifyContent,Get-BridgeConfiguration
