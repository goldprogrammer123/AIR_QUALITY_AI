# models/train_trend.py

import sys
import argparse
from pathlib import Path
sys.path.append(str(Path(__file__).resolve().parent.parent))

import joblib

from sklearn.ensemble import RandomForestClassifier
from sklearn.metrics import accuracy_score, precision_score, recall_score, f1_score

from features.build_features import build_features
from utils.model_backups import backup_model
from utils.history_manager import save_metrics

BASE_DIR = Path(__file__).resolve().parent.parent

parser = argparse.ArgumentParser()
parser.add_argument("--sensor", default=None, help="Sensor key: 'lands' or 'planning'")
args = parser.parse_args()
SENSOR = args.sensor

model_dir  = BASE_DIR / "models_saved" / (SENSOR if SENSOR else "")
model_dir.mkdir(parents=True, exist_ok=True)
MODEL_PATH = model_dir / "aqi_trend.pkl"

# ======================
# LOAD DATA
# ======================
_, _, df = build_features(sensor=SENSOR)
df = df.sort_values("_time")

# ======================
# MOMENTUM FEATURES
# ======================
# Explicit direction-of-change features — far more predictive of future trend
# than absolute AQI levels alone.
df["aqi_delta1"] = df["aqi"] - df["aqi"].shift(1)   # 1h momentum
df["aqi_delta3"] = df["aqi"] - df["aqi"].shift(3)   # 3h momentum
df["aqi_delta6"] = df["aqi"] - df["aqi"].shift(6)   # 6h momentum

# ======================
# TARGET
# ======================
# Use a ±3 AQI deadband — lowered from 5 to get more training rows (was only 126–162).
# Still filters out pure noise while capturing meaningful directional changes.
THRESHOLD = 3
df["aqi_future"] = df["aqi"].shift(-1)
df["aqi_change"] = df["aqi_future"] - df["aqi"]

df = df.dropna(subset=["aqi_future", "aqi_change",
                        "aqi_lag1", "aqi_lag2", "aqi_lag3",
                        "aqi_delta1", "aqi_delta3", "aqi_delta6"])

# Keep only rows with a meaningful change; drop near-zero noise
df = df[df["aqi_change"].abs() >= THRESHOLD].copy()
df["trend"] = (df["aqi_change"] > 0).astype(int)

# ======================
# FEATURES
# ======================
features = [
    "co2", "humidity", "pressure", "temperature",
    "hour", "day", "month",
    "aqi_lag1", "aqi_lag2", "aqi_lag3",
    "aqi_delta1", "aqi_delta3", "aqi_delta6",
    "co2_lag1", "pm25_lag1",
    "aqi_roll3", "aqi_roll6",
]

features = [f for f in features if f in df.columns]

X = df[features]
y = df["trend"]

# ======================
# SPLIT
# ======================
split = int(len(df) * 0.8)
X_train, X_test = X.iloc[:split], X.iloc[split:]
y_train, y_test = y.iloc[:split], y.iloc[split:]

# ======================
# MODEL
# ======================
model = RandomForestClassifier(
    n_estimators=300,
    max_depth=20,
    random_state=42,
    n_jobs=-1,
    class_weight='balanced',
)

model.fit(X_train, y_train)

# ======================
# PREDICTION
# ======================
preds = model.predict(X_test)

# ======================
# METRICS
# ======================
accuracy = accuracy_score(y_test, preds)
precision = precision_score(y_test, preds, zero_division=0)
recall = recall_score(y_test, preds, zero_division=0)
f1 = f1_score(y_test, preds, zero_division=0)

print(f"Trend — accuracy={accuracy:.4f}  precision={precision:.4f}  recall={recall:.4f}  f1={f1:.4f}  dataset={len(df)}")

# ======================
# SAVE HISTORY
# ======================
save_metrics("trend", len(df), {
    "accuracy": float(accuracy),
    "precision": float(precision),
    "recall": float(recall),
    "f1": float(f1)
})

# ======================
# BACKUP + SAVE
# ======================
backup_model(MODEL_PATH, f"trend_{SENSOR or 'combined'}")
joblib.dump(model, MODEL_PATH)

print(f"Trend model saved → {MODEL_PATH}")