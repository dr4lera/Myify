#define AppVersion "0.4.0"
[Setup]
AppId={{1C840779-AD93-40D8-9679-EA7560E26881}
AppName=Myify
AppVersion={#AppVersion}
AppPublisher=Myify contributors
AppPublisherURL=https://github.com/dr4lera/Myify
AppSupportURL=https://github.com/dr4lera/Myify/issues
AppUpdatesURL=https://github.com/dr4lera/Myify/releases
DefaultDirName={localappdata}\SpotifyNativeEnhancer
DefaultGroupName=Myify
PrivilegesRequired=lowest
ArchitecturesAllowed=x64compatible
ArchitecturesInstallIn64BitMode=x64compatible
DisableDirPage=yes
DisableProgramGroupPage=yes
OutputDir=..\dist
OutputBaseFilename=Myify-Setup-{#AppVersion}
Compression=lzma2/fast
SolidCompression=yes
WizardStyle=modern
UninstallDisplayName=Myify
UninstallDisplayIcon={code:GetSpotifyExe}
CloseApplications=no
SetupLogging=yes
InfoBeforeFile=Installer-info.txt

[Tasks]
Name: pinupdates; Description: "Keep this tested Spotify version (reversible in the manager)"; Flags: checkedonce
Name: desktopicon; Description: "Create a protected Spotify shortcut on the desktop"; Flags: unchecked

[Files]
Source: "payload\Engine.psm1"; DestDir: "{app}"; Flags: ignoreversion
Source: "payload\Manager.ps1"; DestDir: "{app}"; Flags: ignoreversion
Source: "payload\native-loader.js"; DestDir: "{app}"; Flags: ignoreversion
Source: "payload\supported-build.json"; DestDir: "{app}"; Flags: ignoreversion
Source: "payload\README.txt"; DestDir: "{app}"; Flags: ignoreversion

Source: "payload\LICENSE"; DestDir: "{app}"; Flags: ignoreversion
Source: "payload\desktop\*"; DestDir: "{app}\desktop"; Flags: ignoreversion recursesubdirs createallsubdirs

[Icons]
Name: "{group}\Myify desktop tools"; Filename: "{app}\desktop\MyifyDesktop.exe"; WorkingDir: "{app}\desktop"
Name: "{group}\Spotify (Myify)"; Filename: "{sys}\WindowsPowerShell\v1.0\powershell.exe"; Parameters: "-NoProfile -WindowStyle Hidden -ExecutionPolicy Bypass -File ""{app}\Manager.ps1"" -Action Launch"; IconFilename: "{code:GetSpotifyExe}"; WorkingDir: "{app}"
Name: "{group}\Myify settings and updates"; Filename: "{sys}\WindowsPowerShell\v1.0\powershell.exe"; Parameters: "-NoProfile -WindowStyle Hidden -ExecutionPolicy Bypass -File ""{app}\Manager.ps1"" -Action Manager"; IconFilename: "{code:GetSpotifyExe}"; WorkingDir: "{app}"
Name: "{autodesktop}\Spotify (Myify)"; Filename: "{sys}\WindowsPowerShell\v1.0\powershell.exe"; Parameters: "-NoProfile -WindowStyle Hidden -ExecutionPolicy Bypass -File ""{app}\Manager.ps1"" -Action Launch"; IconFilename: "{code:GetSpotifyExe}"; WorkingDir: "{app}"; Tasks: desktopicon

[Run]
Filename: "{sys}\WindowsPowerShell\v1.0\powershell.exe"; Parameters: "-NoProfile -WindowStyle Hidden -ExecutionPolicy Bypass -File ""{app}\Manager.ps1"" -Action Launch"; Description: "Open enhanced Spotify"; Flags: postinstall nowait skipifsilent runhidden

[UninstallRun]
Filename: "{sys}\WindowsPowerShell\v1.0\powershell.exe"; Parameters: "-NoProfile -ExecutionPolicy Bypass -File ""{app}\Manager.ps1"" -Action Remove -CloseSpotify -Quiet"; Flags: runhidden waituntilterminated skipifdoesntexist; RunOnceId: "RestoreSpotifyAndUpdates"

[Code]
var SpotifyPage: TInputDirWizardPage;

function SpotifyDirectory(): String;
begin
  if Assigned(SpotifyPage) then Result := SpotifyPage.Values[0]
  else Result := ExpandConstant('{userappdata}\Spotify');
end;

function GetSpotifyExe(Param: String): String;
begin
  Result := AddBackslash(SpotifyDirectory()) + 'Spotify.exe';
end;

procedure InitializeWizard();
var Candidate: String;
begin
  SpotifyPage := CreateInputDirPage(wpWelcome, 'Locate Spotify',
    'Select your existing standalone Spotify installation',
    'Choose the folder containing Spotify.exe and Apps\xpui.spa. Myify verifies the actual build and resources before changing anything. Microsoft Store packages are not supported.', False, '');
  SpotifyPage.Add('Spotify installation folder:');
  Candidate := ExpandConstant('{userappdata}\Spotify');
  if not FileExists(AddBackslash(Candidate) + 'Spotify.exe') then Candidate := ExpandConstant('{localappdata}\Spotify');
  if not FileExists(AddBackslash(Candidate) + 'Spotify.exe') then Candidate := ExpandConstant('{localappdata}\Programs\Spotify');
  if not FileExists(AddBackslash(Candidate) + 'Spotify.exe') then Candidate := ExpandConstant('{autopf}\Spotify');
  if not FileExists(AddBackslash(Candidate) + 'Spotify.exe') then Candidate := ExpandConstant('{userappdata}\Spotify');
  Candidate := GetPreviousData('SpotifyRoot', Candidate);
  SpotifyPage.Values[0] := ExpandConstant('{param:SPOTIFYDIR|' + Candidate + '}');
end;

function PrepareToInstall(var NeedsRestart: Boolean): String;
var Arguments, ErrorFile: String; Detail: AnsiString; ExitCode: Integer;
begin
  Result := '';
  ExtractTemporaryFile('Engine.psm1');
  ExtractTemporaryFile('Manager.ps1');
  ExtractTemporaryFile('native-loader.js');
  ExtractTemporaryFile('supported-build.json');
  ErrorFile := ExpandConstant('{tmp}\myify-install-error.txt');
  Arguments := '-NoProfile -ExecutionPolicy Bypass -File "' + ExpandConstant('{tmp}\Manager.ps1') + '" -Action Install -CloseSpotify -Quiet -SpotifyRoot "' + SpotifyDirectory() + '" -ErrorOutput "' + ErrorFile + '"';
  if WizardIsTaskSelected('pinupdates') then Arguments := Arguments + ' -ProtectUpdates';
  if (not Exec(ExpandConstant('{sys}\WindowsPowerShell\v1.0\powershell.exe'), Arguments, '', SW_HIDE, ewWaitUntilTerminated, ExitCode)) or (ExitCode <> 0) then
  begin
    if LoadStringFromFile(ErrorFile, Detail) then Result := UTF8Decode(Detail)
    else Result := 'Installation failed. Check %LOCALAPPDATA%\SpotifyNativeEnhancerData\manager.log. No successful installation was reported.';
  end;
end;

procedure RegisterPreviousData(PreviousDataKey: Integer);
begin
  SetPreviousData(PreviousDataKey, 'SpotifyRoot', SpotifyDirectory());
end;
