#!/usr/bin/env python3
"""
Carla Bridge — headless Carla engine controlled via stdin/stdout JSON-RPC.
Used by the guitar-pedalboard Electron app so native LV2/VST3 plugins
can process audio through JACK/PipeWire without requiring a Carla GUI.

Protocol:
  IN  (from Node.js): { "id": <int>, "type": "<cmd>", ...args }
  OUT (to Node.js):   { "type": "reply",  "id": <int>, "data": {...} }
                      { "type": "error",  "id": <int>, "message": "<str>" }
                      { "type": "ready" }        — emitted on startup
"""
import sys
import os
import json
import signal
import threading
import time

CARLA_SHARE = '/usr/share/carla'
CARLA_LIB   = '/usr/lib/carla/libcarla_standalone2.so'

sys.path.insert(0, CARLA_SHARE)

def _send(obj: dict) -> None:
    sys.stdout.write(json.dumps(obj) + '\n')
    sys.stdout.flush()

def _err(msg: str, req_id: int | None = None) -> None:
    _send({'type': 'error', 'id': req_id, 'message': str(msg)})

# ── Import Carla Python backend ────────────────────────────────────────────────
try:
    from carla_backend import (
        CarlaHostDLL,
        BINARY_NATIVE,
        PLUGIN_LADSPA,
        PLUGIN_LV2,
        PLUGIN_VST2,
        PLUGIN_VST3,
        ENGINE_OPTION_PROCESS_MODE,
        ENGINE_OPTION_AUDIO_DRIVER,
        ENGINE_OPTION_AUDIO_DEVICE,
        ENGINE_OPTION_AUDIO_BUFFER_SIZE,
        ENGINE_OPTION_AUDIO_SAMPLE_RATE,
        ENGINE_OPTION_OSC_ENABLED,
        ENGINE_PROCESS_MODE_CONTINUOUS_RACK,
    )
except Exception as exc:
    _err(f'Cannot import carla_backend from {CARLA_SHARE}: {exc}')
    sys.exit(1)

if not os.path.exists(CARLA_LIB):
    _err(f'Carla shared library not found: {CARLA_LIB}')
    sys.exit(1)

# ── Bridge class ───────────────────────────────────────────────────────────────
class CarlaBridge:
    def __init__(self) -> None:
        self._carla: CarlaHostDLL | None = None
        self._running = False
        self._idle_thread: threading.Thread | None = None
        self._plugin_count = 0

    # -- lifecycle -------------------------------------------------------------

    def init(self, driver: str = 'JACK', device: str = '',
             buffer_size: int = 256, sample_rate: int = 44100) -> tuple[bool, str]:
        try:
            self._carla = CarlaHostDLL(CARLA_LIB, False)
        except Exception as exc:
            return False, f'Cannot load {CARLA_LIB}: {exc}'

        c = self._carla
        c.set_engine_option(ENGINE_OPTION_OSC_ENABLED,      0,           '')
        c.set_engine_option(ENGINE_OPTION_PROCESS_MODE,     ENGINE_PROCESS_MODE_CONTINUOUS_RACK, '')
        c.set_engine_option(ENGINE_OPTION_AUDIO_DRIVER,     0,           driver)
        c.set_engine_option(ENGINE_OPTION_AUDIO_BUFFER_SIZE, buffer_size, '')
        c.set_engine_option(ENGINE_OPTION_AUDIO_SAMPLE_RATE, sample_rate, '')
        if device:
            c.set_engine_option(ENGINE_OPTION_AUDIO_DEVICE, 0, device)

        if not c.engine_init(driver, 'GuitarPedalboard'):
            err_msg = c.get_last_error()
            self._carla = None
            return False, f'Engine init failed: {err_msg}'

        self._running = True
        self._idle_thread = threading.Thread(target=self._idle_loop, daemon=True)
        self._idle_thread.start()
        return True, ''

    def _idle_loop(self) -> None:
        while self._running and self._carla is not None:
            try:
                self._carla.engine_idle()
            except Exception:
                pass
            time.sleep(0.033)

    def shutdown(self) -> None:
        self._running = False
        if self._carla is not None:
            try:
                self._carla.engine_close()
            except Exception:
                pass
            self._carla = None

    # -- plugin management -----------------------------------------------------

    _TYPE_MAP = {
        'ladspa': PLUGIN_LADSPA,
        'lv2':    PLUGIN_LV2,
        'vst2':   PLUGIN_VST2,
        'vst':    PLUGIN_VST2,
        'vst3':   PLUGIN_VST3,
    }

    def add_plugin(self, plugin_type: str, binary: str, name: str,
                   label: str, unique_id: int = 0) -> tuple[int | None, str]:
        if self._carla is None:
            return None, 'Engine not running'
        ptype = self._TYPE_MAP.get(plugin_type.lower())
        if ptype is None:
            return None, f'Unknown plugin type: {plugin_type}'

        ok = self._carla.add_plugin(BINARY_NATIVE, ptype, binary, name, label, unique_id, None)
        if not ok:
            return None, self._carla.get_last_error()

        pid = self._carla.get_current_plugin_count() - 1
        self._plugin_count = self._carla.get_current_plugin_count()
        return pid, ''

    def remove_plugin(self, plugin_id: int) -> bool:
        if self._carla is None:
            return False
        ok = self._carla.remove_plugin(plugin_id)
        if ok:
            self._plugin_count = self._carla.get_current_plugin_count()
        return ok

    def set_parameter(self, plugin_id: int, param_id: int, value: float) -> None:
        if self._carla is not None:
            self._carla.set_parameter_value(plugin_id, param_id, value)

    def set_active(self, plugin_id: int, active: bool) -> None:
        if self._carla is not None:
            self._carla.set_active(plugin_id, active)

    def get_parameters(self, plugin_id: int) -> list[dict]:
        if self._carla is None:
            return []
        count = self._carla.get_parameter_count(plugin_id)
        params = []
        for i in range(count):
            try:
                info   = self._carla.get_parameter_info(plugin_id, i)
                data   = self._carla.get_parameter_data(plugin_id, i)
                ranges = self._carla.get_parameter_ranges(plugin_id, i)
                value  = self._carla.get_current_parameter_value(plugin_id, i)
                # Skip output parameters (bit 0x01 in hints = IS_OUTPUT)
                hints = data.get('hints', 0) if isinstance(data, dict) else getattr(data, 'hints', 0)
                if hints & 0x01:
                    continue
                params.append({
                    'id':      i,
                    'name':    info.get('name', '') if isinstance(info, dict) else getattr(info, 'name', ''),
                    'symbol':  info.get('symbol', '') if isinstance(info, dict) else getattr(info, 'symbol', ''),
                    'unit':    info.get('unit', '') if isinstance(info, dict) else getattr(info, 'unit', ''),
                    'value':   float(value),
                    'min':     float(ranges.get('min', 0) if isinstance(ranges, dict) else getattr(ranges, 'min', 0)),
                    'max':     float(ranges.get('max', 1) if isinstance(ranges, dict) else getattr(ranges, 'max', 1)),
                    'default': float(ranges.get('def', 0) if isinstance(ranges, dict) else getattr(ranges, 'def', 0)),
                })
            except Exception:
                continue
        return params

    def plugin_count(self) -> int:
        if self._carla is None:
            return 0
        return self._carla.get_current_plugin_count()


