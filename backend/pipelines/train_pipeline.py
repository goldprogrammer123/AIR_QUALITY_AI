# pipelines/train_pipeline.py

import subprocess
import sys
from pathlib import Path

# =====================================================
# BACKEND ROOT (FIXED ROOT)
# =====================================================
BACKEND_DIR = Path(__file__).resolve().parents[1]

# ensure backend is importable
sys.path.insert(0, str(BACKEND_DIR))

# =====================================================
# IMPORTS (AFTER FIXING PATH)
# =====================================================
from data.fetch_data import fetch_raw_data

# =====================================================
# CACHE PATH
# =====================================================
cache_file = BACKEND_DIR / "data" / "cache" / "raw_data.parquet"

# =====================================================
# FETCH ONLY IF CACHE NOT EXISTS
# =====================================================
if not cache_file.exists():
    print("\nFetching data from InfluxDB...")

    df = fetch_raw_data()

    cache_file.parent.mkdir(parents=True, exist_ok=True)
    df.to_parquet(cache_file, index=False)

    print(f"Cache created: {cache_file}")
    print(f"Rows: {len(df)}")

else:
    print("\nUsing cached data.")

# =====================================================
# TRAIN MODELS
# =====================================================
scripts = [
    BACKEND_DIR / "models" / "train_regression.py",
    BACKEND_DIR / "models" / "train_trend.py",
    BACKEND_DIR / "models" / "train_forecast.py",
]

for script in scripts:
    print(f"\nRunning {script.name}")

    subprocess.run(
        [sys.executable, str(script)],
        cwd=str(BACKEND_DIR),   # 🔥 IMPORTANT FIX
        check=True
    )

print("\nAll models trained successfully.")