"""
History Routes
==============
  GET  /history/metrics              — all model runs (DB, admin only)
  GET  /history/metrics/download     — CSV download filtered by range (admin only)
  GET  /history/metrics/{model_name} — one specific model (DB, admin only)
  GET  /history/sensor               — AQI/PM sensor history from InfluxDB
"""

import io
import json
import sys
import numpy as np
import pandas as pd
from datetime import datetime, timedelta
from pathlib import Path
from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session

sys.path.insert(0, str(Path(__file__).resolve().parents[2]))

from data.fetch_data import fetch_recent_data
from utils.aqi_calculator import compute_aqi, pm25_bp, pm10_bp, no2_bp, so2_bp
from utils.auth_utils import require_admin
from db.database import get_db
from db.models import ModelHistory

router = APIRouter(prefix="/history", tags=["History"])

HISTORY_FILE = Path(__file__).resolve().parents[2] / "model_history" / "training_history.json"


def _range_cutoff(range_str: str) -> datetime:
    cutoffs = {"day": timedelta(days=1), "week": timedelta(weeks=1), "month": timedelta(days=30)}
    delta = cutoffs.get(range_str, timedelta(weeks=1))
    return datetime.utcnow() - delta


def _rows_to_list(rows):
    return [
        {
            "id":           r.id,
            "model_name":   r.model_name,
            "sensor":       r.sensor,
            "dataset_size": r.dataset_size,
            "r2":           r.r2,
            "mae":          r.mae,
            "rmse":         r.rmse,
            "trained_at":   r.trained_at.isoformat(),
        }
        for r in rows
    ]


@router.get("/metrics")
def get_all_metrics(
    range: str = Query("week", description="day | week | month"),
    db: Session = Depends(get_db),
    _admin = Depends(require_admin),
):
    cutoff = _range_cutoff(range)
    rows = (
        db.query(ModelHistory)
        .filter(ModelHistory.trained_at >= cutoff)
        .order_by(ModelHistory.trained_at.desc())
        .all()
    )
    return {"range": range, "count": len(rows), "runs": _rows_to_list(rows)}


@router.get("/metrics/download")
def download_metrics(
    range: str = Query("week", description="day | week | month"),
    db: Session = Depends(get_db),
    _admin = Depends(require_admin),
):
    cutoff = _range_cutoff(range)
    rows = (
        db.query(ModelHistory)
        .filter(ModelHistory.trained_at >= cutoff)
        .order_by(ModelHistory.trained_at.asc())
        .all()
    )

    df = pd.DataFrame([
        {
            "model_name":   r.model_name,
            "sensor":       r.sensor,
            "dataset_size": r.dataset_size,
            "r2":           r.r2,
            "mae":          r.mae,
            "rmse":         r.rmse,
            "trained_at":   r.trained_at.isoformat(),
        }
        for r in rows
    ])

    buf = io.StringIO()
    df.to_csv(buf, index=False)
    buf.seek(0)

    filename = f"model_history_{range}_{datetime.utcnow().strftime('%Y%m%d')}.csv"
    return StreamingResponse(
        iter([buf.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": f"attachment; filename={filename}"},
    )


@router.get("/metrics/{model_name}")
def get_model_metrics(
    model_name: str,
    range: str = Query("week", description="day | week | month"),
    db: Session = Depends(get_db),
    _admin = Depends(require_admin),
):
    cutoff = _range_cutoff(range)
    rows = (
        db.query(ModelHistory)
        .filter(ModelHistory.model_name == model_name, ModelHistory.trained_at >= cutoff)
        .order_by(ModelHistory.trained_at.desc())
        .all()
    )
    if not rows:
        raise HTTPException(status_code=404, detail=f"No history for model '{model_name}' in this range.")
    return {"model_name": model_name, "range": range, "runs": _rows_to_list(rows)}


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
