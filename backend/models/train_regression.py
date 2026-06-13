from pathlib import Path
import sys

BASE_DIR = Path(__file__).resolve().parent.parent
sys.path.append(str(BASE_DIR))

import joblib
import pandas as pd
import numpy as np


from sklearn.ensemble import RandomForestRegressor
# import of retraining the model 
from pathlib import Path
BASE_DIR = Path(__file__).resolve().parent.parent

from utils.model_backups import backup_model
from utils.history_manager import save_metrics

from sklearn.metrics import (
    mean_absolute_error,
    mean_squared_error,
    r2_score
)

from features.build_features import build_features

# --------------------------------
# LOAD FEATURED DATASET
# --------------------------------

X, y, df = build_features()

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
# FEATURE IMPORTANCE
# --------------------------------

# importance = pd.DataFrame({
#     "feature": X.columns,
#     "importance": model.feature_importances_
# })

# print("\nFeature Importance")
# print(
#     importance.sort_values(
#         by="importance",
#         ascending=False
#     )
# )

importance = pd.DataFrame({
    "feature": X.columns,
    "importance": model.feature_importances_
})

print("\nFeature Importance")
print(
    importance.sort_values(
        by="importance",
        ascending=False
    )
)

# --------------------------------
# PREDICTIONS
# --------------------------------

preds = model.predict(X_test)

print("\nSample Predictions")
print("Predicted:", preds[:10])
print("Actual   :", y_test.iloc[:10].values)

# --------------------------------
# EVALUATION
# --------------------------------

mae = mean_absolute_error(y_test, preds)
mse = mean_squared_error(y_test, preds)
rmse = np.sqrt(mse)
r2 = r2_score(y_test, preds)

print("\nMODEL EVALUATION")
print("MAE  =", round(mae, 3))
print("MSE  =", round(mse, 3))
print("RMSE =", round(rmse, 3))
print("R2   =", round(r2, 3))

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
# Saving backups model 
MODEL_PATH = BASE_DIR / "models_saved" / "aqi_regression.pkl"

backup_model(MODEL_PATH, model_name="regression")

joblib.dump(model, MODEL_PATH)

# save new model 
joblib.dump(model, MODEL_PATH)
print("Regression model saved")



