# Changelog

## 0.4.0 - Combined desktop tools and offline lyrics

- Bundle local lyric generation, English base/small models, mini-player and local library in one installer.
- Add a Generate lyrics button that remembers audio mappings and attaches completed lyrics to the original song.
- Add an LRC/text timing editor, saved per-song loops, fonts/backgrounds, editable shortcuts with conflict checks, and richer backups.
- Add end-of-song/fade sleep modes, live compatibility information, read-only duplicate/missing-file reports and backed-up MP3/FLAC metadata/artwork editing.
- Preserve the installer ID, installation folder, Spotify resource backup and existing renderer storage during upgrade.
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
