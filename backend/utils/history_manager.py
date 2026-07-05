import json
import fcntl
from pathlib import Path
from datetime import datetime, timedelta

HISTORY_FILE = Path(__file__).resolve().parent.parent / "model_history" / "training_history.json"
_LOCK_FILE   = HISTORY_FILE.with_suffix(".lock")


def save_metrics(model_name: str, dataset_size: int, metrics: dict) -> bool:
    """
    Append a training run to the history file.
    Uses an exclusive file lock so parallel training processes cannot corrupt
    the JSON by reading/writing simultaneously.
    Returns True if saved, False only if the exact same metrics were recorded
    less than 30 seconds ago (prevents accidental double-triggers).
    """
    HISTORY_FILE.parent.mkdir(parents=True, exist_ok=True)

    with open(_LOCK_FILE, "w") as lock:
        fcntl.flock(lock, fcntl.LOCK_EX)   # block until we have exclusive access
        try:
            if HISTORY_FILE.exists():
                with open(HISTORY_FILE, "r") as f:
                    history = json.load(f)
            else:
                history = {}

            if model_name not in history:
                history[model_name] = []

            # Skip accidental double-runs (same metrics within 30 s)
            if history[model_name]:
                last    = history[model_name][-1]
                last_ts = datetime.fromisoformat(last["timestamp"])
                if (
                    last["metrics"] == metrics
                    and (datetime.now() - last_ts) < timedelta(seconds=30)
                ):
                    print(f"[history] {model_name}: duplicate run within 30s — skipping.")
                    return False

            history[model_name].append({
                "dataset_size": dataset_size,
                "metrics":      metrics,
                "timestamp":    datetime.now().isoformat(),
            })

            with open(HISTORY_FILE, "w") as f:
                json.dump(history, f, indent=4)

        finally:
            fcntl.flock(lock, fcntl.LOCK_UN)   # always release

    print(f"[history] {model_name}: metrics saved → {HISTORY_FILE}")
    return True