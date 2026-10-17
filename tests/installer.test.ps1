param(
  [Parameter(Mandatory=$true)][string]$SpotifyExe,
  [Parameter(Mandatory=$true)][string]$OriginalArchive
)
$ErrorActionPreference='Stop'
$project=Split-Path -Parent $PSScriptRoot
$lab=Join-Path $project ('.test-lab\installer-lab-'+[Guid]::NewGuid().ToString('N'))
$spotify=Join-Path $lab 'Spotify';$local=Join-Path $lab 'LocalSpotify';$data=Join-Path $lab 'ManagerData'
New-Item -ItemType Directory -Path (Join-Path $spotify 'Apps'),$local -Force|Out-Null
Copy-Item -LiteralPath $SpotifyExe -Destination $spotify
$pristine=$OriginalArchive
Copy-Item -LiteralPath $pristine -Destination (Join-Path $spotify 'Apps\xpui.spa')
foreach($root in @($spotify,$local)){New-Item -ItemType Directory -Path (Join-Path $root 'Update')|Out-Null;[IO.File]::WriteAllText((Join-Path $root 'Update\pending.txt'),'Original staged update fixture')}
Import-Module (Join-Path $project 'installer\payload\Engine.psm1') -Force
Initialize-Enhancer -SpotifyRoot $spotify -DataRoot $data -LocalSpotifyRoot $local
$checks=[Collections.Generic.List[string]]::new()
function Check([bool]$Condition,[string]$Name){if(-not $Condition){throw "FAILED: $Name"};$checks.Add($Name);Write-Output "PASS: $Name"}
$status=Install-Enhancer -ProtectUpdates -SkipShortcuts
Check ($status.patched-and $status.updatesPinned) 'Install patches a pristine app and enables update protection'
$hash=(Get-FileHash (Join-Path $spotify 'Apps\xpui.spa')).Hash
foreach($root in @($spotify,$local)){
  $target=Join-Path $root 'Update';Check (Test-Path -LiteralPath $target -PathType Leaf) 'Update staging becomes a reversible read-only file lock'
  $blocked=$false;try{New-Item -ItemType Directory -Path (Join-Path $target 'probe') -ErrorAction Stop|Out-Null}catch{$blocked=$true};Check $blocked 'Known updater staging directory cannot be created'
}
$null=Install-Enhancer -ProtectUpdates -SkipShortcuts
Check ((Get-FileHash (Join-Path $spotify 'Apps\xpui.spa')).Hash-eq $hash) 'Repeated installation is idempotent'
$resetGuard=Join-Path $local 'Update';[IO.File]::SetAttributes($resetGuard,[IO.FileAttributes]::Normal);Remove-Item -LiteralPath $resetGuard
Check ((Get-EnhancerStatus).updatesPinned-and-not(Get-EnhancerStatus).stagingLocksIntact) 'Spotify clearing a staging lock does not disable the update-suppression policy'
Disable-UpdateProtection
Check (-not(Get-EnhancerStatus).updatesPinned) 'Allow updates clears the pin state'
foreach($root in @($spotify,$local)){Check ([IO.File]::ReadAllText((Join-Path $root 'Update\pending.txt'))-eq 'Original staged update fixture') 'Unpin restores pre-existing update staging without data loss'}
Enable-UpdateProtection -SkipShortcuts
Remove-Enhancer
Check (-not(Get-EnhancerStatus).patched) 'Uninstall restores the original Spotify resources'
Check (Test-SpotifyContent (Join-Path $spotify 'Apps\xpui.spa')) 'Restored resource contents match the original build manifest'
$zip=[IO.Compression.ZipFile]::Open((Join-Path $spotify 'Apps\xpui.spa'),[IO.Compression.ZipArchiveMode]::Update)
try{
  $entry=$zip.GetEntry('index.html');$reader=[IO.StreamReader]::new($entry.Open());try{$html=$reader.ReadToEnd()}finally{$reader.Dispose()};$entry.Delete()
  $entry=$zip.CreateEntry('index.html');$writer=[IO.StreamWriter]::new($entry.Open());try{$writer.Write($html.Replace('<script defer="defer" src="/xpui-snapshot.js"></script>','<script src="/local-enhancer.js"></script><script defer="defer" src="/xpui-snapshot.js"></script>'))}finally{$writer.Dispose()}
  $entry=$zip.CreateEntry('local-enhancer.js');$writer=[IO.StreamWriter]::new($entry.Open());try{$writer.Write('/* legacy fixture */')}finally{$writer.Dispose()}
}finally{$zip.Dispose()}
$legacy=Install-Enhancer -SkipShortcuts
Check $legacy.patched 'Existing v0.2 enhancement is migrated to the new manager'
$zip=[IO.Compression.ZipFile]::Open((Join-Path $spotify 'Apps\xpui.spa'),[IO.Compression.ZipArchiveMode]::Update)
try{$entry=$zip.CreateEntry('unknown-mod.js');$writer=[IO.StreamWriter]::new($entry.Open());try{$writer.Write('/* unknown */')}finally{$writer.Dispose()}}finally{$zip.Dispose()}
$beforeTamper=(Get-FileHash (Join-Path $spotify 'Apps\xpui.spa')).Hash;$rejected=$false;try{Install-Enhancer -SkipShortcuts|Out-Null}catch{$rejected=$true}
Check ($rejected-and (Get-FileHash (Join-Path $spotify 'Apps\xpui.spa')).Hash-eq $beforeTamper) 'Unknown modifications are rejected without overwriting the app'
$fixtureExe=Join-Path $spotify 'Spotify.exe';Move-Item -LiteralPath $fixtureExe -Destination ($fixtureExe+'.supported')
Copy-Item -LiteralPath (Join-Path $env:WINDIR 'System32\cmd.exe') -Destination $fixtureExe
$unsupported=$false;try{Install-Enhancer -SkipShortcuts|Out-Null}catch{$unsupported=$true}
Check ($unsupported-and (Get-FileHash (Join-Path $spotify 'Apps\xpui.spa')).Hash-eq $beforeTamper) 'Unknown future app versions are rejected without applying old hooks'
Remove-Item -LiteralPath $fixtureExe;Move-Item -LiteralPath ($fixtureExe+'.supported') -Destination $fixtureExe
$result=@{passed=$true;checks=$checks;isolatedLab=$lab;realSpotifyChanged=$false}
$result|ConvertTo-Json -Depth 5|Set-Content -LiteralPath (Join-Path $lab 'installer-tests.json') -Encoding utf8
