# Contributing

Open an issue describing the Spotify build, Windows version, steps, expected behavior and actual result. Redact local paths and personal data. Small focused pull requests are welcome. Run `npm test`, `npm run check` and `npm run build`; Windows installer changes should also pass the opt-in fixture tests documented in [development](docs/DEVELOPMENT.md).

Do not commit Spotify executables, archives, recovered code, music, lyric libraries, account data, credentials, or personal screenshots. Use original synthetic fixtures. Changes must preserve normal account entitlements and supported-build/content validation. Add tests for parser/validation behavior changes and document compatibility evidence for renderer hooks.

By contributing, you agree your original contributions are distributed under this repository's MIT license. Do not submit third-party code without the required permission and attribution.
