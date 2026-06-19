# pipelines/train_pipeline.py
#
# Orchestrates the full training pipeline:
#   1. Refresh the data cache (if >24 h old)
#   2. Train regression, trend, and LSTM models in sequence
#   3. Write a clean timestamped summary to retrain.log (max 300 lines kept)

import subprocess
import sys
import time
from datetime import datetime
from pathlib import Path

BACKEND_DIR = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(BACKEND_DIR))

LOG_FILE  = BACKEND_DIR / "model_history" / "retrain.log"
MAX_LINES = 300  # keep the log from growing forever

# ─────────────────────────────────────────────────────────────
# Log rotation — trim to the newest MAX_LINES lines on startup
# ─────────────────────────────────────────────────────────────
if LOG_FILE.exists():
    lines = LOG_FILE.read_text(encoding="utf-8", errors="replace").splitlines()
    if len(lines) > MAX_LINES:
        LOG_FILE.write_text("\n".join(lines[-MAX_LINES:]) + "\n", encoding="utf-8")

def log(msg: str):
    """Print to stdout (captured by cron) and to the log file."""
    print(msg)
    with open(LOG_FILE, "a", encoding="utf-8") as f:
        f.write(msg + "\n")

# ─────────────────────────────────────────────────────────────
# Run header
# ─────────────────────────────────────────────────────────────
RUN_START = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
log("")
log("=" * 60)
log(f"  TRAINING RUN — {RUN_START}")
log("=" * 60)

# ─────────────────────────────────────────────────────────────
# Data cache refresh
# ─────────────────────────────────────────────────────────────
from data.fetch_data import fetch_raw_data

cache_file = BACKEND_DIR / "data" / "cache" / "raw_data.parquet"
CACHE_MAX_AGE = 24 * 60 * 60  # 24 hours

cache_stale = (
    not cache_file.exists()
    or (time.time() - cache_file.stat().st_mtime) > CACHE_MAX_AGE
)

if cache_stale:
    log("Fetching latest data from InfluxDB…")
    df = fetch_raw_data()
    cache_file.parent.mkdir(parents=True, exist_ok=True)
    df.to_parquet(cache_file, index=False)
    log(f"Cache updated — {len(df):,} rows")
else:
    age_h = (time.time() - cache_file.stat().st_mtime) / 3600
    log(f"Data cache OK (age: {age_h:.1f}h)")

# ─────────────────────────────────────────────────────────────
# Train each model — capture output, surface only key lines
# ─────────────────────────────────────────────────────────────
SCRIPTS = [
    BACKEND_DIR / "models" / "train_regression.py",
    BACKEND_DIR / "models" / "train_trend.py",
    BACKEND_DIR / "models" / "train_lstm_forecast.py",
]

# Lines that contain useful information worth keeping in the log
KEEP_KEYWORDS = [
    "[history]", "saved", "MAE", "RMSE", "R2", "R²",
    "accuracy", "Accuracy", "Targets", "dataset",
    "WARNING", "Error", "Traceback", "ERROR",
]

all_ok = True
for script in SCRIPTS:
    t0 = time.time()
    log(f"\n── {script.name} ──")
    result = subprocess.run(
        [sys.executable, str(script)],
        cwd=str(BACKEND_DIR),
        capture_output=True,
        text=True,
    )
    elapsed = time.time() - t0

    # Surface only meaningful lines from the script's output
    for raw_line in (result.stdout + result.stderr).splitlines():
        line = raw_line.strip()
        if not line:
            continue
        if any(kw in line for kw in KEEP_KEYWORDS):
            log(f"  {line}")

    if result.returncode != 0:
        log(f"  ✗ FAILED (exit {result.returncode}) — see lines above")
        all_ok = False
    else:
        log(f"  ✓ done in {elapsed:.1f}s")

# ─────────────────────────────────────────────────────────────
# Run footer
# ─────────────────────────────────────────────────────────────
status = "SUCCESS" if all_ok else "FAILED"
log(f"\n{'=' * 60}")
log(f"  {status} — {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
log(f"{'=' * 60}\n")

if not all_ok:
    sys.exit(1)
