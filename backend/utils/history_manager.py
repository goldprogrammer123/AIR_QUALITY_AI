import json
from pathlib import Path
from datetime import datetime

HISTORY_FILE = Path("backend/model_history/training_history.json")

def save_metrics(model_name, dataset_size, metrics):

    # create file if not exists
    if HISTORY_FILE.exists():
        with open(HISTORY_FILE, "r") as f:
            history = json.load(f)
    else:
        history = {}

    # IMPORTANT FIX: auto-create model key
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