import sys
from pathlib import Path
sys.path.append(str(Path(__file__).resolve().parent.parent))

import numpy as np
import joblib
import pandas as pd
from datetime import datetime, timezone

from data.fetch_data import fetch_recent_data
from utils.aqi_calculator import compute_aqi, pm25_bp, pm10_bp, no2_bp, so2_bp
from utils.sequence_builder import load_scalers, LOOK_BACK

BASE_DIR = Path(__file__).resolve().parent.parent

# Loaded once at API startup, reused on every request
_models: dict = {}


def load_models():
    """Load all saved models into memory. Called once at API startup."""
    if _models:
        return _models

    from keras.models import load_model

    _models["regression"] = joblib.load(BASE_DIR / "models_saved" / "aqi_regression.pkl")
    _models["trend"]      = joblib.load(BASE_DIR / "models_saved" / "aqi_trend.pkl")
    _models["lstm"]       = load_model(BASE_DIR / "models_saved" / "aqi_lstm_forecast.keras")
    feat_scaler, tgt_scaler = load_scalers()
    _models["feat_scaler"] = feat_scaler
    _models["tgt_scaler"]  = tgt_scaler

    print("All models loaded successfully.")
    return _models


def _build_features(df: pd.DataFrame) -> pd.DataFrame:
    """Replicate the same feature engineering as build_features.py on a small window."""

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
        df["co2_roll3"]  = df["co2"].rolling(3).mean()

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
    """
    Build a single-row DataFrame that exactly matches what `model` was trained on.
    Any column the model expects that is missing from `df` is filled with NaN
    (which ffill/bfill in _build_features already handles for most cases).
    """
    required = model.feature_names_in_.tolist()
    # Add missing columns so predict() never sees an unseen / missing name error
    for col in required:
        if col not in df.columns:
            df[col] = np.nan
    return df[required].iloc[[-1]]


def run_inference() -> dict:
    """
    Fetch the last 72 hours, run all three models, return predictions
    and current pollutant levels ready for the API to serve.
    """
    models = load_models()

    raw_df = fetch_recent_data(hours=72)
    if raw_df is None or raw_df.empty:
        raise ValueError("No recent data returned from InfluxDB.")

    df = _build_features(raw_df)

    if len(df) < LOOK_BACK:
        raise ValueError(
            f"Not enough recent data for inference — need {LOOK_BACK} rows, got {len(df)}."
        )

    # Regression — next 1-hour AQI
    # Use exactly the features the regression model was trained on (30 features)
    reg_row  = _select_features(df, models["regression"])
    aqi_pred = float(models["regression"].predict(reg_row)[0])

    # Trend — rising or falling
    # Use exactly the features the trend model was trained on (12 features)
    trend_row   = _select_features(df, models["trend"])
    trend_proba = models["trend"].predict_proba(trend_row)[0]
    rising      = bool(trend_proba[1] >= 0.5)
    confidence  = float(trend_proba[1] if rising else trend_proba[0])

    # LSTM — 6-hour AQI forecast
    # Use the feature list stored alongside the scaler to match training exactly
    lstm_cols      = [f for f in _LSTM_FEATURES if f in df.columns]
    window         = df[lstm_cols].iloc[-LOOK_BACK:].values.astype(float)
    window_scaled  = models["feat_scaler"].transform(window)
    X              = window_scaled.reshape(1, LOOK_BACK, len(lstm_cols))
    forecast_scaled = models["lstm"].predict(X, verbose=0)
    forecast = (
        models["tgt_scaler"]
        .inverse_transform(forecast_scaled.reshape(-1, 1))
        .flatten()
        .tolist()
    )

    # Current pollutant levels from the latest row
    last = df.iloc[-1]

    def _safe(col):
        v = last.get(col, 0.0)
        return round(float(v) if pd.notna(v) else 0.0, 2)

    pollutants = {
        "pm25":        _safe("pm25"),
        "pm10":        _safe("pm10"),
        "co2":         _safe("co2"),
        "no2":         _safe("no2"),
        "voc":         _safe("voc"),
        "humidity":    _safe("humidity"),
        "temperature": _safe("temperature"),
    }

    return {
        "current_aqi":      round(aqi_pred, 2),
        "trend_direction":  "rising" if rising else "falling",
        "trend_confidence": round(confidence * 100, 1),
        "forecast_6h":      [round(v, 2) for v in forecast],
        "pollutants":       pollutants,
        "timestamp":        datetime.now(timezone.utc).isoformat(),
    }
