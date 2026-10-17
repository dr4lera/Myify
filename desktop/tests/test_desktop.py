import json
import queue
import sys
import tempfile
import threading
import unittest
from unittest.mock import patch
import urllib.request
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from bridge import Bridge, serve
import library


class BridgeTest(unittest.TestCase):
    def setUp(self):
        self.events = queue.Queue()
        self.bridge = Bridge('a' * 64, self.events, lambda value: {'version': 1, 'files': []}, lambda: {'myify': '0.4.0'})
        self.server = serve(self.bridge, 0)
        self.url = f'http://127.0.0.1:{self.server.server_port}'

    def tearDown(self):
        self.server.shutdown(); self.server.server_close()

    def post(self, route, value, origin='https://xpui.app.spotify.com', token='a' * 64):
        request = urllib.request.Request(self.url + route, json.dumps(value).encode(), headers={'Content-Type': 'application/json', 'Origin': origin, 'Authorization': 'Bearer ' + token})
        with urllib.request.urlopen(request, timeout=3) as response:
            return json.load(response)

    def test_command_survives_until_ack_and_snapshot_advances(self):
        self.bridge.send('toggle')
        first = self.post('/sync', {'uri': 'spotify:local:a:b:c:10', 'position': 100, 'acks': []})
        command = first['commands'][0]
        self.assertEqual(self.post('/sync', {'acks': []})['commands'], [command])
        self.assertEqual(self.post('/sync', {'position': 200, 'acks': [command['id']]})['commands'], [])
        self.assertEqual(self.bridge.snapshot['position'], 200)

    def test_requires_origin_and_install_secret(self):
        for origin, token in [('https://evil.example', 'a' * 64), ('https://xpui.app.spotify.com', 'wrong')]:
            with self.assertRaises(urllib.error.HTTPError) as ctx:
                self.post('/sync', {}, origin, token)
            self.assertEqual(ctx.exception.code, 403)

    def test_generate_dispatch_and_unknown_commands(self):
        self.post('/open', {'action': 'generate', 'item': {'uri': 'spotify:local:a:b:c:10'}})
        self.assertEqual(self.events.get_nowait()[0], 'generate')
        with self.assertRaises(urllib.error.HTTPError): self.post('/open', {'action': 'shell'})


class LibraryTest(unittest.TestCase):
    def test_auto_lookup_checks_duration_and_accepts_identical_copies(self):
        with tempfile.TemporaryDirectory() as folder:
            a, b = Path(folder)/'Song mix.mp3', Path(folder)/'copy'/'Song mix.mp3'
            b.parent.mkdir(); a.write_bytes(b'same audio'); b.write_bytes(b'same audio')
            item = dict(title='Song', artist='Artist', duration=120000)
            def inspect(path): return dict(path=str(path),title='Song',artist='Artist',duration=120)
            with patch.object(library, 'inspect', inspect):
                self.assertEqual(library.discover(item, [folder]), str(a))
                self.assertIsNone(library.discover({**item,'duration':240000}, [folder]))
                b.write_bytes(b'other take')
                self.assertIsNone(library.discover(item, [folder]))

    def test_ambiguous_match_is_not_auto_selected_and_explicit_mapping_wins(self):
        with tempfile.TemporaryDirectory() as folder:
            a, b = Path(folder)/'a.mp3', Path(folder)/'b.mp3'; a.write_bytes(b'a'); b.write_bytes(b'b')
            rows = [dict(path=str(p), title='Song', artist='Artist', duration=120) for p in (a,b)]
            item = dict(uri='spotify:local:a:b:c:120', title='Song', artist='Artist', duration=120000)
            self.assertIsNone(library.match(rows, item))
            rows[0]['uri'] = item['uri']; self.assertEqual(library.match(rows, item), str(a))
            a.unlink(); self.assertEqual(library.match(rows, item), str(b))

    def test_duplicate_scan_does_not_delete_and_ignores_missing_files(self):
        with tempfile.TemporaryDirectory() as folder:
            paths = [Path(folder)/name for name in ('a.mp3','b.flac','c.mp3')]
            paths[0].write_bytes(b'one'); paths[1].write_bytes(b'one'); paths[2].write_bytes(b'two')
            rows = [{'path': str(p)} for p in paths] + [{'path': str(Path(folder)/'missing.mp3')}]
            self.assertEqual(library.duplicates(rows), [[str(paths[0]), str(paths[1])]])
            self.assertTrue(all(p.exists() for p in paths))

    def test_flac_tag_edit_keeps_original_and_scan_retains_missing(self):
        import av
        import numpy as np
        from mutagen.flac import FLAC
        with tempfile.TemporaryDirectory() as folder:
            path = Path(folder)/'tone.flac'
            with av.open(str(path), 'w') as output:
                stream = output.add_stream('flac', rate=16000)
                frame = av.AudioFrame.from_ndarray(np.zeros((1,16000), dtype=np.int16), format='s16', layout='mono'); frame.sample_rate=16000
                for packet in stream.encode(frame): output.mux(packet)
                for packet in stream.encode(): output.mux(packet)
            original = path.read_bytes()
            backup = library.edit_tags(path, dict(title='Title', artist='Artist', album='Album'), Path(folder)/'backups')
            self.assertEqual(Path(backup).read_bytes(), original)
            self.assertEqual(FLAC(path)['title'], ['Title'])
            rows, errors = library.scan(folder, [{'path': str(Path(folder)/'gone.mp3'), 'title': 'Gone'}])
            self.assertFalse(errors)
            self.assertTrue(any(r.get('title')=='Title' for r in rows))
            self.assertTrue(any(r.get('title')=='Gone' for r in rows))


if __name__ == '__main__': unittest.main()
