"""Use the matching official simulator, import library and NWS replay (no device)."""
import argparse
import ctypes
import os
from pathlib import Path
import re
import subprocess

ROOT = Path(__file__).resolve().parents[1]
parser = argparse.ArgumentParser()
parser.add_argument('--epsilon', type=Path, required=True, help='Epsilon checkout root')
parser.add_argument('--app', type=Path, default=ROOT / 'output/sim-current/app.dll')
parser.add_argument('--bin', type=Path, default=ROOT / 'tests/fixtures/gallery.bin')
parser.add_argument('--pages', nargs='+', type=int, default=[0, 2])
parser.add_argument('--output', type=Path, default=ROOT / 'tests/output/simulator')
args = parser.parse_args()
args.output.mkdir(parents=True, exist_ok=True)
events = args.epsilon / 'shared/ion/src/shared/layout_events/epsilon/events_names_extended.inc'
names = re.findall(r'^"([^"]*)",?\s*$', events.read_text(), re.M)
state = args.output / 'capture.nws'
state.write_bytes(b'NWSF**.**.**\x01fr' + bytes([names.index('None')]))
simulator = args.epsilon / 'epsilon/external_apps/epsilon_simulators/windows/epsilon.exe'
if os.name == 'nt':
    ctypes.windll.kernel32.SetErrorMode(0x8003)
for page in args.pages:
    env = os.environ.copy()
    env['MCS_CAPTURE_PAGE'] = str(page)
    screenshot = args.output / f'page-{page + 1}.png'
    result = subprocess.run([str(simulator), '--headless', '--nwb', str(args.app.resolve()),
                             '--nwb-external-data', str(args.bin.resolve()),
                             '--load-state-file', str(state.resolve()),
                             '--take-screenshot', str(screenshot.resolve())],
                            env=env, capture_output=True, timeout=15,
                            creationflags=subprocess.CREATE_NO_WINDOW if os.name == 'nt' else 0)
    if result.returncode or not screenshot.is_file():
        raise SystemExit(f'Simulator capture failed: {result.returncode}, {result.stderr!r}')
    print(f'{screenshot.name}: {screenshot.stat().st_size} bytes')
