from pathlib import Path
import os,json,hashlib
os.environ.setdefault('HF_HUB_DISABLE_XET','1')
from huggingface_hub import snapshot_download
root=Path(__file__).resolve().parent
manifest=json.loads((root/'model-manifest.json').read_text())
for name,model in manifest.items():
 folder=root/'models'/name
 snapshot_download(model['repo'],revision=model['revision'],local_dir=str(folder),allow_patterns=list(model['files']))
 for name,expected in model['files'].items():
  actual=hashlib.sha256((folder/name).read_bytes()).hexdigest()
  if actual!=expected:raise ValueError('Model checksum mismatch: '+name)
 print('Verified',folder)
