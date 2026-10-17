# Myify LRC Maker 1.0.1

Windows x64 desktop app that creates line-synchronized LRC lyrics using a local Whisper model. No Spotify installation, Python installation, API key or separate FFmpeg executable is required.

## Use

1. Run **MyifyLRC-Setup-1.0.1.exe**, then open **Myify LRC Maker** from Start.
2. Add MP3, FLAC, WAV, M4A, OGG or another audio format supported by the bundled decoder.
3. Choose an output folder. Default: your Music/LRC folder.
4. Select a model. **base.en** is a reasonable English starting point. **small.en** is slower but can recognize more accurately. For other languages, choose **base** or **small** and language **Auto**.
5. Click **Create LRC files**. Both English base.en and small.en models are included and work immediately offline. Other models download from Hugging Face when Offline only is unchecked. Audio remains on your computer.
6. Review the output or edit the last result in the preview, then save the edited copy. Import the resulting LRC into Myify or another compatible player.

Existing files are never silently replaced; duplicate names gain a number. Batch processing continues if one song fails. Cancel takes effect after a current model load or inference chunk, and completed files are retained. The GUI remains responsive while processing.

This is automatic vocal recognition, not a perfect lyric-service replacement. Rap, overlapping vocals, effects and instrumental sections can cause missing or invented words. It groups recognized word timings into lines; review words and timestamps. It does not currently force-align separately supplied lyrics. No model can guarantee correct lyrics for every song.

## Models and privacy

Models are stored under `%LOCALAPPDATA%/MyifyLRC/models`. The included base.en and small.en models need no download and takes priority over incomplete caches. Other models require a complete download once; incomplete caches are validated and can be repaired when online. English-only model names end in `.en`. Larger models require more RAM and CPU time. CPU int8 inference is used for broad Windows compatibility; no CUDA installation is needed.

The application does not upload songs or include analytics. Model-download requests go to the model host. The installer includes English base.en and small.en weights. Additional model downloads can consume substantial disk space. Uninstalling the app leaves models and generated LRC files intact.

## Command line

The executable also accepts:

```
MyifyLRC.exe --transcribe "C:/Music/song.flac" --output-dir "C:/Lyrics" --model base.en --offline --report "C:/Lyrics/result.json"
```

Use `--model-dir` to point to an existing Faster Whisper/Hugging Face cache. Omit `--offline` to permit downloading a model. The GUI executable has no console; use `--report` for batch success/error details.

## Build and test

Use Python 3.13 x64 on Windows, create a virtual environment and install `requirements.txt`. Run `python -m unittest discover -s tests -v`. Run `python download_models.py` to obtain the two version-pinned, checksum-verified models, then build using the included PyInstaller spec (`python -m PyInstaller --noconfirm MyifyLRC.spec`); for portable builds, keep the EXE together with its `_internal` folder. Copy the models folder into dist/MyifyLRC/models, then compile installer.iss with Inno Setup 6.

The decoder uses PyAV directly and supplies a 16-kHz mono array to Faster Whisper, avoiding a keyword-argument incompatibility in Faster Whisper 1.2.1 with recent PyAV releases. No system FFmpeg executable is invoked by the app.

Original application code is MIT licensed. Third-party components and model weights retain their own licenses; see THIRD-PARTY-NOTICES.txt and third-party-licenses. Installer is unsigned.
