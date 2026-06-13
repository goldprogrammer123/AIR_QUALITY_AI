import shutil
from pathlib import Path
from datetime import datetime

BACKUP_DIR = Path(__file__).resolve().parent.parent / "model_history" / "backups"


def backup_model(model_path, model_name):

    model_path = Path(model_path)

    if not model_path.exists():
        print(f"[{model_name}] No old model found. Skipping backup.")
        return

    BACKUP_DIR.mkdir(parents=True, exist_ok=True)

    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    backup_path = BACKUP_DIR / f"{model_name}_{timestamp}.pkl"

    shutil.copy(model_path, backup_path)

    print(f"[{model_name}] Backup created -> {backup_path}")