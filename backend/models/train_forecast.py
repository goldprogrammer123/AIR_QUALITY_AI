import sys
import os
from pathlib import Path

sys.path.insert(
    0,
    os.path.abspath(
        os.path.join(os.path.dirname(__file__), "..")
    )
)

import joblib
import pandas as pd
import numpy as np

from xgboost import XGBRegressor
from sklearn.metrics import mean_absolute_error, mean_squared_error, r2_score

from utils.model_backups import backup_model
from utils.history_manager import save_metrics
from features.build_features import build_features

# =====================================================
# BASE PATH
# =====================================================
BASE_DIR = Path(__file__).resolve().parent.parent
MODEL_PATH = BASE_DIR / "models_saved" / "aqi_forecast.pkl"

# =====================================================
# LOAD DATA
# =====================================================
_, _, df = build_features()
df = df.sort_values("_time")

# =====================================================
# FORECAST TARGET
# =====================================================
HORIZON = 6
df["future"] = df["aqi"].shift(-HORIZON)

df = df.dropna(subset=[
    "future",
    "aqi_lag1", "aqi_lag2", "aqi_lag3",
    "co2", "humidity", "pressure", "temperature",
    "hour", "day", "month"
])

# =====================================================
# FEATURES
# =====================================================
features = [
    "co2", "humidity", "pressure", "temperature",
    "hour", "day", "month",
    "aqi_lag1", "aqi_lag2", "aqi_lag3",
    "co2_lag1", "pm25_lag1"
]

features = [f for f in features if f in df.columns]

X = df[features]
y = df["future"]

# =====================================================
# SAFETY CHECK
# =====================================================
if len(df) < 50:
    raise ValueError("Not enough data for training")

# =====================================================
# SPLIT
# =====================================================
split = int(len(df) * 0.8)

X_train, X_test = X.iloc[:split], X.iloc[split:]
y_train, y_test = y.iloc[:split], y.iloc[split:]

# =====================================================
# MODEL
# =====================================================
model = XGBRegressor(
    n_estimators=300,
    learning_rate=0.05,
    max_depth=6,
    subsample=0.8,
    colsample_bytree=0.8,
    random_state=42,
    n_jobs=-1
)

model.fit(X_train, y_train)

# =====================================================
# PREDICTION
# =====================================================
preds = model.predict(X_test)

# =====================================================
# EVALUATION
# =====================================================
mae = mean_absolute_error(y_test, preds)
mse = mean_squared_error(y_test, preds)
rmse = np.sqrt(mse)
r2 = r2_score(y_test, preds)

print("\nFORECAST MODEL RESULTS")
print("-" * 40)
print(f"MAE  : {mae:.3f}")
print(f"RMSE : {rmse:.3f}")
print(f"R2   : {r2:.3f}")

# =====================================================
# SAVE METRICS (IMPORTANT FOR COMPARISON)
# =====================================================
save_metrics(
    "forecast_xgboost",
    len(df),
    {
        "mae": float(mae),
        "rmse": float(rmse),
        "r2": float(r2)
    }
)

# =====================================================
# BACKUP OLD MODEL (BEFORE OVERWRITING)
# =====================================================
backup_model(MODEL_PATH, model_name="forecast_xgboost")

# =====================================================
# SAVE NEW MODEL
# =====================================================
joblib.dump(model, MODEL_PATH)

print("\nForecast model saved successfully.")