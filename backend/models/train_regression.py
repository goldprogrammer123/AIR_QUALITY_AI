# models/train_regression.py

import sys
from pathlib import Path
sys.path.append(str(Path(__file__).resolve().parent.parent))

import joblib
import numpy as np
import pandas as pd

from xgboost import XGBRegressor
from sklearn.metrics import mean_absolute_error, mean_squared_error, r2_score

from features.build_features import build_features
from utils.model_backups import backup_model
from utils.history_manager import save_metrics

BASE_DIR = Path(__file__).resolve().parent.parent
MODEL_PATH = BASE_DIR / "models_saved" / "aqi_regression.pkl"

# ======================
# LOAD DATA
# ======================
X, y, df = build_features()
df = df.sort_values("_time")

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
    n_estimators=500,
    learning_rate=0.03,
    max_depth=8,
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

print("\nREGRESSION RESULTS")
print(f"MAE: {mae:.3f}")
print(f"RMSE: {rmse:.3f}")
print(f"R2: {r2:.3f}")

# ======================
# SAVE HISTORY
# ======================
save_metrics("regression", len(df), {
    "mae": float(mae),
    "rmse": float(rmse),
    "r2": float(r2)
})

# ======================
# BACKUP + SAVE
# ======================
backup_model(MODEL_PATH, "regression")
joblib.dump(model, MODEL_PATH)

print("Regression model saved.")