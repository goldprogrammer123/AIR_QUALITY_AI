# models/train_forecast.py

import sys
from pathlib import Path

sys.path.append(str(Path(__file__).resolve().parent.parent))

import joblib
import numpy as np
from xgboost import XGBRegressor
from sklearn.metrics import mean_absolute_error, mean_squared_error, r2_score

from features.build_features import build_features
from utils.model_backups import backup_model
from utils.history_manager import save_metrics

# ======================
# PATHS
# ======================
BASE_DIR = Path(__file__).resolve().parent.parent
MODEL_PATH = BASE_DIR / "models_saved" / "aqi_forecast.pkl"

# ======================
# LOAD DATA
# ======================
_, _, df = build_features()
df = df.sort_values("_time")

# ======================
# TARGET
# ======================
HORIZON = 6
df["future"] = df["aqi"].shift(-HORIZON)

# ======================
# CLEAN
# ======================
df = df.dropna(subset=[
    "future",
    "aqi_lag1", "aqi_lag2", "aqi_lag3",
    "co2", "humidity", "pressure", "temperature",
    "hour", "day", "month"
])

# ======================
# FEATURES
# ======================
features = [
    "co2", "humidity", "pressure", "temperature",
    "hour", "day", "month",
    "aqi_lag1", "aqi_lag2", "aqi_lag3",
    "aqi_lag6", "aqi_lag12", "aqi_lag24",
    "co2_lag1", "pm25_lag1",
    "aqi_roll3", "aqi_roll6", "aqi_roll12",
    "pm25_roll3", "pm25_roll6",
    "co2_roll3",
]

features = [f for f in features if f in df.columns]

X = df[features]
y = df["future"]

# ======================
# SPLIT
# ======================
split = int(len(df) * 0.8)
X_train, X_test = X.iloc[:split], X.iloc[split:]
y_train, y_test = y.iloc[:split], y.iloc[split:]

# ======================
# MODEL
# ======================
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

# ======================
# EVALUATION
# ======================
preds = model.predict(X_test)

mae = mean_absolute_error(y_test, preds)
rmse = np.sqrt(mean_squared_error(y_test, preds))
r2 = r2_score(y_test, preds)

print("\nFORECAST RESULTS")
print(f"MAE: {mae:.3f}")
print(f"RMSE: {rmse:.3f}")
print(f"R2: {r2:.3f}")

# ======================
# SAVE HISTORY
# ======================
save_metrics("forecast_xgboost", len(df), {
    "mae": float(mae),
    "rmse": float(rmse),
    "r2": float(r2)
})

# ======================
# BACKUP + SAVE
# ======================
backup_model(MODEL_PATH, "forecast_xgboost")
joblib.dump(model, MODEL_PATH)

print("Forecast model saved.")