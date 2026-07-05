import json
import fcntl
import sys
from pathlib import Path
from datetime import datetime, timedelta

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

HISTORY_FILE = Path(__file__).resolve().parent.parent / "model_history" / "training_history.json"
_LOCK_FILE   = HISTORY_FILE.with_suffix(".lock")


def save_metrics(model_name: str, dataset_size: int, metrics: dict, sensor: str = "unknown") -> bool:
    """
    Append a training run to the JSON history file (backup) AND write to PostgreSQL.
    Returns True if saved, False if duplicate within 30 seconds.
    """
    HISTORY_FILE.parent.mkdir(parents=True, exist_ok=True)

    # ── 1. JSON backup (file-locked for parallel safety) ──────────────────
    with open(_LOCK_FILE, "w") as lock:
        fcntl.flock(lock, fcntl.LOCK_EX)
        try:
            history = {}
            if HISTORY_FILE.exists():
                with open(HISTORY_FILE, "r") as f:
                    history = json.load(f)

            if model_name not in history:
                history[model_name] = []

            # Duplicate guard (30 s window)
            if history[model_name]:
                last    = history[model_name][-1]
                last_ts = datetime.fromisoformat(last["timestamp"])
                if (
                    last["metrics"] == metrics
                    and (datetime.now() - last_ts) < timedelta(seconds=30)
                ):
                    print(f"[history] {model_name}: duplicate run within 30s — skipping.")
                    return False

            entry = {
                "dataset_size": dataset_size,
                "metrics":      metrics,
                "sensor":       sensor,
                "timestamp":    datetime.now().isoformat(),
            }
            history[model_name].append(entry)

            with open(HISTORY_FILE, "w") as f:
                json.dump(history, f, indent=4)

        finally:
            fcntl.flock(lock, fcntl.LOCK_UN)

    print(f"[history] {model_name} ({sensor}): saved to JSON backup.")

    # ── 2. PostgreSQL write ────────────────────────────────────────────────
    try:
        from db.database import SessionLocal
        from db.models import ModelHistory

        db = SessionLocal()
        try:
            row = ModelHistory(
                model_name=model_name,
                sensor=sensor,
                dataset_size=dataset_size,
                r2=metrics.get("r2"),
                mae=metrics.get("mae"),
                rmse=metrics.get("rmse"),
                trained_at=datetime.now(),
            )
            db.add(row)
            db.commit()
            print(f"[history] {model_name} ({sensor}): saved to PostgreSQL.")
        finally:
            db.close()
    except Exception as e:
        print(f"[history] PostgreSQL write failed (JSON backup still saved): {e}")

    return True
