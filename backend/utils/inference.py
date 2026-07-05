import sys
import time
from pathlib import Path
sys.path.append(str(Path(__file__).resolve().parent.parent))

import numpy as np
import joblib
import pandas as pd
from datetime import datetime, timezone

from data.fetch_data import fetch_recent_data_for_sensor, SENSOR_TOPICS
from utils.aqi_calculator import compute_aqi, pm25_bp, pm10_bp, no2_bp, so2_bp
from utils.sequence_builder import load_scalers, LOOK_BACK

BASE_DIR = Path(__file__).resolve().parent.parent

# Cache per sensor — results valid for 5 minutes
_cache: dict[str, dict] = {}
_CACHE_TTL = 300

# Models loaded once at startup, keyed by sensor name
_models: dict[str, dict] = {}


def load_models():
    """Load models for all sensors into memory. Called once at API startup."""
    if _models:
        return _models

    from keras.models import load_model

    for sensor in SENSOR_TOPICS:
        d = BASE_DIR / "models_saved" / sensor
        if not (d / "aqi_regression.pkl").exists():
            print(f"WARNING: No models found for sensor '{sensor}' — run train_pipeline.py first.")
            continue

        feat_scaler, tgt_scaler = load_scalers(sensor=sensor)
        _models[sensor] = {
            "regression":   joblib.load(d / "aqi_regression.pkl"),
            "trend":        joblib.load(d / "aqi_trend.pkl"),
            "lstm":         load_model(d / "aqi_lstm_forecast.keras"),
            "feat_scaler":  feat_scaler,
            "tgt_scaler":   tgt_scaler,
        }
        print(f"Models loaded for sensor '{sensor}'.")

    return _models


def _build_features(df: pd.DataFrame) -> pd.DataFrame:
    """Replicate feature engineering from build_features.py on a live window."""
    df["name"] = df["name"].astype(str).str.replace(".", "_", regex=False)
    df = (
        df.pivot_table(index="_time", columns="name", values="value", aggfunc="mean")
        .reset_index()
    )
    df.columns = [str(col).lower() for col in df.columns]
    df = df.rename(columns={"pm2_5": "pm25", "nox": "no2"})

    df["_time"]       = pd.to_datetime(df["_time"])
    df["hour"]        = df["_time"].dt.hour
    df["day"]         = df["_time"].dt.day
    df["month"]       = df["_time"].dt.month
    df["day_of_week"] = df["_time"].dt.dayofweek

    if "co2"  in df.columns: df = df[df["co2"]  < 5000]
    if "pm25" in df.columns: df = df[df["pm25"] < 1000]
    if "pm10" in df.columns: df = df[df["pm10"] < 1000]

    numeric_cols = df.select_dtypes(include=["number"]).columns
    df[numeric_cols] = df[numeric_cols].ffill().bfill()

    for col in ["pm25", "pm10", "no2", "so2"]:
        if col not in df.columns:
            df[col] = 0.0

    df["aqi_pm25"] = df["pm25"].apply(lambda x: compute_aqi(x, pm25_bp))
    df["aqi_pm10"] = df["pm10"].apply(lambda x: compute_aqi(x, pm10_bp))
    df["aqi_no2"]  = df["no2"].apply(lambda x: compute_aqi(x, no2_bp))
    df["aqi_so2"]  = df["so2"].apply(lambda x: compute_aqi(x, so2_bp))
    df["aqi"]      = df[["aqi_pm25", "aqi_pm10", "aqi_no2", "aqi_so2"]].max(axis=1)

    df = df.sort_values("_time").reset_index(drop=True)

    for lag in [1, 2, 3, 6, 12, 24]:
        df[f"aqi_lag{lag}"] = df["aqi"].shift(lag)

    if "co2" in df.columns:
        df["co2_lag1"] = df["co2"].shift(1)

    if "pm25" in df.columns:
        df["pm25_lag1"]  = df["pm25"].shift(1)
        df["aqi_roll3"]  = df["aqi"].rolling(3).mean()
        df["aqi_roll6"]  = df["aqi"].rolling(6).mean()
        df["aqi_roll12"] = df["aqi"].rolling(12).mean()
        df["pm25_roll3"] = df["pm25"].rolling(3).mean()
        df["pm25_roll6"] = df["pm25"].rolling(6).mean()
        df["co2_roll3"]  = df["co2"].rolling(3).mean() if "co2" in df.columns else 0

    df = df.ffill().bfill()
    return df


_REGRESSION_FEATURES = [
    "co2", "humidity", "pressure", "temperature",
    "absolutehumidity", "airqualityscore", "gasresistance",
    "mq135_raw", "voc", "rawhumidity", "rawtemperature",
    "hour", "day", "month",
    "aqi_lag1", "aqi_lag2", "aqi_lag3",
    "co2_lag1", "pm25_lag1",
    "aqi_lag6", "aqi_lag12", "aqi_lag24",
    "aqi_roll3", "aqi_roll6", "aqi_roll12",
    "pm25_roll3", "pm25_roll6", "co2_roll3",
    "pm25", "pm10",
]

