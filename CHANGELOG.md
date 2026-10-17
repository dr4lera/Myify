# Changelog

## 0.4.3 - Reliable launcher and taskbar instructions

- Install a native Myify.exe launcher and target it from Start, optional Desktop, and post-install launch controls.
- Show desktop tools on explicit launch and reuse their existing single instance. Keep Spotify's compatibility checks, repair and version-protection policy in the existing manager.
- Capture manager startup failures in launcher.log and show an error instead of silently disappearing.
- Migrate recognized old Myify launcher shortcuts and explain replacing a cached PowerShell taskbar pin.
- Package the launcher, tools and both English models in one installer asset; update setup, launch, pinning and troubleshooting instructions.
- Add native launcher fixture tests for Unicode/spaced paths, repeated launch and error handling.

## 0.4.2 - Backgrounds and fonts

- Apply uploaded fonts to playlist/navigation labels, preserve animated GIF backgrounds, handle images without MIME metadata, and retain image/font assets in theme and full-backup exports.

## 0.4.1 - Unified theme editor

- Replace the old color-only layout with one editor for colors, hex values, typography, lyric sizing and background images, alongside a live preview.
- Refresh every control when switching presets, importing or loading saved themes.
- Save/export the active appearance, including fonts and embedded backgrounds.
- Accept theme JSON files up to 2 MB so themes containing background images can be imported again.
- Retain existing saved themes, lyrics, loops, key bindings and disk recovery state.

## 0.4.0 - Combined desktop tools and offline lyrics

- Bundle local lyric generation, English base/small models, mini-player and local library in one installer.
- Add a Generate lyrics button that remembers audio mappings and attaches completed lyrics to the original song.
- Add an LRC/text timing editor, saved per-song loops, fonts/backgrounds, editable shortcuts with conflict checks, and richer backups.
- Add end-of-song/fade sleep modes, live compatibility information, read-only duplicate/missing-file reports and backed-up MP3/FLAC metadata/artwork editing.
- Preserve the installer ID, installation folder, Spotify resource backup and existing renderer storage during upgrade.
- Keep a timestamped desktop recovery copy and request a normal Spotify shutdown for upgrades, protecting recent lyric attachments from delayed browser-storage writes.
- Keep the integrated desktop source under GPL-2.0-or-later, with existing renderer/installer code MIT and separate upstream notices.

## 0.3.1 - Installer discovery and diagnostics

- Add a Spotify folder picker, common-path detection and silent `/SPOTIFYDIR` support.
- Remember the selected folder for manager launches and installer upgrades.
- Validate numeric executable versions and resource hashes in one engine.
- Report actual missing-file, unsupported-build and modified-resource errors.
- Verify fresh-profile install/uninstall and custom folders with spaces.

## 0.3.0 - Initial public Myify release

- Publish the Windows native integration as **Myify — Spotify local themes and lyrics tool**, with MIT source, documentation and downloadable installer.
- Import synchronized local LRC lyrics into the native renderer; manage lyrics and backup saved state.
- Fix Set B to resume paused playback, seek to A and start repeating immediately.
- Route local-file transport through the local collection; verify seeks and restore paused state/volume after decoder initialization.
- Add custom color themes, named saved themes and JSON import/export.
- Include bookmarks, seek controls and sleep timer.
- Add per-user installer/manager, verified backup/repair, reversible update protection and uninstall restoration.
- Preserve update protection policy if Spotify removes a staging marker; managed launches repair the marker and still apply suppression flags.
- Support standalone Windows Spotify 1.3.5.3058 only; refuse unknown builds and unrecognized resource modifications.
