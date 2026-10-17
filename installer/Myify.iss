#define AppVersion "0.3.0"
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
Compression=lzma2
SolidCompression=yes
WizardStyle=modern
UninstallDisplayName=Myify
UninstallDisplayIcon={userappdata}\Spotify\Spotify.exe
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

[Icons]
Name: "{group}\Spotify (Myify)"; Filename: "{sys}\WindowsPowerShell\v1.0\powershell.exe"; Parameters: "-NoProfile -WindowStyle Hidden -ExecutionPolicy Bypass -File ""{app}\Manager.ps1"" -Action Launch"; IconFilename: "{userappdata}\Spotify\Spotify.exe"; WorkingDir: "{app}"
Name: "{group}\Myify settings and updates"; Filename: "{sys}\WindowsPowerShell\v1.0\powershell.exe"; Parameters: "-NoProfile -WindowStyle Hidden -ExecutionPolicy Bypass -File ""{app}\Manager.ps1"" -Action Manager"; IconFilename: "{userappdata}\Spotify\Spotify.exe"; WorkingDir: "{app}"
Name: "{autodesktop}\Spotify (Myify)"; Filename: "{sys}\WindowsPowerShell\v1.0\powershell.exe"; Parameters: "-NoProfile -WindowStyle Hidden -ExecutionPolicy Bypass -File ""{app}\Manager.ps1"" -Action Launch"; IconFilename: "{userappdata}\Spotify\Spotify.exe"; WorkingDir: "{app}"; Tasks: desktopicon

[Run]
Filename: "{sys}\WindowsPowerShell\v1.0\powershell.exe"; Parameters: "-NoProfile -WindowStyle Hidden -ExecutionPolicy Bypass -File ""{app}\Manager.ps1"" -Action Launch"; Description: "Open enhanced Spotify"; Flags: postinstall nowait skipifsilent runhidden

[UninstallRun]
Filename: "{sys}\WindowsPowerShell\v1.0\powershell.exe"; Parameters: "-NoProfile -ExecutionPolicy Bypass -File ""{app}\Manager.ps1"" -Action Remove -CloseSpotify -Quiet"; Flags: runhidden waituntilterminated skipifdoesntexist; RunOnceId: "RestoreSpotifyAndUpdates"

[Code]
function InitializeSetup(): Boolean;
var Version: String;
begin
  Result := GetVersionNumbersString(ExpandConstant('{userappdata}\Spotify\Spotify.exe'), Version);
  if (not Result) or (Version <> '1.3.5.3058') then
  begin
    if not WizardSilent then MsgBox('This release supports the desktop Spotify build 1.3.5.3058. Spotify was not changed.', mbError, MB_OK);
    Result := False;
  end;
end;

function PrepareToInstall(var NeedsRestart: Boolean): String;
var Arguments: String; ExitCode: Integer;
begin
  Result := '';
  ExtractTemporaryFile('Engine.psm1');
  ExtractTemporaryFile('Manager.ps1');
  ExtractTemporaryFile('native-loader.js');
  ExtractTemporaryFile('supported-build.json');
  Arguments := '-NoProfile -ExecutionPolicy Bypass -File "' + ExpandConstant('{tmp}\Manager.ps1') + '" -Action Install -CloseSpotify -Quiet';
  if WizardIsTaskSelected('pinupdates') then Arguments := Arguments + ' -ProtectUpdates';
  if (not Exec(ExpandConstant('{sys}\WindowsPowerShell\v1.0\powershell.exe'), Arguments, '', SW_HIDE, ewWaitUntilTerminated, ExitCode)) or (ExitCode <> 0) then
    Result := 'Enhancement installation did not complete. Spotify has a verified backup. Details: %LOCALAPPDATA%\SpotifyNativeEnhancerData\manager.log';
end;
