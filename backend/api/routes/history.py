"""
History Routes
==============
Exposes the training history JSON so you can track how
model performance has changed over time.

  GET /history/metrics              — all models, all runs
  GET /history/metrics/{model_name} — one specific model
                                      e.g. /history/metrics/regression
                                           /history/metrics/trend
                                           /history/metrics/lstm_forecast
"""

import json
import sys
import numpy as np
import pandas as pd
from pathlib import Path
from fastapi import APIRouter, HTTPException, Query

sys.path.insert(0, str(Path(__file__).resolve().parents[2]))

from data.fetch_data import fetch_recent_data
from utils.aqi_calculator import compute_aqi, pm25_bp, pm10_bp, no2_bp, so2_bp

router = APIRouter(prefix="/history", tags=["History"])

# Path to the training history file saved by history_manager.py
HISTORY_FILE = Path(__file__).resolve().parents[2] / "model_history" / "training_history.json"


@router.get("/metrics")
def get_all_metrics():
    """
    Return the full training history for all models.
    Each entry includes dataset size, MAE, RMSE, R2, and timestamp.
    """
    if not HISTORY_FILE.exists():
        raise HTTPException(status_code=404, detail="Training history file not found.")

    with open(HISTORY_FILE, "r") as f:
        return json.load(f)


@router.get("/metrics/{model_name}")
def get_model_metrics(model_name: str):
    """
    Return training history for a specific model.
    Valid model names: regression, trend, lstm_forecast, forecast_xgboost
    """
    if not HISTORY_FILE.exists():
        raise HTTPException(status_code=404, detail="Training history file not found.")

    with open(HISTORY_FILE, "r") as f:
        history = json.load(f)

    # Check the model name exists in the history
    if model_name not in history:
        raise HTTPException(
            status_code=404,
            detail=f"Model '{model_name}' not found. Available models: {list(history.keys())}",
        )

    return {model_name: history[model_name]}


@router.get("/sensor")
def get_sensor_history(hours: int = Query(24, description="Time window: 24, 168, 336, or 720")):
    """
    Return historical AQI and PM readings aggregated into chart-ready buckets.
      hours=24  → hourly averages   (~24 points)
      hours=168 → 6-hourly averages (~28 points)
      hours=336 → 12-hourly averages (~28 points)
      hours=720 → daily averages    (~30 points)
    """
    valid = {24, 168, 336, 720}
    if hours not in valid:
        raise HTTPException(status_code=400, detail=f"hours must be one of {valid}")

    try:
        raw = fetch_recent_data(hours=hours)
    except Exception as e:
        raise HTTPException(status_code=503, detail=f"InfluxDB error: {e}")

    if raw is None or raw.empty:
        raise HTTPException(status_code=404, detail="No sensor data available for this period.")

    # Pivot long → wide format
    raw["name"] = raw["name"].astype(str).str.replace(".", "_", regex=False)
    df = (
        raw.pivot_table(index="_time", columns="name", values="value", aggfunc="mean")
        .reset_index()
    )
    df.columns = [str(c).lower() for c in df.columns]
    df = df.rename(columns={"pm2_5": "pm25", "nox": "no2"})
    df["_time"] = pd.to_datetime(df["_time"])
    df = df.sort_values("_time")

    for col in ["pm25", "pm10", "no2", "so2"]:
        if col not in df.columns:
            df[col] = np.nan

    # Clip negatives but keep NaN as-is — don't silently convert missing to 0
    for col in ["pm25", "pm10", "no2", "so2"]:
        df[col] = df[col].where(df[col].isna() | (df[col] >= 0), other=np.nan)

    # Exactly-zero readings on particle sensors = sensor dropout, not real data.
    # A real PM2.5 of 0 µg/m³ is physically impossible in ambient air.
    for col in ["pm25", "pm10"]:
        df[col] = df[col].where(df[col] > 0, other=np.nan)

    # Compute AQI row by row.
    # Rule: at least one PM reading must be valid and > 0 for the row to get an AQI.
    # When the PM sensor is in dropout mode it also sends junk NO2 (~0.03 µg/m³),
    # so we skip AQI entirely for rows with no usable particle data.
    def _row_aqi(r):
        pm25_ok = pd.notna(r.get("pm25")) and r["pm25"] > 0
        pm10_ok = pd.notna(r.get("pm10")) and r["pm10"] > 0
        if not (pm25_ok or pm10_ok):
            return np.nan           # no valid PM data → AQI is unknown

        candidates = []
        if pm25_ok:
            candidates.append(compute_aqi(float(r["pm25"]), pm25_bp))
        if pm10_ok:
            candidates.append(compute_aqi(float(r["pm10"]), pm10_bp))
        # Only add gas readings when they are above instrument noise floor
        if pd.notna(r.get("no2")) and r["no2"] > 1.0:
            candidates.append(compute_aqi(float(r["no2"]),  no2_bp))
        if pd.notna(r.get("so2")) and r["so2"] > 1.0:
            candidates.append(compute_aqi(float(r["so2"]),  so2_bp))
        return max(candidates) if candidates else np.nan

    df["aqi"] = df.apply(_row_aqi, axis=1)

    # Resample frequency based on window
    freq = {24: "1h", 168: "6h", 336: "12h", 720: "1D"}[hours]

    keep = [c for c in ["aqi", "pm25", "pm10", "co2"] if c in df.columns]
    # min_count=1 means the bucket must have at least one real value, not all-NaN
    agg = (
        df.set_index("_time")[keep]
        .resample(freq)
        .mean(numeric_only=True)
        .dropna(how="all")
        .reset_index()
    )

    def _clean(v):
        if v is None or (isinstance(v, float) and np.isnan(v)):
            return None
        return round(float(v), 2)

    data = [
        {"timestamp": row["_time"].isoformat(), **{c: _clean(row.get(c)) for c in keep}}
        for _, row in agg.iterrows()
    ]

    return {"hours": hours, "freq": freq, "data": data}
