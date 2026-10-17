# Compatibility, update protection and recovery

## Supported platform

Release 0.3.0 supports Windows x64-compatible standalone desktop Spotify **1.3.5.3058**, installed at `%APPDATA%\Spotify`. It uses Windows PowerShell 5.1, Windows Forms and built-in .NET compression. End users do not need Node, Spicetify or Inno Setup. The Store package, other Spotify builds, macOS and Linux are unsupported.

The compatibility manifest records original resource-entry SHA-256 hashes and the tested executable version. Installation verifies the contents, backs up the original resource archive, adds Myify's loader and a bootstrap script reference, and writes a receipt. Unknown modifications and unsupported builds are refused. Previously installed versions of this same enhancement are recognized. This is not a promise of compatibility across Spotify updates.

## Reversible update protection

The installer defaults to keeping the tested build. Its manager blocks the known roaming/local Spotify `Update` staging paths using read-only marker files, backs up existing staging data, and adds these launch flags to the managed launcher, recognized Spotify shortcuts and the user's existing Spotify startup entry:

```
--update-endpoint-override=http://127.0.0.1:9/ --disable-update-restarts
```

Original staging data, shortcut contents and startup value are recorded for restoration. Myify does not edit hosts or firewall rules, disable Windows Update, install a service or schedule a background job. Protection is local to this Spotify installation and user.

Spotify may remove a staging marker. The saved protection policy remains enabled and managed launches recreate missing markers and apply the flags. Use **Spotify (Myify)** for checking and repair. Manual reinstalls, other launch routes and changed updater behavior can bypass protection. Updates can contain security fixes; choose **Allow Spotify updates** when you want to update, then use a compatible Myify release if one becomes available.

## Troubleshooting

| Symptom | Action |
| --- | --- |
| Unsupported build | Do not bypass the check or edit the version number. Allow normal Spotify updates/use Spotify normally until a release supports your build. |
| Unknown modified resources | Restore the other customization's backup or use a clean Spotify installation. Myify does not merge arbitrary patches. |
| Tools absent on the supported build | Close Spotify and use the manager's Repair button. Inspect `manager.log` in the data directory if it fails. |
| Local file controls fail | Confirm the file plays in Spotify, is available locally and is selected on this computer. Reopen its Local Files entry and retry. |
| Loop does not start | Set A, choose a position at least 500 ms later, then Set B. Check the status for Spotify transport errors. |
| Lyrics absent | Play the item used for import, use timed UTF-8 LRC, and choose Open lyrics. Metadata changes may have changed a local URI. |
| Timing wrong | Adjust Delay (ms); positive delays show lines later. |
| Theme import rejected | Use a Myify/exported legacy theme with version 1 and seven valid hex color fields. |
| Download confusion | Download `Myify-Setup-0.3.0.exe` under release Assets, not GitHub's source-code ZIP. |

## Recovery and diagnostics

Backups, installation receipts, update protection records and `manager.log` are in `%LOCALAPPDATA%\SpotifyNativeEnhancerData`. Do not delete this folder before uninstalling if you need restoration. Keep an exported data backup before reinstalling Spotify.

The manager's `-Action Status` is read-only. Example:

```powershell
powershell.exe -NoProfile -File "$env:LOCALAPPDATA\SpotifyNativeEnhancer\Manager.ps1" -Action Status
```

If Spotify updated independently, the uninstaller avoids replacing its new UI with the old backup. Use a normal clean Spotify installation to recover from an unrelated modification. Logs and receipts may contain local paths; redact them before opening a public issue. Never upload Spotify archives, account data, exported lyric libraries, credentials or recovered proprietary source.
