# Changelog

## 0.3.1 — Initial public Myify release

- Publish the Windows native integration as **Myify — Spotify local themes and lyrics tool**, with MIT source, documentation and downloadable installer.
- Import synchronized local LRC lyrics into the native renderer; manage lyrics and backup saved state.
- Fix Set B to resume paused playback, seek to A and start repeating immediately.
- Route local-file transport through the local collection; verify seeks and restore paused state/volume after decoder initialization.
- Add custom color themes, named saved themes and JSON import/export.
- Include bookmarks, seek controls and sleep timer.
- Add per-user installer/manager, verified backup/repair, reversible update protection and uninstall restoration.
- Preserve update protection policy if Spotify removes a staging marker; managed launches repair the marker and still apply suppression flags.
- Support standalone Windows Spotify 1.3.5.3058 only; refuse unknown builds and unrecognized resource modifications.
