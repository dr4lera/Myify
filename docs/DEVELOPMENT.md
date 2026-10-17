# Development and releases

## Build requirements

Node.js 22 or later builds and tests the dependency-free JavaScript. Building the installer additionally requires Windows, Windows PowerShell 5.1 and Inno Setup 6 (`ISCC.exe`). Spotify is not needed to build the distributed loader or installer. Compatibility data is a checked-in hash manifest, not a bundled app.

```powershell
npm test
npm run check
npm run build
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\Build-Installer.ps1
```

Pass `-InnoCompiler "C:\path\to\ISCC.exe"` if the compiler is not on PATH or in its normal location. Outputs are `dist/native-loader.js`, `dist/Myify-Setup-0.3.0.exe` and `dist/SHA256SUMS`. Generated payloads and binary outputs are ignored by Git. There are no npm dependencies to install.

## Architecture

- `src/core.js`: LRC parser, active-line binary search, bounded state and theme validation; CommonJS exports for tests and browser global for the adapter.
- `src/native-integration.js`: version-bound renderer adapter. Captures the installed renderer's module registry; wraps lyrics availability/data hooks; resolves PlayerAPI from Spotify's existing UI context. Original hooks still run. Only imported items replace their lyric result.
- `scripts/build.cjs`: concatenates original Myify core and adapter, checking JavaScript syntax. No proprietary source is used as build input.
- `installer/Engine.psm1`: exact build/content validation, archive patching, original backup/receipt, reversible version protection and safe restoration.
- `installer/Manager.ps1`: command-line actions and Windows Forms manager.
- `installer/Myify.iss`: per-user installer; compatibility check and verified installation occur before setup reports success. Uses the existing installation ID to preserve upgrades.
- `installer/supported-build.json`: executable version, original archive hash, and original resource-entry hashes. Contains no resource bytes.

The tested internal module IDs are 91243 (lyrics data), 48071 (availability), 62515 (React) and 37438 (playback position helper). These are implementation details of one build, not stable APIs. Never broaden supported builds without new runtime evidence and a verified manifest. Keep `local-enhancer:v1`, the theme type and existing restore identifiers compatible with earlier installations, or provide migration.

## Tests

`npm test` covers timestamp parsing, metadata, repeated stamps, offsets, active-line lookup, backup validation and color validation. `npm run check` checks both source files. CI runs these checks and builds the loader on Windows and Linux; it does not authenticate to Spotify or assert live playback.

The opt-in Windows integration test takes your own legally obtained supported executable and pristine original archive:

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\tests\installer.test.ps1 -SpotifyExe "C:\fixtures\Spotify.exe" -OriginalArchive "C:\fixtures\xpui.original.spa"
```

Build the installer first to stage its payload. Tests copy inputs to a unique ignored `.test-lab` directory, skip real shortcuts and exercise pristine installation, repeat install, staging guards, policy persistence, restoration, legacy migration and rejection of unknown modifications/versions. They retain their lab for inspection. Do not commit fixtures or lab contents.

Before the Myify rename, the same transport implementation was tested inside actual Spotify on a local file, streamed song and podcast: paused seeks, Set B from pause, repeated real loops and bookmark playback. A cold paused local-file seek restored pause/volume. Theme edit/save/export/import was checked in native Settings. These are manual/runtime checks, separate from public CI. Chapter URIs and arbitrary remote playback devices were not individually validated.

## Release checklist

1. Keep package, native status, manifest and Inno versions consistent; update CHANGELOG and compatibility docs.
2. Run source tests/check/build, PowerShell syntax checks and opt-in installer tests on supported local fixtures.
3. Build the installer; inspect its explicit file list. Exclude Spotify resources, recovered code, personal screenshots, logs, credentials and backups.
4. Smoke-test install, repair, launch and uninstall on a supported test installation. Never claim a newer build works from a version-string edit alone.
5. Create a tagged GitHub release and upload the EXE and SHA256SUMS as actual assets. Source archives are supplied automatically by GitHub.
6. Compare the uploaded installer hash with SHA256SUMS. The installer is currently unsigned; the checksum verifies downloaded bytes against the release, not an independently authenticated publisher.

The Inno compiler embeds build metadata, so binary-identical rebuilds are not promised. Source is MIT licensed; Spotify's binaries/assets are not distributable as part of this project.
