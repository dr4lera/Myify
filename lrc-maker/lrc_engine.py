"""Local audio decoding, Whisper inference and line-synchronized LRC export."""
from pathlib import Path
import re

VERSION = '1.0.1'
MODELS = ('base.en', 'base', 'small.en', 'small', 'tiny.en', 'tiny', 'medium', 'large-v3-turbo')

class Cancelled(Exception):
    pass

def timestamp(seconds):
    hundredths = max(0, round(float(seconds) * 100))
    return f'[{hundredths // 6000:02d}:{hundredths // 100 % 60:02d}.{hundredths % 100:02d}]'

def tag(value):
    return re.sub(r'[\[\]\r\n]', '', str(value)).strip()

def format_lrc(words, title='', artist=''):
    """Group word timestamps into readable lines; never invent missing words."""
    result = [f'[ti:{tag(title)}]', f'[ar:{tag(artist)}]', '[re:Myify LRC Maker]', '[ve:1.0.1]', '[offset:0]', '']
    group = []
    previous_end = None
    def flush():
        if group:
            text = ''.join(w['word'] for w in group).strip()
            if text:
                result.append(timestamp(group[0]['start']) + text)
            group.clear()
    for word in words:
        if not word['word'].strip():
            continue
        if group and (word['start'] - group[-1]['end'] > 0.9 or word['start'] - group[0]['start'] > 4.5 or len(group) >= 10 or sum(len(w['word']) for w in group) + len(word['word']) > 65):
            gap = word['start'] - group[-1]['end']
            end = group[-1]['end']
            flush()
            if gap > 1.8:
                result.append(timestamp(end + 0.15))
        group.append(word)
        previous_end = word['end']
        if word['word'].rstrip().endswith(('.', '?', '!')) and len(group) >= 4:
            flush()
    flush()
    if previous_end is None:
        raise ValueError('No vocals were recognized. Try a larger model or choose the correct language.')
    result.append(timestamp(previous_end + 0.2))
    return '\n'.join(result) + '\n'

def decode_audio(path, notify=lambda message: None):
    import av
    import numpy as np
    notify('Decoding audio locally...')
    pieces = []
    with av.open(str(path), mode='r') as container:
        metadata = dict(container.metadata)
        if not container.streams.audio:
            raise ValueError('This file has no audio stream.')
        resampler = av.AudioResampler(format='fltp', layout='mono', rate=16000)
        for frame in container.decode(audio=0):
            frame.pts = None
            for converted in resampler.resample(frame):
                pieces.append(converted.to_ndarray().reshape(-1))
        for converted in resampler.resample(None):
            pieces.append(converted.to_ndarray().reshape(-1))
    if not pieces:
        raise ValueError('No audio samples could be decoded.')
    return np.concatenate(pieces).astype(np.float32, copy=False), metadata

def bundled_model(model_name):
    import sys
    root = Path(sys.executable).parent if getattr(sys,'frozen',False) else Path(__file__).resolve().parent
    folder = root / 'models' / model_name
    return folder if valid_model(folder) else None

def valid_model(folder):
    folder=Path(folder)
    weights=folder/'model.bin'
    return weights.is_file() and weights.stat().st_size>1000000 and (folder/'config.json').is_file() and (folder/'tokenizer.json').is_file()

def load_model(model_name, cache, offline, notify=lambda message: None):
    import os
    os.environ.setdefault('HF_HUB_DISABLE_XET', '1')
    os.environ.setdefault('HF_HUB_DISABLE_SYMLINKS_WARNING', '1')
    os.environ.setdefault('HF_HUB_DISABLE_PROGRESS_BARS','1')
    from faster_whisper import WhisperModel
    from faster_whisper.utils import download_model
    selected=bundled_model(model_name)
    if selected:
        notify('Loading included '+model_name+' model (no download needed)...')
    else:
        notify('Finding cached model...' if offline else 'Downloading or checking model weights; audio stays on this PC...')
        try:
            selected=Path(download_model(model_name,cache_dir=str(cache),local_files_only=offline))
            if not valid_model(selected):
                if offline:
                    raise ValueError('The cached '+model_name+' model is incomplete: model.bin or tokenizer files are missing. Choose the included base.en model, or turn off Offline only to repair the download.')
                notify('Repairing incomplete model download...')
                from huggingface_hub import snapshot_download
                from faster_whisper.utils import _MODELS
                selected=Path(snapshot_download(_MODELS[model_name],cache_dir=str(cache),force_download=True,allow_patterns=['model.bin','config.json','tokenizer.json','vocabulary.*','preprocessor_config.json']))
            if not valid_model(selected):
                raise ValueError('The model download is incomplete. Choose the included base.en model to work offline.')
        except Exception as exc:
            if offline:
                raise ValueError('No complete local '+model_name+' model was found. Select base.en, which is included with this setup. Other models need a successful download with Offline only turned off.') from exc
            raise
    return WhisperModel(str(selected),device='cpu',compute_type='int8',cpu_threads=min(8,os.cpu_count() or 4),local_files_only=True)

def transcribe(model, audio_path, language, stop, notify=lambda message: None):
    if stop.is_set():
        raise Cancelled()
    audio, metadata = decode_audio(audio_path, notify)
    duration = len(audio) / 16000
    if stop.is_set():
        raise Cancelled()
    segments, info = model.transcribe(audio, language=None if language == 'Auto' else language, word_timestamps=True, beam_size=5, condition_on_previous_text=False, vad_filter=False)
    words = []
    for segment in segments:
        if stop.is_set():
            raise Cancelled()
        words.extend({'word':w.word, 'start':w.start, 'end':w.end} for w in (segment.words or []))
        notify(f'Timing vocals: {min(segment.end / max(duration, 1), 1):.0%} ({segment.end:.0f}/{duration:.0f}s)')
    return format_lrc(words, metadata.get('title', Path(audio_path).stem), metadata.get('artist', '')), info.language

def save_unique(folder, stem, text):
    folder = Path(folder)
    folder.mkdir(parents=True, exist_ok=True)
    for index in range(10000):
        suffix = '' if index == 0 else f' ({index + 1})'
        path = folder / f'{stem}{suffix}.lrc'
        try:
            with path.open('x', encoding='utf-8', newline='\n') as output:
                output.write(text)
            return path
        except FileExistsError:
            continue
    raise ValueError('Too many files with this name. Choose a different output folder.')