# ── Global bridge instance ─────────────────────────────────────────────────────
bridge = CarlaBridge()

# ── Command dispatcher ─────────────────────────────────────────────────────────
def handle(cmd: dict) -> None:
    t      = cmd.get('type', '')
    req_id = cmd.get('id')

    def reply(data: dict, error: str | None = None) -> None:
        _send({'type': 'reply', 'id': req_id, 'data': data, 'error': error})

    if t == 'init':
        ok, msg = bridge.init(
            driver      = cmd.get('driver', 'JACK'),
            device      = cmd.get('device', ''),
            buffer_size = int(cmd.get('bufferSize', 256)),
            sample_rate = int(cmd.get('sampleRate', 44100)),
        )
        reply({'ok': ok}, msg if not ok else None)

    elif t == 'add_plugin':
        pid, err = bridge.add_plugin(
            cmd.get('pluginType', 'lv2'),
            cmd.get('binary', ''),
            cmd.get('name', ''),
            cmd.get('label', ''),
            int(cmd.get('uniqueId', 0)),
        )
        reply({'pluginId': pid}, err if pid is None else None)

    elif t == 'remove_plugin':
        ok = bridge.remove_plugin(int(cmd['pluginId']))
        reply({'ok': ok})

    elif t == 'set_param':
        bridge.set_parameter(int(cmd['pluginId']), int(cmd['paramId']), float(cmd['value']))
        reply({'ok': True})

    elif t == 'set_active':
        bridge.set_active(int(cmd['pluginId']), bool(cmd.get('active', True)))
        reply({'ok': True})

    elif t == 'get_params':
        params = bridge.get_parameters(int(cmd['pluginId']))
        reply({'params': params})

    elif t == 'status':
        reply({
            'running':     bridge._running,
            'pluginCount': bridge.plugin_count(),
        })

    elif t == 'shutdown':
        reply({'ok': True})
        bridge.shutdown()
        sys.exit(0)

    else:
        _err(f'Unknown command: {t!r}', req_id)


# ── Signal handlers ────────────────────────────────────────────────────────────
def _on_signal(signum, frame):  # type: ignore[no-untyped-def]
    bridge.shutdown()
    sys.exit(0)

signal.signal(signal.SIGTERM, _on_signal)
signal.signal(signal.SIGINT,  _on_signal)

# ── Main: read JSON commands from stdin ────────────────────────────────────────
_send({'type': 'ready'})

for raw_line in sys.stdin:
    line = raw_line.strip()
    if not line:
        continue
    try:
        cmd = json.loads(line)
        handle(cmd)
    except json.JSONDecodeError as exc:
        _err(f'Invalid JSON: {exc}')
    except Exception as exc:
        _err(f'Unhandled error: {exc}')
