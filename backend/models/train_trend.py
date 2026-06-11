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

from sklearn.ensemble import RandomForestClassifier
from sklearn.metrics import accuracy_score, classification_report, precision_score, recall_score, f1_score

from features.build_features import build_features
from utils.model_backups import backup_model
from utils.history_manager import save_metrics

# =====================================================
# BASE PATH
# =====================================================
BASE_DIR = Path(__file__).resolve().parent.parent
MODEL_PATH = BASE_DIR / "models_saved" / "aqi_trend.pkl"

# =====================================================
# LOAD DATA
# =====================================================
X, y, df = build_features()

df = df.sort_values("_time")

# =====================================================
# TARGET CREATION
# =====================================================
df["aqi_future"] = df["aqi"].shift(-1)
df["trend"] = (df["aqi_future"] > df["aqi"]).astype(int)

df = df.dropna(subset=[
    "aqi_future",
    "aqi_lag1",
    "aqi_lag2",
    "aqi_lag3",
    "trend"
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
y = df["trend"]

# =====================================================
# SPLIT
# =====================================================
split = int(len(df) * 0.8)

X_train, X_test = X.iloc[:split], X.iloc[split:]
y_train, y_test = y.iloc[:split], y.iloc[split:]

# =====================================================
# MODEL
# =====================================================
model = RandomForestClassifier(
    n_estimators=300,
    max_depth=20,
    random_state=42,
    n_jobs=-1
)

model.fit(X_train, y_train)

# =====================================================
# PREDICTION
# =====================================================
preds = model.predict(X_test)

# =====================================================
# METRICS
# =====================================================
accuracy = accuracy_score(y_test, preds)
precision = precision_score(y_test, preds, zero_division=0)
recall = recall_score(y_test, preds, zero_division=0)
f1 = f1_score(y_test, preds, zero_division=0)

print("\nTREND MODEL RESULTS")
print("-" * 40)
print("Accuracy :", accuracy)
print("Precision:", precision)
print("Recall   :", recall)
print("F1-score :", f1)

print("\nClassification Report:")
print(classification_report(y_test, preds))

# =====================================================
# SAVE METRICS TO HISTORY
# =====================================================
save_metrics(
    "trend",
    len(df),
    {
        "accuracy": float(accuracy),
        "precision": float(precision),
        "recall": float(recall),
        "f1": float(f1)
    }
)

# =====================================================
# BACKUP OLD MODEL
# =====================================================
backup_model(MODEL_PATH, model_name="trend")

# =====================================================
# SAVE NEW MODEL
# =====================================================
joblib.dump(model, MODEL_PATH)

print("\nTrend model saved successfully.")