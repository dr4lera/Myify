[CmdletBinding()]
param([ValidateSet('Install','Repair','Launch','Manager','PinUpdates','EnableUpdates','Remove','Status','Check')][string]$Action='Manager',[switch]$CloseSpotify,[switch]$ProtectUpdates,[switch]$Quiet,[switch]$SkipShortcuts,[string]$SpotifyRoot,[string]$DataRoot,[string]$LocalSpotifyRoot,[int]$DebugPort=0,[string]$PreviewOutput,[string]$ErrorOutput)
$ErrorActionPreference='Stop'
Import-Module (Join-Path $PSScriptRoot 'Engine.psm1') -Force
function Show-Manager {
  Add-Type -AssemblyName System.Windows.Forms
  Add-Type -AssemblyName System.Drawing
  [Windows.Forms.Application]::EnableVisualStyles()
  $form=New-Object Windows.Forms.Form
  $form.Text='Myify';$form.ClientSize=[Drawing.Size]::new(640,440);$form.StartPosition='CenterScreen';$form.FormBorderStyle='FixedDialog';$form.MaximizeBox=$false;$form.BackColor=[Drawing.ColorTranslator]::FromHtml('#121212');$form.ForeColor=[Drawing.Color]::White;$form.Font=[Drawing.Font]::new('Segoe UI',10)
  $title=[Windows.Forms.Label]::new();$title.Text='Myify';$title.Font=[Drawing.Font]::new('Segoe UI',22,[Drawing.FontStyle]::Bold);$title.Location=[Drawing.Point]::new(28,24);$title.Size=[Drawing.Size]::new(580,46);$form.Controls.Add($title)
  $description=[Windows.Forms.Label]::new();$description.Text='Native lyrics, playback tools and custom themes';$description.ForeColor=[Drawing.Color]::Silver;$description.Location=[Drawing.Point]::new(30,78);$description.Size=[Drawing.Size]::new(560,28);$form.Controls.Add($description)
  $status=[Windows.Forms.Label]::new();$status.Location=[Drawing.Point]::new(30,124);$status.Size=[Drawing.Size]::new(575,104);$form.Controls.Add($status)
  $note=[Windows.Forms.Label]::new();$note.Location=[Drawing.Point]::new(30,340);$note.Size=[Drawing.Size]::new(575,70);$note.ForeColor=[Drawing.Color]::Silver;$note.Text='Version protection blocks known update staging paths and adds update-suppression flags to managed launches. You can allow updates at any time. Future Spotify builds need a compatible enhancement release.';$form.Controls.Add($note)
  $refresh={ $s=Get-EnhancerStatus;$status.Text="Spotify: $($s.spotifyVersion)`r`nEnhancements: $(if($s.patched){'Installed'}else{'Repair required'})`r`nAutomatic updates: $(if($s.updatesPinned){'Paused for this tested build'}else{'Allowed'})" }
  function Add-Button([string]$Text,[int]$X,[int]$Y,[int]$Width,[scriptblock]$Handler,[bool]$Primary=$false){$b=[Windows.Forms.Button]::new();$b.Text=$Text;$b.Location=[Drawing.Point]::new($X,$Y);$b.Size=[Drawing.Size]::new($Width,42);$b.FlatStyle='Flat';$b.FlatAppearance.BorderColor=[Drawing.Color]::DimGray;if($Primary){$b.BackColor=[Drawing.ColorTranslator]::FromHtml('#1ed760');$b.ForeColor=[Drawing.Color]::Black}else{$b.BackColor=[Drawing.ColorTranslator]::FromHtml('#282828')};$b.Add_Click({try{& $Handler;& $refresh}catch{[Windows.Forms.MessageBox]::Show($_.Exception.Message,'Myify','OK','Error')|Out-Null}}.GetNewClosure());$form.Controls.Add($b)}
  Add-Button 'Launch Spotify' 30 244 180 {Start-ProtectedSpotify} $true
  Add-Button 'Repair / update tools' 226 244 190 {$s=Get-EnhancerStatus;$null=Install-Enhancer -CloseSpotify -ProtectUpdates:$s.updatesPinned;Start-ProtectedSpotify}
  Add-Button 'Open backup folder' 432 244 175 {$s=Get-EnhancerStatus;Start-Process explorer.exe -ArgumentList $s.dataRoot -WindowStyle Hidden}
  Add-Button 'Pause Spotify updates' 30 296 278 {Enable-UpdateProtection}
  Add-Button 'Allow Spotify updates' 324 296 283 {Disable-UpdateProtection}
  & $refresh
  if($PreviewOutput){$form.ShowInTaskbar=$false;$form.Opacity=0;$form.Show();[Windows.Forms.Application]::DoEvents();$form.PerformLayout();$bitmap=[Drawing.Bitmap]::new($form.Width,$form.Height);try{$form.DrawToBitmap($bitmap,[Drawing.Rectangle]::new(0,0,$form.Width,$form.Height));$bitmap.Save($PreviewOutput,[Drawing.Imaging.ImageFormat]::Png)}finally{$bitmap.Dispose();$form.Close();$form.Dispose()};return}
  $form.Add_Shown({$form.Activate()});[void]$form.ShowDialog()
}
try{
  Initialize-Enhancer -SpotifyRoot $SpotifyRoot -DataRoot $DataRoot -LocalSpotifyRoot $LocalSpotifyRoot
  switch($Action){
    'Check' {$null=Assert-Supported;$null=Test-SpotifyContent (Join-Path (Get-EnhancerStatus).spotifyRoot 'Apps\xpui.spa') -AllowEnhancer;Write-Output 'Compatible Spotify installation verified.'}
    'Install' {Install-Enhancer -CloseSpotify:$CloseSpotify -ProtectUpdates:$ProtectUpdates -SkipShortcuts:$SkipShortcuts|ConvertTo-Json -Depth 6}
    'Repair' {$s=Get-EnhancerStatus;Install-Enhancer -CloseSpotify:$CloseSpotify -ProtectUpdates:$s.updatesPinned -SkipShortcuts:$SkipShortcuts|ConvertTo-Json -Depth 6}
    'Launch' {Start-ProtectedSpotify -DebugPort $DebugPort}
    'Manager' {Show-Manager}
    'PinUpdates' {Enable-UpdateProtection -SkipShortcuts:$SkipShortcuts;Get-EnhancerStatus|ConvertTo-Json -Depth 6}
    'EnableUpdates' {Disable-UpdateProtection;Get-EnhancerStatus|ConvertTo-Json -Depth 6}
    'Remove' {Remove-Enhancer -CloseSpotify:$CloseSpotify;Get-EnhancerStatus|ConvertTo-Json -Depth 6}
    'Status' {Get-EnhancerStatus|ConvertTo-Json -Depth 6}
  }
  exit 0
}catch{
  if($ErrorOutput){[IO.File]::WriteAllText($ErrorOutput,$_.Exception.Message,[Text.UTF8Encoding]::new($false))}
  $logRoot=if($DataRoot){$DataRoot}else{Join-Path $env:LOCALAPPDATA 'SpotifyNativeEnhancerData'}
  [IO.Directory]::CreateDirectory($logRoot)|Out-Null
  [IO.File]::AppendAllText((Join-Path $logRoot 'manager.log'),((Get-Date).ToString('o')+' '+$_.Exception.Message+"`r`n"))
  if(-not $Quiet){Add-Type -AssemblyName System.Windows.Forms;[Windows.Forms.MessageBox]::Show($_.Exception.Message,'Myify','OK','Error')|Out-Null}
  Write-Error $_.Exception.Message -ErrorAction Continue
  exit 1
}
