MYIFY 0.4.3 - COMBINED WINDOWS TOOLS

Run Myify-Setup-0.4.3.exe over your existing Myify installation. Spotify closes
while setup updates the tools. The install identity, original Spotify resource
backup and saved lyrics/themes/bookmarks are preserved. Setup creates a Spotify
(Myify) desktop shortcut by default. Double-click it to open Spotify; the helper
starts in the background without opening a second tools window.
Standalone desktop Spotify 1.3.5.3058 is required; unknown builds are refused.

ONE DOWNLOAD: Myify-Setup-0.4.3.exe includes everything. No separate launcher
download or LRC Maker installation is required. Start > Myify > Spotify (Myify)
now runs the installed Myify.exe, opens Spotify and starts its hidden helper.
Repeated launches reuse the helper. To pin the correct
launcher, use Start > Myify > Spotify (Myify) > More > Pin to taskbar, or pin
%LOCALAPPDATA%\SpotifyNativeEnhancer\Myify.exe from File Explorer. Replace old
Myify pins; pinning the running Spotify icon skips the desktop-tools launcher.
Startup errors appear in a dialog and SpotifyNativeEnhancerData\launcher.log.
For tools alone, Start > Myify > Myify desktop tools can also be pinned.
Direct tools startup now creates a missing data/configuration folder itself;
you do not need to create bridge.json or browse hidden AppData folders.

The sliders button beside lyrics opens Myify playback tools:
- Generate lyrics transcribes the current LOCAL song with the included English
  model, remembering the audio-file location and automatically attaching results.
  Select the file once if Myify has not located it. Audio stays on this PC.
- Lyrics editor imports LRC/text, timestamps lines as you listen, shifts timing,
  and saves corrections or exports LRC files. Recognition needs review.
- Set A and B to loop. Settings lets you save multiple named loops per song.
- Mini-player opens synchronized lyrics and controls in an always-on-top window.
- Sleep modes include a timer, end of current song, and a final 30-second fade.

Spotify Settings > Myify includes live colors, saved themes, background images,
uploaded TTF/OTF/WOFF/WOFF2 fonts, editable keyboard bindings with conflict checks, settings backup/restore,
version compatibility, saved loops and bookmarks. Shortcuts work with Spotify
focused. Backspace clears a binding; Reset shortcuts restores defaults.
Fonts apply to playlist and navigation text. Backgrounds accept JPG/JPEG, PNG,
WebP and animated GIFs. Images up to 32 MB are resized when needed; GIFs keep
animation and must be under 8 MB. Font uploads allow up to 16 MB. Theme exports
and full settings backups include the uploaded images and fonts.

Start menu > Myify > Myify desktop tools provides advanced generation options,
batch files, base.en/small.en models, editable results and local library tools.
Both English models are included. A separate LRC Maker install is unnecessary.
Optional other-language models require a download. Spotify streams are not
extracted. Spotify login and account requirements continue to apply.

Local library: folder scans, missing-file detection and exact duplicate reports.
No duplicate files are deleted. MP3/FLAC metadata and artwork editing saves an
original-file backup before editing. Spotify may need a local-file rescan.

Data: %LOCALAPPDATA%\SpotifyNativeEnhancerData
Generated lyrics: lyrics subfolder. Original music backups: metadata-backups.
Theme/lyric/bookmark settings remain in Spotify's existing browser storage.
Export backups before clearing browser data. Backups include desktop mappings
when desktop tools are connected; they do not include music or model weights.
Uninstall restores supported Spotify resources and keeps saved user data.

Update protection is reversible in Myify settings and updates. Future Spotify
versions require tested compatibility. No firewall or hosts-file changes.

Renderer/installer source: MIT. Integrated desktop: GPL-2.0-or-later, with
separate upstream library/model licenses included. No Spotify code or music is
included. Full documentation and source: https://github.com/dr4lera/Myify
Guide: https://github.com/dr4lera/Myify/blob/main/docs/COMBINED-TOOLS.md
