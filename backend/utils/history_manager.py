import json
from pathlib import Path
from datetime import datetime, timedelta

HISTORY_FILE = Path(__file__).resolve().parent.parent / "model_history" / "training_history.json"


def save_metrics(model_name: str, dataset_size: int, metrics: dict) -> bool:
    """
    Append a training run to the history file.
    Returns True if saved, False only if the exact same metrics were recorded
    less than 30 seconds ago (prevents accidental double-triggers from the
    same training session — e.g. running the script twice in quick succession).
    Every intentional retraining is always saved.
    """
    HISTORY_FILE.parent.mkdir(parents=True, exist_ok=True)

    if HISTORY_FILE.exists():
        with open(HISTORY_FILE, "r") as f:
            history = json.load(f)
    else:
        history = {}

    if model_name not in history:
        history[model_name] = []

    # Only skip if it looks like an accidental double-run (same metrics within 30s)
    if history[model_name]:
        last = history[model_name][-1]
        last_ts = datetime.fromisoformat(last["timestamp"])
        if (
            last["metrics"] == metrics
            and (datetime.now() - last_ts) < timedelta(seconds=30)
        ):
            print(f"[history] {model_name}: duplicate run within 30s — skipping.")
            return False

    record = {
        "dataset_size": dataset_size,
        "metrics": metrics,
        "timestamp": datetime.now().isoformat(),
    }

    history[model_name].append(record)

    with open(HISTORY_FILE, "w") as f:
        json.dump(history, f, indent=4)

    print(f"[history] {model_name}: metrics saved → {HISTORY_FILE}")
    return True