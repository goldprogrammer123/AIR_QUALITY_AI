import json
from pathlib import Path
from datetime import datetime

HISTORY_FILE = Path(__file__).resolve().parent.parent / "model_history" / "training_history.json"

def save_metrics(model_name, dataset_size, metrics):

    HISTORY_FILE.parent.mkdir(parents=True, exist_ok=True)

    if HISTORY_FILE.exists():
        with open(HISTORY_FILE, "r") as f:
            history = json.load(f)
    else:
        history = {}

    if model_name not in history:
        history[model_name] = []

    record = {
        "dataset_size": dataset_size,
        "metrics": metrics,
        "timestamp": datetime.now().isoformat()
    }

    history[model_name].append(record)

    with open(HISTORY_FILE, "w") as f:
        json.dump(history, f, indent=4)