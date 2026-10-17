# User guide

## Launching and pinning Myify

Install or upgrade with the single **Myify-Setup-0.4.3.exe** download. Then open **Start → Myify → Spotify (Myify)**. Its target is the installed `Myify.exe`, which runs the compatibility/repair manager, starts Spotify, and opens Myify desktop tools visibly. A repeated launch shows the existing tools instead of creating a second tools server.

To pin the launcher, right-click **Spotify (Myify)** in Start → **More → Pin to taskbar**. Alternatively, open `%LOCALAPPDATA%\SpotifyNativeEnhancer` in File Explorer and pin **Myify.exe**. Unpin any previous broken Myify entry first. Pinning the icon of a normally opened Spotify app starts Spotify directly; it does not start the Myify desktop tools.

The installer updates recognized old Myify launcher shortcuts. Windows can retain a cached taskbar target, so replace an old pin if it still opens PowerShell or does nothing. Do not move `Myify.exe` out of its installed folder; it locates `Manager.ps1` and desktop tools beside itself. No second installer or companion ZIP is required.

If startup fails, the launcher shows an error with the diagnostic location: `%LOCALAPPDATA%\SpotifyNativeEnhancerData\launcher.log`. The existing manager log remains `manager.log` in that folder. Launching `Myify.exe --check` validates the installed compatibility path without opening Spotify or desktop tools.

## Local lyrics

Enable Local Files in Spotify and play the desired item first. Click the sliders beside the lyrics control, choose **Import .lrc**, and select your file. Choose **Open lyrics** to see synchronized text in Spotify's normal view. Each import attaches to that item's Spotify URI, including local files, music and episodes. Changing a local file's metadata can change its URI; import again if necessary.

Use UTF-8 `.lrc` files under 512 KB. Supported timestamps include `[01:23.45]`, `[01:23.456]`, multiple timestamps per line, metadata tags, and `[offset:...]`. Enhanced word-time tags are removed; synchronization is line-based. Untimed text is not a synchronized lyric file. See [example.lrc](../examples/example.lrc).

**Delay (ms)** adjusts synchronization; positive values show lyrics later. Settings include font size and lyric-library search, title/artist sorting, playback, export and removal. Imported text is supplied by you; Myify does not retrieve or redistribute catalog lyrics.

## A–B repeat and seeking

Open playback tools, position playback at the start, then **Set A**. Move forward at least 500 ms and choose **Set B**. Playback resumes if paused and returns to A immediately; it repeats until **Clear** or the item changes. If B is before or too close to A, choose a later position. Playback/seek failures appear in the tool's status.

Local files sometimes require decoder initialization before a paused seek. Myify uses the local collection and briefly initializes playback muted when necessary, restoring pause and volume. Supported local files, streamed music and podcasts were tested in the installed client. Content that Spotify itself cannot seek is not made seekable by Myify.

The tools also include ten-second seeks, timestamp bookmarks, editable bookmark notes and a sleep timer. The sleep timer clears an active loop before pausing. Keep Spotify running for the timer and looping to operate.

## Themes

In Spotify Settings, find **Myify**, then **App theme**. Choose Spotify default, Midnight blue, Plum or Custom theme. Custom themes edit background, panels/player bar, text, secondary text, accent, lyric background and lyric text. Name and save a theme to reuse it, or export/import theme JSON.

Colors must be `#RRGGBB`; theme imports accept data only, not arbitrary CSS or scripts. The theme JSON schema uses the existing `spotify-native-enhancer-theme` identifier for backward compatibility. Some Spotify surfaces have their own colors and may not follow every field.

## Backups

Use **Export backup** in Myify's Spotify Settings section. This includes imported text, item identifiers, bookmarks, notes and appearance. Treat that JSON as personal data. **Import backup** validates and replaces the saved state; export your current data first if you want to keep both.

Data stays in Spotify's local browser storage under the legacy key `local-enhancer:v1`; clearing Spotify's browser data or reinstalling Spotify can remove it. Uninstalling Myify does not clear this browser storage. File exports are user-initiated downloads. No Myify analytics or remote script downloads are included.

## Manager, repair and uninstall

Start menu > **Myify > Myify settings and updates** opens the manager. **Repair / update tools** reinstalls this release's tools on the supported build. It closes and relaunches Spotify. **Open backup folder** shows original resources, receipts and update-protection backups. Use **Allow Spotify updates** or **Pause Spotify updates** to change the reversible protection policy.

Uninstall **Myify** from Windows Installed apps. It restores the backed-up UI if the current resource archive still matches the one Myify installed, and reverses its update protection. If another program or Spotify changed the archive, Myify avoids overwriting it. See [recovery](COMPATIBILITY.md).

For upgrades from Spotify Native Enhancer, the installer preserves the existing application ID, `%LOCALAPPDATA%\SpotifyNativeEnhancer` install directory and `%LOCALAPPDATA%\SpotifyNativeEnhancerData` backup directory. These legacy internal names preserve restoration records and saved settings; the visible product is Myify.
