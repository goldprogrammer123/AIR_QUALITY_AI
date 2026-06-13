"""
History Routes
==============
Exposes the training history JSON so you can track how
model performance has changed over time.

  GET /history/metrics              — all models, all runs
  GET /history/metrics/{model_name} — one specific model
                                      e.g. /history/metrics/regression
                                           /history/metrics/trend
                                           /history/metrics/lstm_forecast
"""

import json
from pathlib import Path
from fastapi import APIRouter, HTTPException

router = APIRouter(prefix="/history", tags=["History"])

# Path to the training history file saved by history_manager.py
HISTORY_FILE = Path(__file__).resolve().parents[2] / "model_history" / "training_history.json"


@router.get("/metrics")
def get_all_metrics():
    """
    Return the full training history for all models.
    Each entry includes dataset size, MAE, RMSE, R2, and timestamp.
    """
    if not HISTORY_FILE.exists():
        raise HTTPException(status_code=404, detail="Training history file not found.")

    with open(HISTORY_FILE, "r") as f:
        return json.load(f)


@router.get("/metrics/{model_name}")
def get_model_metrics(model_name: str):
    """
    Return training history for a specific model.
    Valid model names: regression, trend, lstm_forecast, forecast_xgboost
    """
    if not HISTORY_FILE.exists():
        raise HTTPException(status_code=404, detail="Training history file not found.")

    with open(HISTORY_FILE, "r") as f:
        history = json.load(f)

    # Check the model name exists in the history
    if model_name not in history:
        raise HTTPException(
            status_code=404,
            detail=f"Model '{model_name}' not found. Available models: {list(history.keys())}",
        )

    return {model_name: history[model_name]}
