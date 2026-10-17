# Myify

**Spotify local themes and lyrics tool for Windows.** Import synchronized `.lrc` lyrics, customize colors, and use playback tools inside your existing Spotify desktop app.

[Download the Windows installer](https://github.com/dr4lera/Myify/releases/latest) · [User guide](docs/USER-GUIDE.md) · [Build from source](docs/DEVELOPMENT.md) · [Compatibility and updates](docs/COMPATIBILITY.md)

## Install

1. Open **[Releases](https://github.com/dr4lera/Myify/releases)** and download **Myify-Setup-0.3.0.exe** from **Assets**. GitHub's source ZIP is source code, not the installer.
2. You need the standalone Windows desktop Spotify **1.3.5.3058** already installed under `%APPDATA%\Spotify`. Other builds and the Microsoft Store distribution are not supported by this release.
3. Run the installer. Spotify closes while the verified patch is installed. Launch **Spotify (Myify)** from the **Myify** Start menu group.
4. Click the sliders beside Spotify's lyrics control, or open Spotify Settings and find **Myify**.

The installer is unsigned. It contains Myify scripts and compatibility hashes, not Spotify, songs, credentials, or decompiled source. Spotify sign-in and normal account requirements still apply. Myify does not unlock Premium or bypass content access.

## Features

- Import UTF-8 timed `.lrc` files for local songs, streamed songs, and episodes; view them in Spotify's native lyrics renderer. Adjust synchronization and manage/export your lyric library.
- A–B repeat that starts immediately on **Set B**, including from pause; seek controls, timestamp bookmarks with notes, and a sleep timer.
- Custom themes with seven color fields, named presets, saved themes, and JSON import/export.
- Export/import lyrics, bookmarks, and theme settings together as a backup.
- Windows installer, manager, verified original-resource backup, repair launcher, and reversible uninstall.
- Optional reversible protection for the tested Spotify version. Unknown builds are refused rather than patched with untested hooks.

Playback tools use Spotify's own transport. They work with local files, music, and podcasts when the item supports seeking; ads, unavailable content, remote devices, and restricted playback are not guaranteed. Chapter URIs are accepted but were not separately runtime-tested.

## Documentation

- [Lyrics, themes, looping, bookmarks, backup and uninstall](docs/USER-GUIDE.md)
- [Supported build, update protection, recovery and troubleshooting](docs/COMPATIBILITY.md)
- [Architecture, development, tests and release builds](docs/DEVELOPMENT.md)
- [Contributing](CONTRIBUTING.md), [security and privacy](SECURITY.md), [changelog](CHANGELOG.md)

## License

Myify's source is [MIT licensed](LICENSE). Spotify and its assets remain the property of their respective owners and are not included or covered by this license. This is an independent project and is not affiliated with Spotify.
