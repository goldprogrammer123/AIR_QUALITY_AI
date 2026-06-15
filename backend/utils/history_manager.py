import json
from pathlib import Path
from datetime import datetime

HISTORY_FILE = Path(__file__).resolve().parent.parent / "model_history" / "training_history.json"


def save_metrics(model_name: str, dataset_size: int, metrics: dict) -> bool:
    """
    Append a training run to the history file.
    Returns True if saved, False if metrics were identical to the previous run
    (avoids cluttering history when data cache hasn't changed).
    """
    HISTORY_FILE.parent.mkdir(parents=True, exist_ok=True)

    if HISTORY_FILE.exists():
        with open(HISTORY_FILE, "r") as f:
            history = json.load(f)
    else:
        history = {}

    if model_name not in history:
        history[model_name] = []

    # Skip saving if metrics are exactly the same as the last recorded run
    # This prevents duplicate entries when the 24h data cache hasn't refreshed
    if history[model_name]:
        last = history[model_name][-1]
        if (
            last["dataset_size"] == dataset_size
            and last["metrics"] == metrics
        ):
            print(f"[history] {model_name}: metrics unchanged since last run — skipping duplicate entry.")
            return False

    record = {
        "dataset_size": dataset_size,
        "metrics": metrics,
        "timestamp": datetime.now().isoformat(),
    }

    history[model_name].append(record)

    with open(HISTORY_FILE, "w") as f:
        json.dump(history, f, indent=4)

    print(f"[history] {model_name}: saved metrics → {HISTORY_FILE}")
    return True