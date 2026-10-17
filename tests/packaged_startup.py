"""Exercise a built Windows desktop EXE with no pre-existing profile/config."""
import argparse
import json
import os
from pathlib import Path
import subprocess
import tempfile
import time
import urllib.request


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('executable', type=Path)
    args = parser.parse_args()
    executable = args.executable.resolve()
    lab_parent = Path(__file__).resolve().parents[1] / '.test-lab'
    lab_parent.mkdir(exist_ok=True)
    with tempfile.TemporaryDirectory(prefix='packaged-startup-', dir=lab_parent) as folder:
        root = Path(folder)
        local = root / 'empty profile' / 'Local'
        config_path = local / 'SpotifyNativeEnhancerData' / 'bridge.json'
        assert not config_path.exists()
        environment = dict(os.environ, LOCALAPPDATA=str(local))
        processes = []
        config = None

        def post(action):
            request = urllib.request.Request(
                f"http://127.0.0.1:{config['port']}/open",
                json.dumps({'action': action}).encode(),
                headers={'Origin': 'https://xpui.app.spotify.com', 'Content-Type': 'application/json',
                         'Authorization': 'Bearer ' + config['token']})
            with urllib.request.urlopen(request, timeout=3) as response:
                return json.load(response)

        with (root / 'runtime.log').open('wb') as log:
            try:
                first = subprocess.Popen([str(executable)], env=environment, stdout=log, stderr=log)
                processes.append(first)
                deadline = time.monotonic() + 25
                while time.monotonic() < deadline:
                    if first.poll() is not None:
                        raise AssertionError(f'Fresh-profile tools exited early: {first.returncode}')
                    try:
                        config = json.loads(config_path.read_text(encoding='utf-8-sig'))
                        owner = post('show')['pid']
                        break
                    except (OSError, ValueError, KeyError):
                        time.sleep(0.2)
                else:
                    raise AssertionError('Fresh-profile executable did not create a usable bridge')
                original = config_path.read_bytes()
                for flags in ([], ['--hidden']):
                    forwarder = subprocess.Popen([str(executable), *flags], env=environment, stdout=log, stderr=log)
                    processes.append(forwarder)
                    assert forwarder.wait(timeout=15) == 0, 'Repeated tools launch failed'
                    assert first.poll() is None, 'Repeated launch closed the original tools'
                    assert post('show')['pid'] == owner, 'Repeated launch created another server'
                    assert config_path.read_bytes() == original, 'Repeated launch replaced the secret'
                post('quit')
                assert first.wait(timeout=15) == 0, 'Tools did not close cleanly'
                print('PASS: packaged direct EXE startup with absent default data folder/config; visible and hidden repeat launches exit; one server and preserved secret; clean quit.')
            finally:
                if config:
                    try:
                        post('quit')
                    except Exception:
                        pass
                for process in processes:
                    if process.poll() is None:
                        process.terminate()
                        process.wait(timeout=10)


if __name__ == '__main__':
    main()
