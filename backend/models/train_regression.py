from pathlib import Path
import sys
import argparse

BASE_DIR = Path(__file__).resolve().parent.parent
sys.path.append(str(BASE_DIR))

import joblib
import numpy as np

from sklearn.ensemble import RandomForestRegressor
from sklearn.metrics import mean_absolute_error, mean_squared_error, r2_score

from utils.model_backups import backup_model
from utils.history_manager import save_metrics
from features.build_features import build_features

parser = argparse.ArgumentParser()
parser.add_argument("--sensor", default=None, help="Sensor key: 'lands' or 'planning'")
args = parser.parse_args()
SENSOR = args.sensor

# --------------------------------
# LOAD FEATURED DATASET
# --------------------------------

X, y, df = build_features(sensor=SENSOR)

print("Dataset Shape:", df.shape)

# --------------------------------
# TIME-BASED TRAIN TEST SPLIT
# --------------------------------

df = df.sort_values("_time")

split = int(len(df) * 0.8)

X_train = X.iloc[:split]
X_test = X.iloc[split:]

y_train = y.iloc[:split]
y_test = y.iloc[split:]

print("Train Size:", len(X_train))
print("Test Size :", len(X_test))

# --------------------------------
# MODEL
# --------------------------------

model = RandomForestRegressor(
    n_estimators=300,
    max_depth=20,
    random_state=42,
    n_jobs=-1
)

# --------------------------------
# TRAIN
# --------------------------------

model.fit(X_train, y_train)

print("Model trained successfully!")

# --------------------------------
# PREDICTIONS + EVALUATION
# --------------------------------

preds = model.predict(X_test)

mae  = mean_absolute_error(y_test, preds)
mse  = mean_squared_error(y_test, preds)
rmse = np.sqrt(mse)
r2   = r2_score(y_test, preds)

print(f"Regression — MAE={mae:.3f}  RMSE={rmse:.3f}  R2={r2:.3f}  dataset={len(df)}")

# save metrics after evaluation

save_metrics(
    "regression",
    len(df),
    {
        "mae": float(mae),
        "rmse": float(rmse),
        "r2": float(r2)
    }
)
# --------------------------------
# SAVE MODEL
# --------------------------------
model_dir = BASE_DIR / "models_saved" / (SENSOR if SENSOR else "")
model_dir.mkdir(parents=True, exist_ok=True)
MODEL_PATH = model_dir / "aqi_regression.pkl"

backup_model(MODEL_PATH, model_name=f"regression_{SENSOR or 'combined'}")
joblib.dump(model, MODEL_PATH)
print(f"Regression model saved → {MODEL_PATH}")



