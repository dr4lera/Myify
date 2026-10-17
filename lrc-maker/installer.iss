[Setup]
AppId={{E1725141-8CC4-460D-9F05-F56E2A34B48C}
AppName=Myify LRC Maker
AppVersion=1.0.1
AppPublisher=Myify contributors
DefaultDirName={localappdata}\Programs\MyifyLRC
DefaultGroupName=Myify LRC Maker
PrivilegesRequired=lowest
ArchitecturesAllowed=x64compatible
ArchitecturesInstallIn64BitMode=x64compatible
OutputDir=release
OutputBaseFilename=MyifyLRC-Setup-1.0.1
Compression=lzma2/fast
SolidCompression=yes
WizardStyle=modern
UninstallDisplayIcon={app}\MyifyLRC.exe
CloseApplications=yes
LicenseFile=LICENSE
[Files]
Source: "dist\MyifyLRC\*"; DestDir: "{app}"; Flags: ignoreversion recursesubdirs createallsubdirs
Source: "README.md"; DestDir: "{app}"; Flags: ignoreversion
Source: "LICENSE"; DestDir: "{app}"; Flags: ignoreversion
Source: "THIRD-PARTY-NOTICES.txt"; DestDir: "{app}"; Flags: ignoreversion
Source: "third-party-licenses\*"; DestDir: "{app}\third-party-licenses"; Flags: ignoreversion recursesubdirs createallsubdirs
[Icons]
Name: "{group}\Myify LRC Maker"; Filename: "{app}\MyifyLRC.exe"
Name: "{group}\Uninstall Myify LRC Maker"; Filename: "{uninstallexe}"
[Run]
Filename: "{app}\MyifyLRC.exe"; Description: "Open Myify LRC Maker"; Flags: nowait postinstall skipifsilent