_LSTM_FEATURES = [
    "co2", "humidity", "pressure", "temperature",
    "hour", "day", "day_of_week", "month",
    "aqi_lag1", "aqi_lag2", "aqi_lag3",
    "aqi_lag6", "aqi_lag12", "aqi_lag24",
    "aqi_roll3", "aqi_roll6", "aqi_roll12",
    "pm25_roll3", "pm25_roll6", "co2_roll3",
    "pm25", "pm10",
]


def _select_features(df: pd.DataFrame, model) -> pd.DataFrame:
    required = model.feature_names_in_.tolist()
    for col in required:
        if col not in df.columns:
            df[col] = np.nan
    return df[required].iloc[[-1]]


def run_inference(sensor: str) -> dict:
    """
    Run all three models for a single sensor.
    Results are cached for 5 minutes per sensor.
    """
    now = time.time()
    cached = _cache.get(sensor)
    if cached and (now - cached["ts"]) < _CACHE_TTL:
        return cached["result"]

    models = load_models()
    if sensor not in models:
        raise ValueError(f"No models loaded for sensor '{sensor}'. Run train_pipeline.py first.")

    m = models[sensor]

    raw_df = fetch_recent_data_for_sensor(sensor, hours=48)
    if raw_df is None or raw_df.empty:
        raise ValueError(f"No recent data from InfluxDB for sensor '{sensor}'.")

    df = _build_features(raw_df)

    if len(df) < LOOK_BACK:
        raise ValueError(
            f"Not enough data for sensor '{sensor}' — need {LOOK_BACK} rows, got {len(df)}."
        )

    # Regression — next-hour AQI
    reg_row  = _select_features(df, m["regression"])
    aqi_pred = float(m["regression"].predict(reg_row)[0])

    # Trend — rising or falling
    trend_row   = _select_features(df, m["trend"])
    trend_proba = m["trend"].predict_proba(trend_row)[0]
    rising      = bool(trend_proba[1] >= 0.5)
    confidence  = float(trend_proba[1] if rising else trend_proba[0])

    # LSTM — 6-hour multi-target forecast
    lstm_cols       = [f for f in _LSTM_FEATURES if f in df.columns]
    window          = df[lstm_cols].iloc[-LOOK_BACK:].values.astype(float)
    window_scaled   = m["feat_scaler"].transform(window)
    X               = window_scaled.reshape(1, LOOK_BACK, len(lstm_cols))
    forecast_scaled = m["lstm"].predict(X, verbose=0)

    n_targets    = m["tgt_scaler"].n_features_in_
    forecast_inv = m["tgt_scaler"].inverse_transform(
        forecast_scaled.reshape(-1, n_targets)
    )

    def _extract(idx):
        return [round(float(v), 2) for v in forecast_inv[:, idx]] if n_targets > idx else None

    # Current pollutant levels
    last = df.iloc[-1]

    def _safe(col):
        if col not in last.index:
            return None
        v = last[col]
        return round(float(v) if pd.notna(v) else 0.0, 2)

    result = {
        "current_aqi":       round(aqi_pred, 2),
        "trend_direction":   "rising" if rising else "falling",
        "trend_confidence":  round(confidence * 100, 1),
        "forecast_6h":       _extract(0),
        "pm25_forecast_6h":  _extract(1),
        "pm10_forecast_6h":  _extract(2),
        "pollutants": {
            "pm25":        _safe("pm25"),
            "pm10":        _safe("pm10"),
            "co2":         _safe("co2"),
            "no2":         _safe("no2"),
            "voc":         _safe("voc"),
            "humidity":    _safe("humidity"),
            "temperature": _safe("temperature"),
        },
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }

    _cache[sensor] = {"result": result, "ts": time.time()}
    return result


def run_all_inference() -> dict:
    """Run inference for all sensors in parallel and return results keyed by sensor name."""
    from concurrent.futures import ThreadPoolExecutor, as_completed
    results = {}
    with ThreadPoolExecutor(max_workers=len(SENSOR_TOPICS)) as pool:
        futures = {pool.submit(run_inference, sensor): sensor for sensor in SENSOR_TOPICS}
        for fut in as_completed(futures):
            sensor = futures[fut]
            results[sensor] = fut.result()

    # Same campus — use lands temperature/humidity for both sensors
    if "planning" in results and "lands" in results:
        temp = results["lands"]["pollutants"].get("temperature")
        hum  = results["lands"]["pollutants"].get("humidity")
        for sensor in results:
            results[sensor]["pollutants"]["temperature"] = temp
            results[sensor]["pollutants"]["humidity"]    = hum

    return results
