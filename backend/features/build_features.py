# features/build_features.py

import sys
import os

sys.path.append(
    os.path.join(
        os.path.dirname(__file__),
        ".."
    )
)

from pathlib import Path
import pandas as pd

from utils.aqi_calculator import (
    compute_aqi,
    pm25_bp,
    pm10_bp,
    no2_bp,
    so2_bp
)


def build_features():

    # ==========================================
    # LOAD CACHED DATA
    # ==========================================

    BASE_DIR = Path(__file__).resolve().parent.parent

    cache_file = (
        BASE_DIR /
        "data" /
        "cache" /
        "raw_data.parquet"
    )

    if not cache_file.exists():
        raise FileNotFoundError(
            f"Cache file not found:\n{cache_file}\n\n"
            "Run fetch_data.py first."
        )

    print(f"\nLoading cached data...")
    print(cache_file)

    df = pd.read_parquet(cache_file)

    print(f"Raw rows: {len(df)}")

    # ==========================================
    # PIVOT DATA
    # ==========================================

    df["name"] = df["name"].astype(str)
    df["name"] = df["name"].str.replace(
        ".",
        "_",
        regex=False
    )

    print("Rows before pivot:", len(df))

    df = (
       df.pivot_table(
        index="_time",
        columns="name",
        values="value",
        aggfunc="mean"
    )
    .reset_index()
)

    print("Rows after pivot:", len(df))
    print("\nColumns after pivot:")
    print(df.columns.tolist())

    df.columns = [
        str(col).lower()
        for col in df.columns
    ]

    # Rename common fields

    df = df.rename(
        columns={
            "pm2_5": "pm25",
            "nox": "no2"
        }
    )

    # ==========================================
    # DATETIME FEATURES
    # ==========================================

    df["_time"] = pd.to_datetime(df["_time"])

    df["hour"] = df["_time"].dt.hour
    df["day"] = df["_time"].dt.day
    df["month"] = df["_time"].dt.month

    # ==========================================
    # CLEAN DATA
    # ==========================================

    numeric_cols = df.select_dtypes(
        include=["number"]
    ).columns

    df[numeric_cols] = df[numeric_cols].fillna(
        df[numeric_cols].median()
    )

    if "co2" in df.columns:
        df = df[df["co2"] < 5000]

    if "pm25" in df.columns:
        df = df[df["pm25"] < 1000]

    if "pm10" in df.columns:
        df = df[df["pm10"] < 1000]

    # ==========================================
    # ENSURE REQUIRED POLLUTANT COLUMNS EXIST
    # ==========================================

    for col in ["pm25", "pm10", "no2", "so2"]:
        if col not in df.columns:
            df[col] = 0

    # ==========================================
    # AQI CALCULATION
    # ==========================================

    df["aqi_pm25"] = df["pm25"].apply(
        lambda x: compute_aqi(x, pm25_bp)
    )

    df["aqi_pm10"] = df["pm10"].apply(
        lambda x: compute_aqi(x, pm10_bp)
    )

    df["aqi_no2"] = df["no2"].apply(
        lambda x: compute_aqi(x, no2_bp)
    )

    df["aqi_so2"] = df["so2"].apply(
        lambda x: compute_aqi(x, so2_bp)
    )

    df["aqi"] = df[
        [
            "aqi_pm25",
            "aqi_pm10",
            "aqi_no2",
            "aqi_so2"
        ]
    ].max(axis=1)

    print("\nAQI Statistics")
    print(df["aqi"].describe())

    # ==========================================
    # SORT BY TIME
    # ==========================================

    df = df.sort_values("_time")

    # ==========================================
    # LAG FEATURES
    # ==========================================

    for lag in [1,2,3,6,12,24]:
        df[f"aqi_lag{lag}"] = df["aqi"].shift(lag)

    if "co2" in df.columns:
        df["co2_lag1"] = df["co2"].shift(1)

    if "pm25" in df.columns:
        df["pm25_lag1"] = df["pm25"].shift(1)

        df["aqi_roll3"] = df["aqi"].rolling(3).mean()
        df["aqi_roll6"] = df["aqi"].rolling(6).mean()
        df["aqi_roll12"] = df["aqi"].rolling(12).mean()

        df["pm25_roll3"] = df["pm25"].rolling(3).mean()
        df["pm25_roll6"] = df["pm25"].rolling(6).mean()

        df["co2_roll3"] = df["co2"].rolling(3).mean()

    # ==========================================
    # TARGET
    # ==========================================

    df["aqi_future"] = df["aqi"].shift(-1)


    # remove rows created by lagging
    df = df.ffill().bfill()

    print(f"Processed rows: {len(df)}")

    # ==========================================
    # FEATURES
    # ==========================================
    features = [
    "co2",
    "humidity",
    "pressure",
    "temperature",

    "absolutehumidity",
    "airqualityscore",
    "gasresistance",
    "mq135_raw",
    "voc",
    "rawhumidity",
    "rawtemperature",

    "hour",
    "day",
    "month",

    "aqi_lag1",
    "aqi_lag2",
    "aqi_lag3",

    "co2_lag1",
    "pm25_lag1",
    "aqi_lag6",
    "aqi_lag12",
    "aqi_lag24",

    "aqi_roll3",
    "aqi_roll6",
    "aqi_roll12",

    "pm25_roll3",
    "pm25_roll6",

    "co2_roll3",

    "pm25",
    "pm10",

    
   ]

    features = [
        f for f in features
        if f in df.columns
    ]

    X = df[features].copy()
    y = df["aqi_future"].copy()

    print(f"Features used: {len(features)}")
    print(f"Training rows: {len(X)}")

    return X, y, df