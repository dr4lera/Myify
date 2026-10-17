"""Loopback-only renderer bridge. No Spotify cookies or account tokens are read."""
import json
import secrets
import threading
import time
import os
import re
import socket
from pathlib import Path
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

ORIGINS = {'https://xpui.app.spotify.com', 'https://xpui.spotify.com'}


def load_config(data_root):
    """Bootstrap a direct tools launch without overwriting an install's secret."""
    folder = Path(data_root)
    folder.mkdir(parents=True, exist_ok=True)
    path = folder / 'bridge.json'
    for attempt in range(50):
        try:
            config = json.loads(path.read_text(encoding='utf-8-sig'))
        except FileNotFoundError:
            with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as listener:
                listener.bind(('127.0.0.1', 0))
                port = listener.getsockname()[1]
            config = {'token': secrets.token_hex(32), 'port': port}
            try:
                descriptor = os.open(path, os.O_CREAT | os.O_EXCL | os.O_WRONLY, 0o600)
            except FileExistsError:
                continue
            with os.fdopen(descriptor, 'w', encoding='utf-8') as output:
                json.dump(config, output)
                output.flush()
                os.fsync(output.fileno())
            return config
        except json.JSONDecodeError:
            # Another launcher can see the exclusively created file while its
            # first writer is finishing. Never replace an existing valid secret.
            if attempt < 49:
                time.sleep(0.05)
                continue
            raise ValueError(f'Myify connection settings are incomplete: {path}. Run setup again to repair them.') from None
        if not isinstance(config, dict) or not isinstance(config.get('token'), str) or not re.fullmatch(r'[a-fA-F0-9]{64}', config['token']) \
                or type(config.get('port')) is not int or not 1024 <= config['port'] <= 65535:
            raise ValueError(f'Myify connection settings are invalid: {path}. Run setup again to repair them.')
        return config
    raise ValueError(f'Myify could not initialize its connection settings: {path}. Try starting it again.')


class Bridge:
    def __init__(self, token, dispatch, library, compatibility, state_store=lambda value: None):
        self.token, self.dispatch = token, dispatch
        self.library, self.compatibility = library, compatibility
        self.state_store = state_store
        self.snapshot = {}
        self.commands = []
        self.lock = threading.Lock()
        self.last_seen = 0
        self.status = 'Open Spotify using the Myify shortcut to connect.'

    def send(self, action, **values):
        with self.lock:
            if len(self.commands) >= 100:
                raise ValueError('Spotify is disconnected; reopen it before sending more controls.')
            self.commands.append({'id': secrets.token_hex(12), 'action': action, **values})

    def sync(self, data):
        if not isinstance(data, dict) or not isinstance(data.get('acks', []), list):
            raise ValueError('Invalid sync body.')
        acks = set(str(value) for value in data.get('acks', []))
        with self.lock:
            self.snapshot = {key: data.get(key) for key in ('uri', 'title', 'artist', 'position', 'duration', 'paused', 'line', 'volume')}
            self.last_seen = time.monotonic()
            self.commands = [command for command in self.commands if command['id'] not in acks]
            return {'commands': list(self.commands), 'status': self.status, 'compatibility': self.compatibility(), 'restore': self.state_store(data.get('state'))}


def serve(bridge, port):
    class Handler(BaseHTTPRequestHandler):
        def log_message(self, *args):
            pass

        def allowed(self):
            return self.headers.get('Host') == f'127.0.0.1:{self.server.server_port}' and self.headers.get('Origin') in ORIGINS

        def reply(self, code, data):
            raw = json.dumps(data).encode('utf-8')
            self.send_response(code)
            origin = self.headers.get('Origin')
            if origin in ORIGINS:
                self.send_header('Access-Control-Allow-Origin', origin)
                self.send_header('Vary', 'Origin')
            self.send_header('Cache-Control', 'no-store')
            self.send_header('Content-Type', 'application/json; charset=utf-8')
            self.send_header('Content-Length', str(len(raw)))
            self.end_headers()
            self.wfile.write(raw)

        def do_OPTIONS(self):
            if not self.allowed():
                return self.reply(403, {'error': 'Origin rejected'})
            self.send_response(204)
            self.send_header('Access-Control-Allow-Origin', self.headers['Origin'])
            self.send_header('Access-Control-Allow-Methods', 'POST, OPTIONS')
            self.send_header('Access-Control-Allow-Headers', 'Authorization, Content-Type')
            self.send_header('Access-Control-Allow-Private-Network', 'true')
            self.end_headers()

        def do_POST(self):
            if not self.allowed() or not secrets.compare_digest(self.headers.get('Authorization', ''), 'Bearer ' + bridge.token):
                return self.reply(403, {'error': 'Authorization rejected'})
            try:
                length = int(self.headers.get('Content-Length', '0'))
                if length < 2 or length > 32 * 1024 * 1024:
                    raise ValueError('Request is too large or empty.')
                data = json.loads(self.rfile.read(length))
                if self.path == '/sync':
                    result = bridge.sync(data)
                elif self.path == '/open':
                    action = data.get('action')
                    if action not in ('mini', 'generate', 'library', 'show', 'quit'):
                        raise ValueError('Unknown tool.')
                    bridge.dispatch.put((action, dict(data)))
                    result = {'ok': True, 'pid': os.getpid()}
                elif self.path == '/library':
                    result = bridge.library(None)
                elif self.path == '/restore':
                    result = bridge.library(data)
                elif self.path == '/prepare':
                    bridge.send('shutdown')
                    result = {'ok': True}
                else:
                    return self.reply(404, {'error': 'Unknown endpoint'})
                self.reply(200, result)
            except (ValueError, TypeError, KeyError) as exc:
                self.reply(400, {'error': str(exc)})
    server = ThreadingHTTPServer(('127.0.0.1', port), Handler)
    server.daemon_threads = True
    threading.Thread(target=server.serve_forever, daemon=True).start()
    return server
