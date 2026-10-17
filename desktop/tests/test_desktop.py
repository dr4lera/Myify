import json
import queue
import sys
import tempfile
import threading
import unittest
from unittest.mock import patch, Mock
import urllib.request
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from bridge import Bridge, serve, load_config
import library
from app import App
import app as desktop_app
from concurrent.futures import ThreadPoolExecutor


class FirstLaunchConfigTest(unittest.TestCase):
    def test_missing_folder_bootstraps_private_config_and_reuses_it(self):
        with tempfile.TemporaryDirectory() as folder:
            root = Path(folder) / 'new profile' / 'Myify data'
            config = load_config(root)
            self.assertRegex(config['token'], r'^[a-f0-9]{64}$')
            self.assertTrue(1024 <= config['port'] <= 65535)
            self.assertEqual(load_config(root), config)
            self.assertEqual(json.loads((root / 'bridge.json').read_text()), config)

    def test_concurrent_first_launch_uses_one_shared_configuration(self):
        with tempfile.TemporaryDirectory() as folder:
            root = Path(folder) / 'new profile'
            with ThreadPoolExecutor(max_workers=8) as pool:
                configurations = list(pool.map(lambda _: load_config(root), range(16)))
            self.assertTrue(all(value == configurations[0] for value in configurations))

    def test_existing_installation_config_is_preserved(self):
        with tempfile.TemporaryDirectory() as folder:
            path = Path(folder, 'bridge.json')
            original = json.dumps({'port': 23456, 'token': 'f' * 64}).encode('utf-8-sig')
            path.write_bytes(original)
            self.assertEqual(load_config(folder)['token'], 'f' * 64)
            self.assertEqual(path.read_bytes(), original)

    def test_invalid_config_reports_repair_without_replacing_secret(self):
        with tempfile.TemporaryDirectory() as folder:
            path = Path(folder, 'bridge.json'); path.write_text('{"port": 80, "token": "invalid"}')
            with self.assertRaisesRegex(ValueError, 'Run setup again'):
                load_config(folder)
            self.assertEqual(json.loads(path.read_text())['token'], 'invalid')

    def test_main_starts_without_a_preexisting_config(self):
        with tempfile.TemporaryDirectory() as folder:
            root = Path(folder) / 'missing data'; window = Mock()
            with patch.object(sys, 'argv', ['MyifyDesktop', '--data-root', str(root)]), \
                 patch.object(desktop_app.tk, 'Tk', return_value=window), patch.object(desktop_app, 'App') as construct:
                desktop_app.main()
            self.assertEqual(construct.call_args.args[2], load_config(root))
            window.mainloop.assert_called_once()


class ForwardingExitTest(unittest.TestCase):
    def run_forwarder(self, hidden):
        with tempfile.TemporaryDirectory() as folder:
            Path(folder, 'bridge.json').write_text(json.dumps({'port': 12345, 'token': 'a' * 64}), encoding='utf-8')
            root = Mock()
            argv = ['MyifyDesktop', '--data-root', folder] + (['--hidden'] if hidden else [])
            with patch.object(sys, 'argv', argv), patch.object(desktop_app.tk, 'Tk', return_value=root), \
                 patch.object(desktop_app, 'App', side_effect=OSError('already running')), \
                 patch.object(desktop_app.os, '_exit', side_effect=SystemExit(0)) as exit_process, \
                 patch('urllib.request.urlopen') as post:
                with self.assertRaises(SystemExit) as exited:
                    desktop_app.main()
                self.assertEqual(exited.exception.code, 0)
                root.destroy.assert_called_once()
                exit_process.assert_called_once_with(0)
                if hidden:
                    post.assert_not_called()
                else:
                    self.assertEqual(json.loads(post.call_args.args[0].data), {'action': 'show'})

    def test_hidden_forwarder_exits_without_leaving_runtime_threads(self):
        self.run_forwarder(True)

    def test_visible_forwarder_shows_existing_tools_then_exits(self):
        self.run_forwarder(False)


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
        self.post('/prepare', {})
        self.assertEqual(self.bridge.commands[-1]['action'], 'shutdown')


class LibraryTest(unittest.TestCase):
    def test_recovery_copy_survives_restart_and_rejects_stale_browser_state(self):
        with tempfile.TemporaryDirectory() as folder:
            app = App.__new__(App); app.shadow_path = Path(folder)/'state.json'; app.shadow=None
            latest = dict(version=1, tracks={'spotify:local:a:b:c:10':{'raw':'[00:01.00]A'}}, bookmarks=[], settings={'theme':'plum'}, modifiedAt=200)
            self.assertIsNone(app.renderer_state(latest))
            restarted = App.__new__(App); restarted.shadow_path=app.shadow_path; restarted.shadow=json.loads(app.shadow_path.read_text())
            older = {**latest, 'tracks':{}, 'modifiedAt':100}
            self.assertEqual(restarted.renderer_state(older), latest)
            self.assertEqual(json.loads(app.shadow_path.read_text()), latest)
            removed = {**latest, 'tracks':{}, 'modifiedAt':300}
            self.assertIsNone(restarted.renderer_state(removed))
            self.assertEqual(json.loads(app.shadow_path.read_text())['tracks'], {})

    def test_auto_lookup_checks_duration_and_accepts_identical_copies(self):
        with tempfile.TemporaryDirectory() as folder:
            a, b = Path(folder)/'Song mix.mp3', Path(folder)/'copy'/'Song mix.mp3'
            b.parent.mkdir(); a.write_bytes(b'same audio'); b.write_bytes(b'same audio')
            item = dict(title='Song', artist='Artist', duration=120000)
            def inspect(path): return dict(path=str(path),title='Song',artist='Artist',duration=120)
            with patch.object(library, 'inspect', inspect):
                self.assertEqual(library.discover(item, [folder]), str(a.resolve()))
                self.assertIsNone(library.discover({**item,'duration':240000}, [folder]))
                b.write_bytes(b'other take')
                self.assertIsNone(library.discover(item, [folder]))

    def test_ambiguous_match_is_not_auto_selected_and_explicit_mapping_wins(self):
        with tempfile.TemporaryDirectory() as folder:
            a, b = Path(folder)/'a.mp3', Path(folder)/'b.mp3'; a.write_bytes(b'a'); b.write_bytes(b'b')
            rows = [dict(path=str(p), title='Song', artist='Artist', duration=120) for p in (a,b)]
            item = dict(uri='spotify:local:a:b:c:120', title='Song', artist='Artist', duration=120000)
            self.assertIsNone(library.match(rows, item))
            rows[0]['uri'] = item['uri']; self.assertEqual(library.match(rows, item), str(a.resolve()))
            a.unlink(); self.assertEqual(library.match(rows, item), str(b.resolve()))

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
