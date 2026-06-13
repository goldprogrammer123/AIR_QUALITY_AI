import sys
from pathlib import Path
sys.path.append(str(Path(__file__).resolve().parent.parent))

import numpy as np

from keras.models import Sequential
from keras.layers import LSTM, Dense, Dropout, Reshape
from keras.callbacks import EarlyStopping, ReduceLROnPlateau
from keras.optimizers import Adam
from sklearn.metrics import mean_absolute_error, mean_squared_error, r2_score

from features.build_features import build_features
from utils.sequence_builder import build_sequences, save_scalers, LOOK_BACK, HORIZON
from utils.history_manager import save_metrics
from utils.model_backups import backup_model

BASE_DIR = Path(__file__).resolve().parent.parent
MODEL_PATH = BASE_DIR / "models_saved" / "aqi_lstm_forecast.keras"

# ======================
# LOAD DATA
# ======================
_, _, df = build_features()

# Phase 1: AQI only. Add pm25 once R2 > 0.5, then all targets at Phase 3.
TARGET_COLS = [c for c in ["aqi"] if c in df.columns]

FEATURE_COLS = [
    "co2", "humidity", "pressure", "temperature",
    "hour", "day", "day_of_week", "month",
    "aqi_lag1", "aqi_lag2", "aqi_lag3",
    "aqi_lag6", "aqi_lag12", "aqi_lag24",
    "aqi_roll3", "aqi_roll6", "aqi_roll12",
    "pm25_roll3", "pm25_roll6", "co2_roll3",
    "pm25", "pm10",
]
FEATURE_COLS = [f for f in FEATURE_COLS if f in df.columns]

print(f"Features : {len(FEATURE_COLS)}")
print(f"Targets  : {TARGET_COLS}")
print(f"Look-back: {LOOK_BACK} hours")
print(f"Horizon  : {HORIZON} hours")

# ======================
# BUILD SEQUENCES
# ======================
X_train, X_test, y_train, y_test, feat_scaler, tgt_scaler = build_sequences(
    df, FEATURE_COLS, TARGET_COLS, look_back=LOOK_BACK, horizon=HORIZON
)

n_features = X_train.shape[2]
n_targets = len(TARGET_COLS)

print(f"\nX_train : {X_train.shape}")
print(f"y_train : {y_train.shape}")
print(f"X_test  : {X_test.shape}")
print(f"y_test  : {y_test.shape}")

if len(X_train) < 50:
    print("\nWARNING: Very few training sequences. Collect more data for reliable results.")

# ======================
# MODEL
# ======================
model = Sequential([
    LSTM(64, return_sequences=True, input_shape=(LOOK_BACK, n_features),
         recurrent_dropout=0.2),
    Dropout(0.4),
    LSTM(32, return_sequences=False, recurrent_dropout=0.2),
    Dropout(0.4),
    Dense(HORIZON * n_targets),
    Reshape((HORIZON, n_targets)),
])

model.compile(optimizer=Adam(learning_rate=0.0005), loss="huber", metrics=["mae"])
model.summary()

# ======================
# TRAIN
# ======================
callbacks = [
    EarlyStopping(monitor="val_loss", patience=15, restore_best_weights=True, verbose=1),
    ReduceLROnPlateau(monitor="val_loss", factor=0.5, patience=5, verbose=1),
]

model.fit(
    X_train, y_train,
    epochs=100,
    batch_size=32,
    validation_split=0.1,
    callbacks=callbacks,
    verbose=1,
)

# ======================
# EVALUATE
# ======================
preds_scaled = model.predict(X_test)

# Flatten (samples * horizon, n_targets) for metric computation
preds = tgt_scaler.inverse_transform(preds_scaled.reshape(-1, n_targets))
actuals = tgt_scaler.inverse_transform(y_test.reshape(-1, n_targets))

mae = mean_absolute_error(actuals, preds)
rmse = np.sqrt(mean_squared_error(actuals, preds))
r2 = r2_score(actuals, preds)

print(f"\nLSTM FORECAST RESULTS")
print(f"Targets : {TARGET_COLS}")
print(f"MAE     : {mae:.3f}")
print(f"RMSE    : {rmse:.3f}")
print(f"R2      : {r2:.3f}")

# Per-target breakdown
for i, col in enumerate(TARGET_COLS):
    col_mae = mean_absolute_error(actuals[:, i], preds[:, i])
    col_r2 = r2_score(actuals[:, i], preds[:, i])
    print(f"  {col:<8}  MAE={col_mae:.3f}  R2={col_r2:.3f}")

# ======================
# SAVE METRICS
# ======================
save_metrics("lstm_forecast", len(df), {
    "mae": float(mae),
    "rmse": float(rmse),
    "r2": float(r2),
    "look_back_hours": LOOK_BACK,
    "horizon_hours": HORIZON,
    "targets": TARGET_COLS,
})

# ======================
# BACKUP + SAVE
# ======================
backup_model(MODEL_PATH, "lstm_forecast")

MODEL_PATH.parent.mkdir(parents=True, exist_ok=True)
model.save(MODEL_PATH)
save_scalers(feat_scaler, tgt_scaler)

print(f"\nLSTM model saved → {MODEL_PATH}")
