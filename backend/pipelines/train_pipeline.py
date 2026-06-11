import subprocess
import sys
from pathlib import Path
import os

sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

BASE_DIR = Path(__file__).resolve().parent.parent

scripts = [
    BASE_DIR / "models" / "train_regression.py",
    BASE_DIR / "models" / "train_trend.py",
    BASE_DIR / "models" / "train_forecast.py",
]

for script in scripts:
    print(f"\nRunning {script.name}")
    subprocess.run(
        [sys.executable, str(script)],
        check=True
    )

print("\nAll models trained successfully!")