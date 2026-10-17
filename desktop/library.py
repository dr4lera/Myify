"""Local music inventory and conservative, reversible tag editing."""
import hashlib
import json
import shutil
import re
from pathlib import Path

AUDIO = {'.mp3', '.flac', '.m4a', '.ogg', '.opus', '.wav', '.aac', '.wma', '.aiff'}


def fingerprint(path):
    digest = hashlib.sha256()
    with Path(path).open('rb') as stream:
        for block in iter(lambda: stream.read(1024 * 1024), b''):
            digest.update(block)
    return digest.hexdigest()


def inspect(path):
    from mutagen import File
    path = Path(path).resolve()
    audio = File(path, easy=True)
    def text(key):
        return str((audio.get(key) or [''])[0]) if audio else ''
    return {'path': str(path), 'title': text('title') or path.stem,
            'artist': text('artist'), 'album': text('album'),
            'duration': round(audio.info.length, 2) if audio else 0,
            'size': path.stat().st_size}


def scan(folder, previous=()):
    """Keep missing rows so rescans can report moved/deleted files."""
    rows = {row['path']: dict(row) for row in previous}
    errors = []
    for path in Path(folder).rglob('*'):
        if path.suffix.lower() not in AUDIO or not path.is_file():
            continue
        try:
            row = inspect(path)
            rows[row['path']] = row
        except Exception as exc:
            errors.append(f'{path}: {exc}')
    return list(rows.values()), errors


def duplicates(rows):
    by_size = {}
    for row in rows:
        path = Path(row['path'])
        if path.is_file():
            by_size.setdefault(path.stat().st_size, []).append(path)
    hashes = {}
    for paths in by_size.values():
        if len(paths) > 1:
            for path in paths:
                hashes.setdefault(fingerprint(path), []).append(str(path))
    return [paths for paths in hashes.values() if len(paths) > 1]


def match(rows, item):
    """Never silently choose between ambiguous local files."""
    exact = [row for row in rows if row.get('uri') == item.get('uri') and Path(row['path']).is_file()]
    if len(exact) == 1:
        return exact[0]['path']
    title, artist = item.get('title', '').casefold().strip(), item.get('artist', '').casefold().strip()
    candidates = [row for row in rows if row.get('title', '').casefold().strip() == title
                  and (not artist or row.get('artist', '').casefold().strip() == artist)
                  and abs(row.get('duration', 0) - item.get('duration', 0) / 1000) < 3
                  and Path(row['path']).is_file()]
    return choose_identical([row['path'] for row in candidates])


def choose_identical(paths):
    paths = list(dict.fromkeys(str(Path(path).resolve()) for path in paths))
    if len(paths) == 1:
        return paths[0]
    if len(paths) > 1 and len({Path(path).stat().st_size for path in paths}) == 1:
        if len({fingerprint(path) for path in paths}) == 1:
            return paths[0]
    return None


def discover(item, roots):
    """Find filename candidates cheaply, then verify tags and track duration."""
    normalize = lambda text: re.sub(r'[^\w]', '', text.casefold())
    title = normalize(item.get('title', ''))
    if len(title) < 4:
        return None
    candidates = []
    for root in dict.fromkeys(str(Path(root)) for root in roots):
        if not Path(root).is_dir():
            continue
        for path in Path(root).rglob('*'):
            if path.suffix.lower() not in AUDIO or not path.is_file() or title not in normalize(path.stem):
                continue
            try:
                row = inspect(path)
                if abs(row['duration'] - item.get('duration', 0) / 1000) >= 3:
                    continue
                artist = item.get('artist', '').casefold().strip()
                if artist and row['artist'].casefold().strip() != artist:
                    continue
                if normalize(row['title']) == title or normalize(path.stem).startswith(title):
                    candidates.append(row['path'])
            except (OSError, ValueError):
                continue
    return choose_identical(candidates)


def edit_tags(path, values, backup_root, artwork=None):
    """Back up original bytes before modifying supported MP3/FLAC metadata."""
    from mutagen import File
    from mutagen.flac import FLAC, Picture
    from mutagen.id3 import ID3, ID3NoHeaderError, TIT2, TPE1, TALB, APIC
    path = Path(path).resolve()
    if path.suffix.lower() not in {'.mp3', '.flac'}:
        raise ValueError('Metadata editing currently supports MP3 and FLAC. Other formats can be scanned and transcribed.')
    image = None
    if artwork:
        image = Path(artwork).read_bytes()
        if len(image) > 8 * 1024 * 1024:
            raise ValueError('Artwork must be smaller than 8 MB.')
        mime = 'image/png' if image.startswith(b'\x89PNG\r\n\x1a\n') else 'image/jpeg' if image.startswith(b'\xff\xd8\xff') else None
        if not mime:
            raise ValueError('Choose a PNG or JPEG image.')
    backup_root = Path(backup_root)
    backup_root.mkdir(parents=True, exist_ok=True)
    backup = backup_root / (fingerprint(path) + path.suffix.lower())
    if not backup.exists():
        shutil.copy2(path, backup)
    manifest = backup.with_suffix(backup.suffix + '.json')
    manifest.write_text(json.dumps({'original': str(path), 'backup': str(backup)}, indent=2), encoding='utf-8')
    if path.suffix.lower() == '.mp3':
        try:
            tags = ID3(path)
        except ID3NoHeaderError:
            tags = ID3()
        for key, cls in [('title', TIT2), ('artist', TPE1), ('album', TALB)]:
            tags.add(cls(encoding=3, text=[str(values.get(key, ''))]))
        if image is not None:
            tags.delall('APIC')
            tags.add(APIC(encoding=3, mime=mime, type=3, desc='Cover', data=image))
        tags.save(path)
    else:
        tags = FLAC(path)
        for key in ('title', 'artist', 'album'):
            tags[key] = [str(values.get(key, ''))]
        if image is not None:
            picture = Picture(); picture.type = 3; picture.mime = mime; picture.data = image
            tags.clear_pictures(); tags.add_picture(picture)
        tags.save()
    return str(backup)
