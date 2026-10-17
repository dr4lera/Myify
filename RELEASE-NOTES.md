# Myify 0.4.3 — launcher and taskbar fix

Download **Myify-Setup-0.4.3.exe** from Assets. This is the only installer/download required; it includes the launcher, desktop tools and both offline English lyric models. Run it over the existing installation. Saved lyrics, themes, mappings and original Spotify backups are preserved.

- Setup creates a clearly named **Spotify (Myify)** desktop shortcut by default. Double-click it to open Spotify and Myify tools. The Start menu entry also targets the installed **Myify.exe**.
- Fix the first-run `FileNotFoundError` when opening **MyifyDesktop** directly from Explorer or a taskbar pin without an existing data folder / bridge.json. It now creates its own configuration and preserves an existing installation's connection secret.
- Direct desktop startup uses one process, including repeated clicks while it is starting. Setup also closes stale helper processes before replacing its executable.
- Explicit startup opens Spotify and shows Myify desktop tools. Repeated startup brings up the existing tools.
- Startup failures display an error and capture manager output in `%LOCALAPPDATA%\SpotifyNativeEnhancerData\launcher.log`.
- Setup updates recognized older Myify launcher shortcuts. Replace any old taskbar pin with **Spotify (Myify)** from Start (**More → Pin to taskbar**) or pin `%LOCALAPPDATA%\SpotifyNativeEnhancer\Myify.exe`. Pinning the normally running Spotify icon skips the tools launcher.
- Includes the previous release's backgrounds, uploaded fonts, unified theme editor, local lyric generation/editor, mini-player, loops, library tools and backup support.

Standalone Windows Spotify **1.3.5.3058** is required. Normal Spotify sign-in and account requirements apply. The installer is unsigned. The published release description includes its SHA-256 checksum; there is no extra launcher installer, companion archive or custom source-ZIP asset.

Validation: 19 JavaScript tests, 15 desktop tests, 22 installer install/repair/restore checks, native launcher fixtures (Unicode/spaced paths, repeated launch, missing files, manager failures and stale forwarding-process cleanup), and the packaged desktop self-test with both models. Direct empty-profile startup and repeated launcher startup are checked against the packaged executable before publication. Taskbar pinning itself was not automated.

SHA-256 for the single installer asset:

```text
d909e3e7cde845175b081cda849be83fe5b41492ff583468afa41a5e1d1d2de3  Myify-Setup-0.4.3.exe
```

[Launch and pinning instructions](https://github.com/dr4lera/Myify/blob/main/docs/USER-GUIDE.md#launching-and-pinning-myify)
