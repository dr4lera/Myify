Myify 0.3.1 fixes installer discovery and misleading version errors.

**Download Myify-Setup-0.3.1.exe under Assets below.** Replace the previous 0.3.0 installer. Source ZIP files are not the installer.

- New **Locate Spotify** folder picker. Select the folder containing `Spotify.exe` and `Apps\xpui.spa`, including custom standalone locations.
- Numeric executable-version validation and strict original-resource hashes remain enforced. Only Spotify **1.3.5.3058** is supported; Store packages are not.
- Setup now displays the actual error and detected path/version. A matching About version no longer gets rejected solely because Spotify is outside the old fixed folder.
- The selected folder is remembered for manager launches and future upgrades. Silent setup accepts `/SPOTIFYDIR="C:\path\to\Spotify"`.

Includes local LRC lyrics, themes, A–B looping, bookmarks, sleep timer, backup/repair and reversible update protection. Normal Spotify sign-in/account requirements apply. MIT source and full docs are in the repository; no Spotify binaries or recovered source are included.

The installer is unsigned. Compare `Get-FileHash .\Myify-Setup-0.3.1.exe -Algorithm SHA256` with the attached SHA256SUMS.
