# Myify 0.4.3 — launcher and taskbar fix

Download **Myify-Setup-0.4.3.exe** from Assets. This is the only installer/download required; it includes the launcher, desktop tools and both offline English lyric models. Run it over the existing installation. Saved lyrics, themes, mappings and original Spotify backups are preserved.

- **Start → Myify → Spotify (Myify)** now targets a regular installed **Myify.exe**, instead of a hidden PowerShell command.
- Explicit startup opens Spotify and shows Myify desktop tools. Repeated startup brings up the existing tools.
- Startup failures display an error and capture manager output in `%LOCALAPPDATA%\SpotifyNativeEnhancerData\launcher.log`.
- Setup updates recognized older Myify launcher shortcuts. Replace any old taskbar pin with **Spotify (Myify)** from Start (**More → Pin to taskbar**) or pin `%LOCALAPPDATA%\SpotifyNativeEnhancer\Myify.exe`. Pinning the normally running Spotify icon skips the tools launcher.
- Includes the previous release's backgrounds, uploaded fonts, unified theme editor, local lyric generation/editor, mini-player, loops, library tools and backup support.

Standalone Windows Spotify **1.3.5.3058** is required. Normal Spotify sign-in and account requirements apply. The installer is unsigned. The published release description includes its SHA-256 checksum; there is no extra launcher installer, companion archive or custom source-ZIP asset.

Validation: 19 JavaScript tests, 8 desktop tests, 22 installer install/repair/restore checks, native launcher fixtures (Unicode/spaced paths, repeated launch, missing files and manager failures), and the packaged desktop self-test with both models. A real upgrade completed successfully; the installed shortcut opened a visible Myify window, and a second launch retained the same desktop-tools listener/process. Taskbar pinning itself was not automated.

SHA-256 for the single installer asset:

```text
18995f647d77a3a41c50d98306a216757238ba9919df3d5d2e362871dd7ecfa8  Myify-Setup-0.4.3.exe
```

[Launch and pinning instructions](https://github.com/dr4lera/Myify/blob/main/docs/USER-GUIDE.md#launching-and-pinning-myify)
