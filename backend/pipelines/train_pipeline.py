# pipelines/train_pipeline.py

import subprocess
import sys
import time
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
# FETCH IF CACHE IS MISSING OR OLDER THAN 24 HOURS
# Daily cron job triggers a fresh InfluxDB pull;
# manual mid-day runs reuse the existing cache.
# =====================================================
CACHE_MAX_AGE_SECONDS = 24 * 60 * 60  # 24 hours

cache_is_stale = (
    not cache_file.exists() or
    (time.time() - cache_file.stat().st_mtime) > CACHE_MAX_AGE_SECONDS
)

if cache_is_stale:
    print("\nFetching latest data from InfluxDB...")
    df = fetch_raw_data()
    cache_file.parent.mkdir(parents=True, exist_ok=True)
    df.to_parquet(cache_file, index=False)
    print(f"Cache updated — total rows: {len(df)}")
else:
    age_hours = (time.time() - cache_file.stat().st_mtime) / 3600
    print(f"\nUsing cached data (age: {age_hours:.1f}h — refresh after 24h).")

# =====================================================
# TRAIN MODELS
# =====================================================
scripts = [
    BACKEND_DIR / "models" / "train_regression.py",
    BACKEND_DIR / "models" / "train_trend.py",
    BACKEND_DIR / "models" / "train_lstm_forecast.py",
]

for script in scripts:
    print(f"\nRunning {script.name}")

    subprocess.run(
        [sys.executable, str(script)],
        cwd=str(BACKEND_DIR),   # 🔥 IMPORTANT FIX
        check=True
    )

print("\nAll models trained successfully.")