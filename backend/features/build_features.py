# features/build_features.py
# Imports fetch_raw_data() + aqi utils → returns X, y, and full df

import sys, os
sys.path.append(os.path.join(os.path.dirname(__file__), ".."))

import pandas as pd
from data.fetch_data import fetch_raw_data
from utils.aqi_calculator import compute_aqi, pm25_bp, pm10_bp, no2_bp, so2_bp

def build_features():
    df = fetch_raw_data()

    # --- Pivot & rename ---
    df["name"] = df["name"].str.replace(".", "_", regex=False)
    df = df.pivot_table(index="_time", columns="name", values="value", aggfunc="mean").reset_index()
    df.columns = [str(c).lower() for c in df.columns]
    df = df.rename(columns={"nox": "no2", "pm2_5": "pm25"})

    # --- Clean ---
    df["_time"] = pd.to_datetime(df["_time"])
    df["hour"]  = df["_time"].dt.hour
    df["day"]   = df["_time"].dt.day
    df["month"] = df["_time"].dt.month
    df = df.fillna(df.median(numeric_only=True))
    if "co2"  in df.columns: df = df[df["co2"]  < 5000]
    if "pm25" in df.columns: df = df[df["pm25"] < 1000]
    if "pm10" in df.columns: df = df[df["pm10"] < 1000]

    # --- AQI ---
    df["no2_ppb"] = df["no2"].fillna(0) * 1000 if "no2" in df.columns else 0
    df["so2_ppb"] = df["so2"].fillna(0) * 1000 if "so2" in df.columns else 0
    df["aqi_pm25"] = df["pm25"].apply(lambda x: compute_aqi(x, pm25_bp))
    df["aqi_pm10"] = df["pm10"].apply(lambda x: compute_aqi(x, pm10_bp))
    df["aqi_no2"]  = df.get("no2", pd.Series(0)).fillna(0).apply(lambda x: compute_aqi(x, no2_bp))
    df["aqi_so2"]  = df.get("so2", pd.Series(0)).fillna(0).apply(lambda x: compute_aqi(x, so2_bp))
    df["aqi"]      = df[["aqi_pm25","aqi_pm10","aqi_no2","aqi_so2"]].max(axis=1)

    # --- Target ---
    df = df.sort_values("_time")

    # Lag features
    df["aqi_lag1"] = df["aqi"].shift(1)
    df["aqi_lag2"] = df["aqi"].shift(2)
    df["aqi_lag3"] = df["aqi"].shift(3)

    df["co2_lag1"] = df["co2"].shift(1)
    df["pm25_lag1"] = df["pm25"].shift(1)

    df["aqi_future"] = df["aqi"].shift(-1)
    df = df.dropna(subset=["aqi_future"])

    features = [
    "co2",
    "humidity",
    "temperature",
    "hour",
    "day",
    "month",

    "aqi_lag1",
    "aqi_lag2",
    "aqi_lag3",

    "pm25",
    "pm10"
]
    X = df[[c for c in features if c in df.columns]].copy()
    y = df["aqi_future"].copy()

    return X, y, df