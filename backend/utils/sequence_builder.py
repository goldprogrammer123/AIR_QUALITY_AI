from pathlib import Path
import numpy as np
from sklearn.preprocessing import MinMaxScaler
import joblib

LOOK_BACK = 24
HORIZON   = 6

MODELS_DIR = Path(__file__).resolve().parent.parent / "models_saved"

# Legacy (combined) scaler paths — kept for backward compat
FEAT_SCALER_PATH = MODELS_DIR / "lstm_feat_scaler.pkl"
TGT_SCALER_PATH  = MODELS_DIR / "lstm_tgt_scaler.pkl"


def _scaler_paths(sensor: str = None):
    if sensor:
        d = MODELS_DIR / sensor
        return d / "lstm_feat_scaler.pkl", d / "lstm_tgt_scaler.pkl"
    return FEAT_SCALER_PATH, TGT_SCALER_PATH


def build_sequences(df, feature_cols, target_cols, look_back=LOOK_BACK, horizon=HORIZON):
    """
    Converts a time-sorted DataFrame into sliding-window sequences for LSTM training.

    Returns
    -------
    X_train, X_test  : (samples, look_back, n_features)
    y_train, y_test  : (samples, horizon, n_targets)
    feat_scaler      : fitted MinMaxScaler for features (save for inference)
    tgt_scaler       : fitted MinMaxScaler for targets  (save for inference)
    """
    df = df.sort_values("_time").reset_index(drop=True)

    features = df[feature_cols].values.astype(float)
    targets = df[target_cols].values.astype(float)

    # Fit scalers on the training portion only — never on the full dataset
    split_idx = int(len(df) * 0.8)

    feat_scaler = MinMaxScaler()
    feat_scaler.fit(features[:split_idx])

    tgt_scaler = MinMaxScaler()
    tgt_scaler.fit(targets[:split_idx])

    features_scaled = feat_scaler.transform(features)
    targets_scaled = tgt_scaler.transform(targets)

    X, y = [], []
    total = len(df)
    for i in range(look_back, total - horizon + 1):
        X.append(features_scaled[i - look_back : i])
        y.append(targets_scaled[i : i + horizon])

    X = np.array(X, dtype=np.float32)
    y = np.array(y, dtype=np.float32)

    split_seq = int(len(X) * 0.8)
    X_train, X_test = X[:split_seq], X[split_seq:]
    y_train, y_test = y[:split_seq], y[split_seq:]

    return X_train, X_test, y_train, y_test, feat_scaler, tgt_scaler


def save_scalers(feat_scaler, tgt_scaler, sensor: str = None):
    fp, tp = _scaler_paths(sensor)
    fp.parent.mkdir(parents=True, exist_ok=True)
    joblib.dump(feat_scaler, fp)
    joblib.dump(tgt_scaler, tp)
    print(f"Scalers saved to {fp.parent}")


def load_scalers(sensor: str = None):
    fp, tp = _scaler_paths(sensor)
    return joblib.load(fp), joblib.load(tp)
