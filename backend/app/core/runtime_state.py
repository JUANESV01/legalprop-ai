"""Estado de arranque compartido (lo actualiza main.py y lo consulta /health)."""

import threading

_lock = threading.Lock()
_state = {"corpus_ready": False, "last_guest_purge": None}


def set_state(key: str, value) -> None:
    with _lock:
        _state[key] = value


def get_state(key: str, default=None):
    with _lock:
        return _state.get(key, default)
