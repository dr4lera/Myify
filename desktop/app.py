# SPDX-License-Identifier: GPL-2.0-or-later
"""Myify desktop tools, mini-player and offline lyrics in one process."""
import argparse
import json
import os
import queue
import sys
import threading
import time
import math
from pathlib import Path
import tkinter as tk
from tkinter import ttk, filedialog, messagebox
from tkinter.scrolledtext import ScrolledText

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'lrc-maker'))
from lrc_engine import MODELS, load_model, transcribe, save_unique, Cancelled
from bridge import Bridge, serve
import library

VERSION = '0.4.0'


class App:
    def __init__(self, root, data_root, config, hidden=False):
        self.root, self.data = root, Path(data_root)
        self.data.mkdir(parents=True, exist_ok=True)
        self.db_path = self.data / 'library.json'
        self.db_lock = threading.Lock()
        self.db = {'version': 1, 'files': [], 'folders': []}
        if self.db_path.exists():
            try:
                self.db = self.validate_db(json.loads(self.db_path.read_text(encoding='utf-8-sig')))
            except Exception:
                self.db_path.replace(self.data / ('library-invalid-' + str(time.time_ns()) + '.json'))
        self.events = queue.Queue()
        self.stop = threading.Event()
        self.busy = False
        self.closed = False
        self.bridge = Bridge(config['token'], self.events, self.library_api, self.compatibility)
        self.bridge.status = 'Ready. Generate lyrics uses the included local English model.'
        self.server = serve(self.bridge, config['port'])
        root.title('Myify')
        root.geometry('900x720')
        root.minsize(700, 580)
        style = ttk.Style(); style.theme_use('clam')
        style.configure('.', font=('Segoe UI', 10), background='#182120', foreground='#f1f6f3')
        style.configure('TButton', padding=(10, 7))
        style.configure('TEntry', fieldbackground='#fff', foreground='#101817')
        style.configure('Treeview', background='#101817', fieldbackground='#101817', foreground='#f1f6f3', rowheight=28)
        style.map('Treeview', background=[('selected', '#315945')])
        root.configure(bg='#182120')
        head = ttk.Frame(root, padding=(20, 14)); head.pack(fill='x')
        ttk.Label(head, text='Myify', font=('Segoe UI', 24, 'bold')).pack(side='left')
        self.status = tk.StringVar(value='Waiting for Spotify…')
        ttk.Label(head, textvariable=self.status, wraplength=600).pack(side='right')
        self.tabs = ttk.Notebook(root); self.tabs.pack(fill='both', expand=True, padx=16, pady=(0,16))
        self.player_tab = ttk.Frame(self.tabs, padding=20)
        self.gen_tab = ttk.Frame(self.tabs, padding=20)
        self.library_tab = ttk.Frame(self.tabs, padding=20)
        self.tabs.add(self.player_tab, text='Now playing')
        self.tabs.add(self.gen_tab, text='Lyrics generator')
        self.tabs.add(self.library_tab, text='Local library')
        self.make_player(); self.make_generator(); self.make_library()
        root.protocol('WM_DELETE_WINDOW', self.hide)
        if hidden: root.withdraw()
        root.after(100, self.poll)

    @staticmethod
    def validate_db(value):
        if not isinstance(value, dict) or value.get('version') != 1 or not isinstance(value.get('files'), list):
            raise ValueError('Invalid Myify library backup.')
        rows = []
        for row in value['files'][:100000]:
            if not isinstance(row, dict) or not isinstance(row.get('path'), str):
                raise ValueError('Invalid library entry.')
            clean = {key: str(row[key])[:32768] for key in ('path', 'title', 'artist', 'album', 'uri') if key in row}
            for key in ('duration', 'size'):
                number = row.get(key, 0)
                if not isinstance(number, (int, float)) or not math.isfinite(number) or number < 0:
                    raise ValueError('Invalid library duration or size.')
                clean[key] = number
            rows.append(clean)
        return {'version': 1, 'files': rows, 'folders': [str(x) for x in value.get('folders', [])[:1000]]}

    def persist(self):
        temporary = self.db_path.with_suffix('.new')
        temporary.write_text(json.dumps(self.db, ensure_ascii=False, indent=2), encoding='utf-8')
        temporary.replace(self.db_path)

    def library_api(self, value):
        with self.db_lock:
            if value is not None:
                other = self.validate_db(value)
                merged = {row['path']: row for row in self.db['files']}
                merged.update({row['path']: row for row in other['files']})
                self.db = {'version': 1, 'files': list(merged.values()), 'folders': list(dict.fromkeys(self.db['folders'] + other['folders']))}
                self.persist()
                self.events.put(('refresh', {}))
            return json.loads(json.dumps(self.db))

    def compatibility(self):
        if hasattr(self, '_compat_cache') and time.monotonic() - self._compat_cache[0] < 5:
            return self._compat_cache[1]
        receipt = self.data / 'installation.json'
        result = {'myify': VERSION, 'supportedSpotify': '1.3.5.3058', 'installedSpotify': 'Unknown', 'supported': False}
        try:
            value = json.loads(receipt.read_text(encoding='utf-8-sig'))
            exe = Path(value['spotifyRoot']) / 'Spotify.exe'
            # File version is checked live, rather than trusting a stale receipt.
            if os.name == 'nt' and exe.is_file():
                import ctypes
                size = ctypes.windll.version.GetFileVersionInfoSizeW(str(exe), None)
                buffer = ctypes.create_string_buffer(size)
                if not size or not ctypes.windll.version.GetFileVersionInfoW(str(exe), 0, size, buffer):
                    raise OSError('Cannot read Spotify version')
                pointer = ctypes.c_void_p(); length = ctypes.c_uint()
                if not ctypes.windll.version.VerQueryValueW(buffer, '\\', ctypes.byref(pointer), ctypes.byref(length)):
                    raise OSError('No version resource')
                words = ctypes.cast(pointer, ctypes.POINTER(ctypes.c_uint32))
                result['installedSpotify'] = '.'.join(str(x) for x in (words[2] >> 16, words[2] & 65535, words[3] >> 16, words[3] & 65535))
                result['supported'] = result['installedSpotify'] == result['supportedSpotify']
        except (OSError, ValueError, KeyError):
            pass
        self._compat_cache = (time.monotonic(), result)
        return result

    def send(self, action, **values):
        try:
            if time.monotonic() - self.bridge.last_seen > 5:
                raise ValueError('Open Spotify from the Myify shortcut first.')
            self.bridge.send(action, **values)
        except Exception as exc:
            messagebox.showinfo('Myify', str(exc), parent=self.root)

    def make_player(self):
        self.title = tk.StringVar(value='Nothing playing')
        self.artist = tk.StringVar()
        self.line = tk.StringVar(value='Imported or generated lyrics appear here.')
        self.position = tk.StringVar(value='0:00 / 0:00')
        ttk.Label(self.player_tab, textvariable=self.title, font=('Segoe UI', 20, 'bold'), wraplength=760).pack(anchor='w')
        ttk.Label(self.player_tab, textvariable=self.artist).pack(anchor='w', pady=8)
        ttk.Label(self.player_tab, textvariable=self.position).pack(anchor='w')
        controls = ttk.Frame(self.player_tab); controls.pack(fill='x', pady=18)
        for name, action in [('Previous', 'previous'), ('−10 s', 'back'), ('Play / pause', 'toggle'), ('+10 s', 'forward'), ('Next', 'next')]:
            ttk.Button(controls, text=name, command=lambda a=action: self.send(a)).pack(side='left', padx=3)
        ttk.Label(self.player_tab, textvariable=self.line, wraplength=760, font=('Segoe UI', 20), justify='center').pack(fill='both', expand=True, pady=20)
        ttk.Button(self.player_tab, text='Open compact mini-player', command=self.show_mini).pack(anchor='w')
        ttk.Button(self.player_tab, text='Generate lyrics for current local song', command=self.generate_current).pack(anchor='w', pady=8)
        ttk.Button(self.player_tab, text='Quit desktop tools', command=self.quit).pack(anchor='e')

    def show_mini(self):
        if hasattr(self, 'mini') and self.mini.winfo_exists():
            self.mini.deiconify(); self.mini.lift(); return
        self.mini = tk.Toplevel(self.root); self.mini.title('Myify mini-player')
        self.mini.geometry('430x280'); self.mini.minsize(350, 220); self.mini.attributes('-topmost', True)
        frame = ttk.Frame(self.mini, padding=16); frame.pack(fill='both', expand=True)
        ttk.Label(frame, textvariable=self.title, font=('Segoe UI', 13, 'bold'), wraplength=395).pack(fill='x')
        ttk.Label(frame, textvariable=self.artist, wraplength=395).pack(fill='x')
        ttk.Label(frame, textvariable=self.line, wraplength=395, justify='center').pack(fill='both', expand=True, pady=12)
        ttk.Label(frame, textvariable=self.position).pack()
        row = ttk.Frame(frame); row.pack(pady=6)
        for name, action in [('◀', 'previous'), ('Play / pause', 'toggle'), ('▶', 'next')]:
            ttk.Button(row, text=name, command=lambda a=action: self.send(a)).pack(side='left', padx=3)
        pinned = tk.BooleanVar(value=True)
        ttk.Checkbutton(frame, text='Always on top', variable=pinned, command=lambda: self.mini.attributes('-topmost', pinned.get())).pack()

    def make_generator(self):
        self.files = []
        self.model = tk.StringVar(value='base.en')
        self.language = tk.StringVar(value='en')
        self.gen_status = tk.StringVar(value='English base.en and small.en are included and work offline.')
        row = ttk.Frame(self.gen_tab); row.pack(fill='x')
        ttk.Button(row, text='Add audio files', command=self.add_audio).pack(side='left')
        ttk.Button(row, text='Use current local song', command=self.generate_current).pack(side='left', padx=8)
        self.file_label = tk.StringVar(value='No files selected')
        ttk.Label(self.gen_tab, textvariable=self.file_label, wraplength=760).pack(anchor='w', pady=12)
        row = ttk.Frame(self.gen_tab); row.pack(fill='x', pady=8)
        ttk.Label(row, text='Model').pack(side='left')
        ttk.Combobox(row, textvariable=self.model, values=MODELS, state='readonly', width=16).pack(side='left', padx=8)
        ttk.Label(row, text='Language').pack(side='left')
        ttk.Combobox(row, textvariable=self.language, values=('Auto','en','es','fr','de','it','pt','ja','ko','zh','ru','ar','hi'), width=8, state='readonly').pack(side='left', padx=8)
        self.offline = tk.BooleanVar(value=True)
        ttk.Checkbutton(row, text='Offline only', variable=self.offline).pack(side='left')
        row = ttk.Frame(self.gen_tab); row.pack(fill='x', pady=8)
        ttk.Button(row, text='Generate LRC', command=self.start_generation).pack(side='left')
        ttk.Button(row, text='Cancel', command=self.stop.set).pack(side='left', padx=8)
        ttk.Button(row, text='Open output folder', command=self.open_output).pack(side='right')
        self.bar = ttk.Progressbar(self.gen_tab, mode='indeterminate'); self.bar.pack(fill='x', pady=8)
        ttk.Label(self.gen_tab, textvariable=self.gen_status, wraplength=760).pack(anchor='w')
        self.preview = ScrolledText(self.gen_tab, bg='#101817', fg='#f1f6f3', insertbackground='white', font=('Consolas', 10), height=10)
        self.preview.pack(fill='both', expand=True, pady=12)
        row = ttk.Frame(self.gen_tab); row.pack(fill='x')
        ttk.Button(row, text='Save edited LRC as…', command=self.save_preview).pack(side='left')
        ttk.Button(row, text='Attach preview to current song', command=self.attach_preview).pack(side='left', padx=8)
        ttk.Label(self.gen_tab, text='Recognition may miss or invent words. Review the result in the lyrics editor. Audio stays on this PC.', wraplength=760).pack(anchor='w', pady=8)

    def output_folder(self):
        folder = self.data / 'lyrics'; folder.mkdir(exist_ok=True); return folder

    def open_output(self):
        os.startfile(self.output_folder())

    def add_audio(self):
        if self.busy: return
        values = filedialog.askopenfilenames(parent=self.root, title='Choose local audio', filetypes=[('Audio', '*.mp3 *.flac *.wav *.m4a *.ogg *.opus *.aac *.aiff *.wma')])
        self.files = list(dict.fromkeys(self.files + list(values)))
        self.file_label.set('\n'.join(Path(p).name for p in self.files))

    def generate_current(self, item=None, located=False, resolved=None):
        if self.busy or getattr(self, 'locating', False):
            self.bridge.status = 'A lyrics job is already running. Progress is shown here.'; return
        item = item or dict(self.bridge.snapshot)
        if not str(item.get('uri', '')).startswith('spotify:local:'):
            self.show('generate')
            messagebox.showinfo('Local lyrics', 'Select a local song in Spotify. Myify transcribes your own audio files; it does not download Spotify streams.', parent=self.root)
            return
        with self.db_lock:
            path = resolved or library.match(self.db['files'], item)
            roots = list(self.db['folders']) + [str(Path.home() / 'Music')]
        if not path and not located:
            self.locating = True; self.bridge.status = 'Locating current audio in Music and saved folders…'
            def locate():
                try: found = library.discover(item, roots)
                except Exception: found = None
                self.events.put(('located', {'item': item, 'path': found}))
            threading.Thread(target=locate, daemon=True).start()
            return
        if not path:
            path = filedialog.askopenfilename(parent=self.root, initialdir=str(Path.home() / 'Music'), title='Locate audio for: ' + str(item.get('title', 'current song')), filetypes=[('Audio', '*.mp3 *.flac *.wav *.m4a *.ogg *.opus *.aac *.aiff *.wma')])
            if not path: return
        if path:
            row = library.inspect(path); row['uri'] = item['uri']
            with self.db_lock:
                self.db['files'] = [x for x in self.db['files'] if x['path'] != row['path']] + [row]
                self.persist()
            self.refresh_library()
        self.files = [path]; self.file_label.set(path)
        self.start_generation(target=item['uri'])

    def start_generation(self, target=None):
        if self.busy: return
        if not self.files:
            self.add_audio()
            if not self.files: return
        model, language, offline = self.model.get(), self.language.get(), self.offline.get()
        if model.endswith('.en') and language not in ('en', 'Auto'):
            return messagebox.showerror('Language', 'Choose a multilingual model for this language.', parent=self.root)
        self.busy = True; self.stop.clear(); self.bar.start(12)
        files, folder = list(self.files), self.output_folder()
        def worker():
            notify = lambda text: self.events.put(('gen-status', text))
            try:
                engine = load_model(model, self.data / 'models', offline, notify)
                for file in files:
                    if self.stop.is_set(): raise Cancelled()
                    text, detected = transcribe(engine, file, language, self.stop, notify)
                    output = save_unique(folder, Path(file).stem, text)
                    self.events.put(('generated', {'text': text, 'path': str(output), 'target': target, 'audio': file}))
                self.events.put(('gen-done', 'Finished. LRC files saved in ' + str(folder)))
            except Cancelled:
                self.events.put(('gen-done', 'Cancelled. Completed files were kept.'))
            except Exception as exc:
                self.events.put(('gen-error', str(exc)))
        threading.Thread(target=worker, daemon=True).start()

    def save_preview(self):
        text = self.preview.get('1.0', 'end-1c')
        if not text.strip(): return
        path = filedialog.asksaveasfilename(parent=self.root, defaultextension='.lrc', filetypes=[('LRC', '*.lrc')])
        if path: Path(path).write_text(text, encoding='utf-8')

    def attach_preview(self):
        text = self.preview.get('1.0', 'end-1c')
        uri = self.bridge.snapshot.get('uri')
        if uri and text.strip():
            self.send('attach', uri=uri, raw=text, file='generated.lrc')

    def make_library(self):
        row = ttk.Frame(self.library_tab); row.pack(fill='x', pady=(0,12))
        for name, command in [('Add folder', self.add_folder), ('Rescan', self.rescan), ('Find duplicates', self.find_duplicates), ('Edit metadata / artwork', self.edit_selected)]:
            ttk.Button(row, text=name, command=command).pack(side='left', padx=3)
        self.tree = ttk.Treeview(self.library_tab, columns=('artist','state','path'), show='tree headings')
        self.tree.heading('#0', text='Title'); self.tree.heading('artist', text='Artist'); self.tree.heading('state', text='Status'); self.tree.heading('path', text='File')
        self.tree.column('#0', width=200); self.tree.column('artist', width=140); self.tree.column('state', width=65); self.tree.column('path', width=310)
        self.tree.pack(fill='both', expand=True)
        scroll = ttk.Scrollbar(self.library_tab, orient='horizontal', command=self.tree.xview); scroll.pack(fill='x'); self.tree.configure(xscrollcommand=scroll.set)
        ttk.Label(self.library_tab, text='Missing files stay listed. Duplicate scans compare complete file bytes and never delete anything.\nMP3 / FLAC tag edits keep an original copy under Myify’s metadata-backups folder. Spotify may need a rescan.', wraplength=760).pack(anchor='w', pady=12)
        ttk.Button(self.library_tab, text='Open metadata backups', command=self.open_backups).pack(anchor='w')
        self.refresh_library()

    def refresh_library(self):
        for child in self.tree.get_children(): self.tree.delete(child)
        with self.db_lock:
            for index, row in enumerate(self.db['files']):
                self.tree.insert('', 'end', iid=str(index), text=row.get('title', Path(row['path']).stem), values=(row.get('artist', ''), 'Ready' if Path(row['path']).is_file() else 'Missing', row['path']))

    def add_folder(self):
        folder = filedialog.askdirectory(parent=self.root, title='Choose a local music folder')
        if folder:
            with self.db_lock:
                self.db['folders'] = list(dict.fromkeys(self.db['folders'] + [folder])); self.persist()
            self.rescan()

    def rescan(self):
        if getattr(self, 'scanning', False): return
        self.scanning = True; self.status.set('Scanning local files…')
        def worker():
            try:
                with self.db_lock: rows, folders = list(self.db['files']), list(self.db['folders'])
                errors = []
                for folder in folders:
                    rows, problems = library.scan(folder, rows); errors.extend(problems)
                with self.db_lock:
                    # Keep explicit song mappings across metadata rescans.
                    mappings = {r['path']: r.get('uri') for r in self.db['files']}
                    for row in rows:
                        if mappings.get(row['path']): row['uri'] = mappings[row['path']]
                    self.db['files'] = rows; self.persist()
                self.events.put(('scan-done', f'Scanned {len(rows)} files. {len(errors)} unreadable.'))
            except Exception as exc: self.events.put(('scan-done', str(exc)))
        threading.Thread(target=worker, daemon=True).start()

    def find_duplicates(self):
        with self.db_lock: rows = list(self.db['files'])
        self.status.set('Comparing duplicate candidates…')
        def worker():
            try: self.events.put(('duplicates', library.duplicates(rows)))
            except Exception as exc: self.events.put(('error', str(exc)))
        threading.Thread(target=worker, daemon=True).start()

    def edit_selected(self):
        selected = self.tree.selection()
        if not selected: return
        with self.db_lock: row = dict(self.db['files'][int(selected[0])])
        dialog = tk.Toplevel(self.root); dialog.title('Edit local metadata'); dialog.geometry('540x350')
        frame = ttk.Frame(dialog, padding=20); frame.pack(fill='both', expand=True)
        ttk.Label(frame, text=Path(row['path']).name, wraplength=480).pack(anchor='w', pady=6)
        fields = {}
        for key in ('title', 'artist', 'album'):
            ttk.Label(frame, text=key.title()).pack(anchor='w')
            value = tk.StringVar(value=row.get(key, '')); fields[key] = value
            ttk.Entry(frame, textvariable=value).pack(fill='x', pady=4)
        artwork = tk.StringVar()
        def choose_art():
            path = filedialog.askopenfilename(parent=dialog, filetypes=[('Artwork', '*.jpg *.jpeg *.png')])
            if path: artwork.set(path)
        ttk.Button(frame, text='Choose cover image', command=choose_art).pack(anchor='w', pady=6)
        def commit():
            try:
                backup = library.edit_tags(row['path'], {key: value.get() for key,value in fields.items()}, self.data / 'metadata-backups', artwork.get() or None)
                updated = library.inspect(row['path'])
                if row.get('uri'): updated['uri'] = row['uri']
                with self.db_lock:
                    self.db['files'] = [updated if r['path'] == row['path'] else r for r in self.db['files']]; self.persist()
                self.refresh_library(); dialog.destroy()
                self.status.set('Metadata saved. Original backup: ' + backup)
            except Exception as exc: messagebox.showerror('Metadata', str(exc), parent=dialog)
        ttk.Button(frame, text='Save with original backup', command=commit).pack(anchor='e')

    def open_backups(self):
        folder = self.data / 'metadata-backups'; folder.mkdir(exist_ok=True); os.startfile(folder)

    def show(self, tool='show'):
        self.root.deiconify(); self.root.lift()
        self.tabs.select(self.gen_tab if tool == 'generate' else self.library_tab if tool == 'library' else self.player_tab)

    def hide(self):
        self.root.withdraw()

    def quit(self):
        self.stop.set(); self.server.shutdown(); self.closed = True; self.root.destroy()

    @staticmethod
    def clock(value):
        seconds = max(0, int((value or 0) / 1000)); return f'{seconds//60}:{seconds%60:02d}'

    def poll(self):
        if self.closed: return
        try:
            while True:
                kind, value = self.events.get_nowait()
                if kind == 'mini': self.show_mini()
                elif kind == 'quit': self.quit(); return
                elif kind == 'library': self.show('library'); self.refresh_library()
                elif kind == 'show': self.show()
                elif kind == 'generate': self.generate_current(value.get('item'))
                elif kind == 'located':
                    self.locating = False
                    self.generate_current(value['item'], located=True, resolved=value['path'])
                elif kind == 'refresh': self.refresh_library()
                elif kind == 'gen-status': self.gen_status.set(value); self.bridge.status = value
                elif kind == 'generated':
                    self.preview.delete('1.0', 'end'); self.preview.insert('1.0', value['text'])
                    if value['target']:
                        self.bridge.send('attach', uri=value['target'], raw=value['text'], file=Path(value['path']).name, path=value['audio'])
                elif kind in ('gen-done', 'gen-error'):
                    self.busy = False; self.bar.stop(); self.gen_status.set(value); self.bridge.status = value
                    if kind == 'gen-error': messagebox.showerror('Lyrics generation', value, parent=self.root)
                elif kind == 'scan-done': self.scanning = False; self.refresh_library(); self.status.set(value)
                elif kind == 'duplicates':
                    dialog = tk.Toplevel(self.root); dialog.title('Exact duplicate files'); dialog.geometry('760x460')
                    text = ScrolledText(dialog, wrap='word'); text.pack(fill='both', expand=True)
                    text.insert('1.0', '\n\n'.join('\n'.join(group) for group in value) if value else 'No byte-identical duplicates found. Different encodings or tags are not counted.')
                    text.configure(state='disabled')
                elif kind == 'error': messagebox.showerror('Myify', value, parent=self.root)
        except queue.Empty: pass
        except Exception as exc: self.status.set(str(exc))
        item = dict(self.bridge.snapshot)
        connected = time.monotonic() - self.bridge.last_seen < 5
        self.title.set(item.get('title') or 'Nothing playing')
        self.artist.set(item.get('artist') or '')
        self.line.set(item.get('line') or 'Import or generate synchronized lyrics in Myify.')
        self.position.set(self.clock(item.get('position')) + ' / ' + self.clock(item.get('duration')))
        if not self.busy and not getattr(self, 'scanning', False): self.status.set('Spotify connected' if connected else 'Open Spotify using the Myify shortcut to connect.')
        self.root.after(200, self.poll)


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--data-root', default=str(Path(os.environ.get('LOCALAPPDATA', str(Path.home()))) / 'SpotifyNativeEnhancerData'))
    parser.add_argument('--hidden', action='store_true')
    parser.add_argument('--self-test', action='store_true')
    parser.add_argument('--report')
    args = parser.parse_args()
    if args.self_test:
        from lrc_engine import bundled_model, valid_model
        result = {'version': VERSION, 'base.en': valid_model(bundled_model('base.en') or ''), 'small.en': valid_model(bundled_model('small.en') or '')}
        import mutagen; import faster_whisper; import av
        result['imports'] = True
        if args.report: Path(args.report).write_text(json.dumps(result), encoding='utf-8')
        if not all(result[k] for k in ('base.en','small.en','imports')): raise SystemExit(1)
        return
    config_file = Path(args.data_root) / 'bridge.json'
    config = json.loads(config_file.read_text(encoding='utf-8-sig'))
    root = tk.Tk()
    try:
        app = App(root, args.data_root, config, args.hidden)
    except OSError:
        # A single instance owns the port. Show it through the existing bridge.
        if args.hidden:
            root.destroy(); return
        import urllib.request
        request = urllib.request.Request(f"http://127.0.0.1:{config['port']}/open", json.dumps({'action': 'show'}).encode(), headers={'Origin': 'https://xpui.app.spotify.com', 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + config['token']})
        try: urllib.request.urlopen(request, timeout=2).close()
        except Exception: messagebox.showerror('Myify', 'The desktop tools port is in use. Close the old Myify tools and relaunch.')
        root.destroy(); return
    root.mainloop()


if __name__ == '__main__':
    main()
