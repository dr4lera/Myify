MYIFY 0.3.1 - WINDOWS

Run Myify-Setup-0.3.1.exe. It updates the enhancement in your existing
Spotify app, creates a manager and protected launcher in the Start menu, and
backs up the original Spotify resources. Select the folder containing Spotify.exe and Apps\xpui.spa.
Common standalone locations are detected. Spotify closes during installation.
The installer currently supports desktop Spotify 1.3.5.3058 only.

PLAYBACK TOOLS
In Spotify, click the sliders beside the lyrics control. Playback tools now use
confirmed seek positions and route local files through Spotify's local collection
when required. Mark Set A, move forward at least half a second, then Set B.
Set B starts the loop immediately, even from pause. Clear stops looping.
Bookmarks, seek shortcuts and sleep timers support songs, local files and
podcasts; chapter URIs are also accepted when Spotify permits playback/seeking.
Spotify's own playback restrictions are shown as errors instead of silent failures.

LYRICS
Play an item, choose Import .lrc, and select your UTF-8 timed lyrics file.
Your lyrics use Spotify's native renderer. Delay (ms) adjusts synchronization.
Imports now accept local files, streamed songs and episodes. The imported text
is your file; Spotify's catalog lyric service and account access are unchanged.

THEMES
Open Settings & bookmarks, then App theme > Custom theme. Edit main background,
panels/player bar, text, secondary text, accent, and imported lyric colors.
Name and save a theme, or import/export theme JSON files. Spotify default resets
appearance. Presets include Midnight blue and Plum. Theme files accept only
validated hex colors, not scripts or arbitrary CSS.

UPDATE HANDLING
The installer defaults to keeping the tested Spotify build. This is reversible:
Start menu > Myify > Myify settings and updates > Allow
Spotify updates. Pause Spotify updates re-enables protection.
Protection blocks Spotify's known local/roaming Update staging directories with
read-only files and applies update-suppression flags to managed launches and
recognized Spotify shortcuts/startup. Original staging data and shortcuts are
backed up and restored when protection is removed. No firewall/hosts edits,
system-wide update settings, services or background scheduled jobs are added.

Use the protected Spotify (Myify) shortcut for compatibility checking and
repair. If the same supported build loses the patch, that launcher can repair it.
A future Spotify build is not automatically considered compatible. The launcher
will not inject old hooks into unknown app code. A manual reinstall or changed
updater may bypass the version protection; an updated enhancer may then be needed.

BACKUPS / UNINSTALL
Manager files: %LOCALAPPDATA%\SpotifyNativeEnhancer
Original UI, receipts and protection backups: %LOCALAPPDATA%\SpotifyNativeEnhancerData
Uninstall through Windows Installed apps to restore the original supported UI and
allow updates. If Spotify has independently updated, its new UI is left intact.
Lyrics, bookmarks and themes are not deleted by uninstall; they remain in
Spotify's local browser storage. Export a backup before reinstalling Spotify or
clearing its browser data.

ABOUT
Myify is an independent, open-source local customization tool. It contains no
Spotify app code, music, credentials or recovered source. It does not change
account entitlements. Source and full documentation: https://github.com/dr4lera/Myify
