import os
import shutil
from datetime import datetime

BACKUP_DIR = "backend/model_history/backups"


def backup_model(model_path, model_name):

    if not os.path.exists(model_path):
        print(f"[{model_name}] No old model found. Skipping backup.")
        return

    os.makedirs(BACKUP_DIR, exist_ok=True)

    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")

    backup_path = os.path.join(
        BACKUP_DIR,
        f"{model_name}_{timestamp}.pkl"
    )

    shutil.copy(model_path, backup_path)

    print(f"[{model_name}] Backup created -> {backup_path}")