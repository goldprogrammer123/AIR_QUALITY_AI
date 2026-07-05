# pipelines/train_pipeline.py
#
# Two-phase training:
#   Phase 1 — regression + trend for BOTH sensors in parallel  (fast RF, ~30s each)
#   Phase 2 — LSTM for lands, then planning SEQUENTIALLY       (CPU-only; parallel causes contention)

import sys
import time
import subprocess
from datetime import datetime
from multiprocessing import Process, Queue
from pathlib import Path

BACKEND_DIR = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(BACKEND_DIR))

LOG_FILE  = BACKEND_DIR / "model_history" / "retrain.log"
MAX_LINES = 300
SENSORS   = ["lands", "planning"]

RF_SCRIPTS   = [
    BACKEND_DIR / "models" / "train_regression.py",
    BACKEND_DIR / "models" / "train_trend.py",
]
LSTM_SCRIPT  = BACKEND_DIR / "models" / "train_lstm_forecast.py"

KEEP_KEYWORDS = [
    "saved", "MAE", "RMSE", "R2", "R²",
    "accuracy", "Accuracy", "Targets", "dataset",
    "Regression", "Trend", "LSTM",
    "WARNING", "Error", "Traceback", "ERROR",
]

# ── Log rotation ──────────────────────────────────────────────
if LOG_FILE.exists():
    lines = LOG_FILE.read_text(encoding="utf-8", errors="replace").splitlines()
    if len(lines) > MAX_LINES:
        LOG_FILE.write_text("\n".join(lines[-MAX_LINES:]) + "\n", encoding="utf-8")


def log(msg: str):
    print(msg)
    with open(LOG_FILE, "a", encoding="utf-8") as f:
        f.write(msg + "\n")


def run_script(script: Path, sensor: str) -> dict:
    """Run one training script for one sensor; return result dict."""
    t0   = time.time()
    proc = subprocess.run(
        [sys.executable, str(script), "--sensor", sensor],
        cwd=str(BACKEND_DIR),
        capture_output=True,
        text=True,
    )
    elapsed = time.time() - t0
    lines = [
        f"    {l.strip()}"
        for l in (proc.stdout + proc.stderr).splitlines()
        if l.strip() and any(kw in l for kw in KEEP_KEYWORDS)
    ]
    return {"script": script.name, "ok": proc.returncode == 0, "elapsed": elapsed, "lines": lines}


def log_result(sensor: str, result: dict):
    log(f"  {result['script']}")
    for line in result["lines"]:
        log(line)
    status = f"✓ done in {result['elapsed']:.1f}s" if result["ok"] else "✗ FAILED"
    log(f"    {status}")


# ── Run header ────────────────────────────────────────────────
RUN_START = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
log("")
log("=" * 60)
log(f"  TRAINING RUN — {RUN_START}")
log("=" * 60)

# ── Data cache refresh ────────────────────────────────────────
from data.fetch_data import fetch_raw_data_for_sensor

for sensor in SENSORS:
    cache_file    = BACKEND_DIR / "data" / "cache" / f"raw_data_{sensor}.parquet"
    CACHE_MAX_AGE = 24 * 60 * 60
    cache_stale   = (
        not cache_file.exists()
        or (time.time() - cache_file.stat().st_mtime) > CACHE_MAX_AGE
    )
    if cache_stale:
        log(f"Fetching data for '{sensor}' from InfluxDB…")
        df = fetch_raw_data_for_sensor(sensor)
        cache_file.parent.mkdir(parents=True, exist_ok=True)
        df.to_parquet(cache_file, index=False)
        log(f"  '{sensor}' cache updated — {len(df):,} rows")
    else:
        age_h = (time.time() - cache_file.stat().st_mtime) / 3600
        log(f"  '{sensor}' cache OK (age: {age_h:.1f}h)")


# ════════════════════════════════════════════════════════════════
# PHASE 1 — Regression + Trend in parallel across both sensors
# ════════════════════════════════════════════════════════════════
def _rf_worker(sensor: str, q: Queue):
    results = []
    all_ok  = True
    for script in RF_SCRIPTS:
        r = run_script(script, sensor)
        results.append(r)
        if not r["ok"]:
            all_ok = False
    q.put({"sensor": sensor, "all_ok": all_ok, "results": results})


log("\nPhase 1 — Regression + Trend (parallel across sensors)…")
q1 = Queue()
procs = [Process(target=_rf_worker, args=(s, q1)) for s in SENSORS]
for p in procs: p.start()
for p in procs: p.join()

overall_ok = True
for _ in SENSORS:
    data = q1.get()
    log(f"\n  ── Sensor: {data['sensor']} ──")
    for r in data["results"]:
        log_result(data["sensor"], r)
    if not data["all_ok"]:
        overall_ok = False


# ════════════════════════════════════════════════════════════════
# PHASE 2 — LSTM sequentially (avoids CPU contention)
# ════════════════════════════════════════════════════════════════
log("\nPhase 2 — LSTM forecast (sequential to avoid CPU contention)…")
for sensor in SENSORS:
    log(f"\n  ── LSTM: {sensor} ──")
    r = run_script(LSTM_SCRIPT, sensor)
    log_result(sensor, r)
    if not r["ok"]:
        overall_ok = False


# ── Footer ───────────────────────────────────────────────────
status = "SUCCESS" if overall_ok else "FAILED"
log(f"\n{'=' * 60}")
log(f"  {status} — {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
log(f"{'=' * 60}\n")

if not overall_ok:
    sys.exit(1)
