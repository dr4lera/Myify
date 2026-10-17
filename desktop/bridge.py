"""Loopback-only renderer bridge. No Spotify cookies or account tokens are read."""
import json
import secrets
import threading
import time
import os
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

ORIGINS = {'https://xpui.app.spotify.com', 'https://xpui.spotify.com'}


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
