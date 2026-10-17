import sys,unittest,tempfile
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parents[1]))
from lrc_engine import timestamp,format_lrc,save_unique,valid_model,load_model
from unittest.mock import patch
class LrcTests(unittest.TestCase):
 def test_timestamp_carries(self):
  self.assertEqual(timestamp(59.999),'[01:00.00]');self.assertEqual(timestamp(-1),'[00:00.00]')
 def test_silence_and_line_breaks(self):
  result=format_lrc([{'word':'Hello','start':1.25,'end':1.6},{'word':' world','start':1.7,'end':2},{'word':'Again','start':5,'end':6}],title='A\n[bad]')
  self.assertIn('[00:01.25]Hello world',result);self.assertIn('[00:02.15]\n[00:05.00]Again',result);self.assertIn('[ti:Abad]',result)
 def test_no_vocals(self):
  with self.assertRaises(ValueError):format_lrc([])
 def test_no_overwrite(self):
  with tempfile.TemporaryDirectory() as d:
   first=save_unique(d,'song','original');second=save_unique(d,'song','second')
   self.assertNotEqual(first,second);self.assertEqual(first.read_text(),'original')
class ModelTests(unittest.TestCase):
 def test_missing_weights_rejected(self):
  with tempfile.TemporaryDirectory() as d:
   root=Path(d);(root/'config.json').write_text('{}');(root/'tokenizer.json').write_text('{}')
   self.assertFalse(valid_model(root))
 def test_bundle_never_downloads_in_offline_mode(self):
  with patch('lrc_engine.bundled_model',return_value=Path('included')),patch('faster_whisper.WhisperModel') as model,patch('faster_whisper.utils.download_model',side_effect=AssertionError('download attempted')):
   load_model('base.en','empty-cache',True)
   self.assertEqual(model.call_args.args[0],'included');self.assertTrue(model.call_args.kwargs['local_files_only'])
 def test_incomplete_offline_cache_is_actionable(self):
  with tempfile.TemporaryDirectory() as d,patch('lrc_engine.bundled_model',return_value=None),patch('faster_whisper.utils.download_model',return_value=d),patch('faster_whisper.WhisperModel') as model:
   with self.assertRaisesRegex(ValueError,'Select base.en'):load_model('small','cache',True)
   model.assert_not_called()
 def test_incomplete_online_download_is_repaired(self):
  with tempfile.TemporaryDirectory() as d:
   broken=Path(d)/'broken';broken.mkdir();repaired=Path(d)/'fixed';repaired.mkdir()
   (repaired/'model.bin').write_bytes(b'0'*1000001);(repaired/'config.json').write_text('{}');(repaired/'tokenizer.json').write_text('{}')
   with patch('lrc_engine.bundled_model',return_value=None),patch('faster_whisper.utils.download_model',return_value=str(broken)),patch('huggingface_hub.snapshot_download',return_value=str(repaired)) as repair,patch('faster_whisper.WhisperModel') as model:
    load_model('small','cache',False)
    self.assertTrue(repair.call_args.kwargs['force_download']);self.assertEqual(model.call_args.args[0],str(repaired))

if __name__=='__main__':unittest.main()

