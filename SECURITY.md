# Security and privacy

Myify runs inside the local Spotify renderer and modifies its UI resource archive. The Windows manager also writes the tool's own backup/receipt data, recognized Spotify update staging paths and (when enabled) matching shortcuts/startup entry. It does not change account entitlements. The supported-build guard is essential; do not bypass it.

Myify includes no analytics, hosted backend, remote script loader or catalog lyric downloader. Imported lyrics, bookmarks and themes live in Spotify's browser storage. Exported backups include item identifiers and personal notes; do not upload them publicly. Spotify's own network behavior is outside Myify's control.

Report reproducible issues without tokens, proprietary app files, personal exports or raw private analysis. For a sensitive vulnerability, use GitHub's private vulnerability reporting if available rather than posting exploit details publicly. If that facility is unavailable, open an issue requesting a private reporting channel without sensitive details.

The combined desktop tools add an authenticated loopback-only bridge. It uses an install-specific random secret and checks the Spotify renderer Origin and loopback Host. It accepts only named Myify actions; it does not expose a shell or Spotify authentication tokens. Library inventories and generated LRC files are stored under the Myify data folder. Metadata edits create an original backup before modifying a local file. Audio is never uploaded for transcription. Optional model downloads contact Hugging Face; English base/small models are included for offline use.

Only 0.4.1 is currently supported, on the exact Spotify build listed in the compatibility documentation. Installers are unsigned. Obtain releases from this repository and compare SHA-256 checksums.
