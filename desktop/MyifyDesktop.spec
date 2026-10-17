from pathlib import Path
from PyInstaller.utils.hooks import collect_all, copy_metadata
root = Path(SPECPATH).parent
datas, binaries, hiddenimports = [], [], []
for name in ['huggingface-hub','tqdm','packaging','pyyaml','filelock','fsspec','typing_extensions','hf-xet','mutagen']:
    datas += copy_metadata(name)
for name in ['faster_whisper','ctranslate2','tokenizers','av','onnxruntime']:
    data, binary, hidden = collect_all(name)
    datas += data; binaries += binary; hiddenimports += hidden
a = Analysis([str(root/'desktop'/'app.py')], pathex=[str(root/'desktop'), str(root/'lrc-maker')], binaries=binaries, datas=datas, hiddenimports=hiddenimports, hookspath=[], hooksconfig={}, runtime_hooks=[], excludes=[], noarchive=False)
pyz = PYZ(a.pure)
exe = EXE(pyz,a.scripts,[],exclude_binaries=True,name='MyifyDesktop',debug=False,bootloader_ignore_signals=False,strip=False,upx=False,console=False,disable_windowed_traceback=False)
coll = COLLECT(exe,a.binaries,a.datas,strip=False,upx=False,name='MyifyDesktop')
