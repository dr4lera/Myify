# Myify

**Spotify local themes and lyrics tool for Windows.** Edit and generate synchronized `.lrc` lyrics, customize appearance, and use playback tools inside your existing Spotify app. Version 0.4 combines offline lyric generation and desktop tools in one installer; both English models are included.

[Download the Windows installer](https://github.com/dr4lera/Myify/releases/latest) · [User guide](docs/USER-GUIDE.md) · [Build from source](docs/DEVELOPMENT.md) · [Compatibility and updates](docs/COMPATIBILITY.md)

## Install

1. Open **[Releases](https://github.com/dr4lera/Myify/releases)** and download **Myify-Setup-0.4.3.exe** from **Assets**. GitHub's source ZIP is source code, not the installer. Run it over an existing Myify installation to upgrade.
2. You need the standalone Windows desktop Spotify **1.3.5.3058** already installed. Other builds and the Microsoft Store distribution are not supported by this release.
3. Run the installer and confirm the folder containing your `Spotify.exe` and `Apps\xpui.spa`. Common standalone locations are detected; browse to a custom folder if needed. Spotify closes while the verified patch is installed. Launch **Spotify (Myify)** from the **Myify** Start menu group.
4. Click the sliders beside Spotify's lyrics control, or open Spotify Settings and find **Myify**.

Version 0.4.3 installs a regular **Myify.exe** launcher. **Start → Myify → Spotify (Myify)** opens Spotify and brings up Myify desktop tools; launching it again opens the existing tools. To pin it, right-click **Spotify (Myify)** in Start and choose **More → Pin to taskbar**, or open `%LOCALAPPDATA%\SpotifyNativeEnhancer` in File Explorer and pin **Myify.exe**. Replace any old PowerShell-based Myify pin. Pinning the normally running Spotify icon starts Spotify directly and does not run Myify's tools launcher.

Download only **Myify-Setup-0.4.3.exe** from the release's Assets. It contains the launcher, desktop tools and both English models. There is no separate launcher installer or required source ZIP. Existing lyrics, themes and backups are preserved during upgrade. If startup fails, Myify displays an error and captures details in `%LOCALAPPDATA%\SpotifyNativeEnhancerData\launcher.log`.

To open only the desktop tools, use **Start → Myify → Myify desktop tools**. That entry can also be pinned. Direct tools startup creates a missing data folder and connection configuration automatically; you do not need to locate or create those folders by hand. Spotify playback controls connect after launching Spotify with the combined Myify launcher.

The installer is unsigned. It contains Myify scripts and compatibility hashes, not Spotify, songs, credentials, or decompiled source. Spotify sign-in and normal account requirements still apply. Myify does not unlock Premium or bypass content access.

## Features

- **Unified theme editor** with live preview, hex colors, uploaded custom fonts, JPG/PNG/WebP and animated GIF backgrounds and complete theme save/import/export. See the [theme guide](docs/COMBINED-TOOLS.md#themes-and-shortcuts).

- **Generate lyrics** button for the current local song, with bundled offline models and automatic attachment. No separate LRC Maker install.
- Timestamp editor, per-song named loops, background images/fonts, synchronized always-on-top mini-player, configurable keyboard bindings, local file scanning and MP3/FLAC metadata/artwork editing.
- End-of-song and fade-out sleep modes, compatibility display, and expanded settings backups. See the [combined tools guide](docs/COMBINED-TOOLS.md) for supported formats, upgrade behavior and usage.

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

Renderer integration and installer scripts are MIT. The integrated desktop component is GPL-2.0-or-later; see [desktop/LICENSE](desktop/LICENSE) and [third-party notices](desktop/THIRD-PARTY-NOTICES.txt). Models and packaged libraries retain their upstream licenses.

See [LICENSE](LICENSE) and the desktop license above. Spotify and its assets remain the property of their respective owners and are not included or covered by these licenses. This is an independent project and is not affiliated with Spotify.

## Local LRC generator

Myify 0.4 includes lyric generation directly. The older [standalone LRC Maker](lrc-maker/README.md) remains available for people who do not use Spotify/Myify. It is not required by the combined installer. Automatic recognition needs review, especially on rap and layered vocals.
