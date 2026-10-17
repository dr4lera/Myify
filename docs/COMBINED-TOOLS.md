# Myify 0.4 combined tools

One installer includes the Spotify enhancements, desktop tools, local transcription runtime, and English `base.en` / `small.en` models. A separate LRC Maker installation is unnecessary. Spotify sign-in and account requirements continue to apply.

## Upgrade

Run the single `Myify-Setup-0.4.3.exe` over the existing Myify installation. It retains the previous Windows installer identity, installation location, original-resource backup, update-protection preferences, Spotify installation receipt, and renderer storage key. Spotify closes during installation. Desktop transcription work stops; completed LRC files remain saved. Launch **Start → Myify → Spotify (Myify)** afterward: the installed `Myify.exe` starts Spotify and opens the existing desktop tools. Pin that launcher rather than a normally opened Spotify icon. See [launch and pinning](USER-GUIDE.md#launching-and-pinning-myify); no separate launcher download is needed.

Old lyrics, bookmarks, offsets, themes and saved theme names are loaded using the same storage schema. New keyboard settings receive defaults automatically. Export a backup from Myify Settings before clearing Spotify's browser data. Myify uninstall restores the original supported Spotify resources and preserves user data.

An older standalone **Myify LRC Maker** installation is not removed automatically. Its files and exports remain available; it is no longer required by this version.

## Generate lyrics

Play a **local song**, open Myify's sliders button, and click **Generate lyrics**. The bundled English base model is the default. Myify first checks remembered mappings, configured library folders and your Music folder, including filenames with track numbers. It checks duration and artist metadata; byte-identical copies can share a match. If no reliable match exists, select the audio file once. The mapping is remembered. Requests generate lyrics in the background and attach the completed result to the original song, even if playback changes. Progress appears in playback tools. Audio is processed locally.

Myify does not download or transcribe Spotify streams. Advanced model/language selection, batch transcription, editable output, cancellation and output-folder controls are under **Start menu → Myify → Myify desktop tools → Lyrics generator**. `small.en` is also included; optional multilingual models require an initial download. Both English models work offline immediately. Generated files are kept under `%LOCALAPPDATA%\SpotifyNativeEnhancerData\lyrics` without overwriting existing files. Speech recognition can invent or miss words; review the result.

## Lyrics editor

Choose **Lyrics editor** in playback tools or Settings. Import `.lrc` / plain text, or paste one lyric line per row and click **Load pasted lines**. Click **Timestamp next** as you listen; its shortcut also works inside the editor. You can edit individual timestamps in seconds, stamp any selected line, remove lines, restart from line one, or shift every timestamp by milliseconds. **Save corrections** updates the attachment; **Export .lrc** saves a portable file. All lines must have valid timestamps before saving. Song changes do not redirect an open editor to a different attachment.

## Saved loops and sleep

Set A and B, then use **Settings → Saved A/B loops → Save current loop** to name a section. Multiple sections are stored for each song. Open Settings while that song is selected to replay or remove them. Active loops stop on song changes or Spotify exit; named loops survive restarts and backups.

The sleep controls offer a normal timer, **Stop after song**, and **Fade timer**. Fade uses the final 30 seconds, pauses playback, and restores the original volume for the next session. Cancellation restores volume too. Fade requires the normal Spotify volume controls to be available. End-of-song mode disables looping and pauses just before the track boundary; a song change also pauses playback. Precision depends on Spotify's reported position and the renderer's roughly 200 ms update cycle. Timers stop when Spotify exits.

## Themes and shortcuts

Settings → Myify → **Theme editor** now combines the preset selector, name, color swatches and editable hex values, app font, lyric text size, background images, and a live preview. Edits apply immediately. Choosing a preset, importing, or loading a saved theme refreshes every control together. **Save theme** stores the complete active appearance; **Export theme** includes the font and embedded background. **Spotify default** restores the default appearance.

Backgrounds accept local **PNG, JPG/JPEG, animated GIF and WebP** files. The picker lists those extensions explicitly, and Myify identifies the image from its contents even when Windows provides no MIME type. Static images up to 32 MB are accepted; larger images are resized to a maximum dimension of 1920 pixels and compressed for storage. Animated GIFs up to 8 MB retain their original animation. The selected image appears in a thumbnail and the live preview.

App fonts now apply to playlist titles, track rows, navigation and other interface text. **Upload custom font** accepts TTF, OTF, WOFF and WOFF2 files up to 16 MB. Uploaded fonts become selectable and are saved with themes. Use fonts you have permission to share when distributing a theme. Spotify default restores its normal fonts.

Images and custom fonts are stored in local IndexedDB rather than filling the smaller settings storage. **Export theme** embeds the selected assets so another user can import them. Theme JSON imports accept files up to 40 MB; full settings backups include referenced image/font assets and accept files up to 128 MB. Existing v1 themes remain compatible. Keep an exported backup before clearing Spotify browser data.

Under **Keyboard shortcuts**, select an action's field and press the desired modifier combination. Backspace clears a binding. Duplicate assignments are rejected; **Reset shortcuts** restores defaults. These are focused-Spotify shortcuts, not system-wide hotkeys. Bindings, loops, fonts and embedded backgrounds are included in backups.

## Mini-player and local library

**Mini-player** opens a compact window with playback controls and synchronized imported/generated lyrics. **Always on top** can be disabled. Spotify must remain running and connected. Remote-device playback may restrict some controls.

**Local library** can add folders, rescan metadata, retain missing-file rows and report byte-identical duplicates. Duplicate scans never delete files. Files with different tags or encodings are not counted as identical. Unique title/artist/duration matches can locate a current song; ambiguous matches require you to choose the file.

Metadata/artwork editing supports **MP3 and FLAC**. Other recognized audio formats can be scanned/transcribed. Edits create an original-file backup and a mapping manifest under `metadata-backups` before writing tags. Cover images must be PNG or JPEG under 8 MB. Spotify may need to rescan local files after edits. A metadata change can change Spotify's local URI; existing attachments may then need reimporting.

The desktop tools can be hidden while Spotify keeps using them. **Quit desktop tools** stops the bridge; relaunch the Myify shortcut to reconnect. The Settings compatibility panel shows Myify's version, the detected Spotify file version and the tested version. Unknown Spotify builds are refused by the launcher/installer.

## Backups and privacy

Export/import in Spotify's Myify Settings covers lyrics, offsets, song mappings, named loops, bookmarks, custom themes and key bindings. When desktop tools are connected, backups also include the desktop library inventory and explicit audio mappings. Music files, original-file metadata backups and model weights are not copied into settings backups. Disconnected desktop tools produce a clear message that library mappings were omitted. A library restore merges entries without editing audio files.

The local bridge binds only to `127.0.0.1`, uses a randomly assigned port, checks the Spotify renderer origin and Host header, and requires an installation-specific random secret. It exchanges playback summaries and Myify commands; it does not read Spotify account tokens or cookies. No firewall exceptions or system-wide keyboard hooks are installed. Bridge requests are not an interface to arbitrary shell commands.

Desktop tools keep a timestamped `renderer-state.json` recovery copy in the Myify data folder. If Spotify reopens with an older browser-storage snapshot after closing during an upgrade, Myify restores the newer recovery copy. Newer intentional changes, including deleting an attachment, replace the recovery copy. Treat this file as private: it contains your Myify lyric attachments and preferences.

## Source builds and licensing

Renderer/installer code remains MIT. The integrated desktop component is GPL-2.0-or-later because it bundles Mutagen; its full source is in `desktop/`, with the license and upstream source information. Third-party runtime and model licenses remain separate.

On Windows with Python 3.13, Node 22+, and Inno Setup 6:

```powershell
python -m pip install -r desktop/requirements.txt
python lrc-maker/download_models.py
.\Build-Desktop.ps1
npm test
npm run check
python -m unittest discover -s desktop/tests -v
.\Build-Installer.ps1
```

`Build-Desktop.ps1 -ModelRoot <folder>` can reuse verified model folders rather than downloading them again. Both model directories must be present. The source manifest pins model revisions and SHA-256 checksums. `Build-Installer.ps1 -DesktopPayload <folder>` can package a separately built desktop folder. Generated executables/models/runtime files are excluded from Git.
