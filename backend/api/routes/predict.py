"""
Prediction Routes
=================
Exposes the three ML models as REST endpoints.

  GET /predict/all      — runs all three models in one call (recommended for dashboard)
  GET /predict/current  — regression model: next 1-hour AQI
  GET /predict/trend    — trend model: is AQI rising or falling?
  GET /predict/forecast — LSTM model: AQI for each of the next 6 hours
"""

from fastapi import APIRouter, HTTPException
from api.schemas import (
    CurrentPrediction,
    TrendPrediction,
    ForecastPrediction,
    AllPredictions,
    PollutantLevels,
)
from utils.inference import run_inference

router = APIRouter(prefix="/predict", tags=["Predictions"])


def _get_data():
    """
    Run the full inference pipeline and return results.
    Raises HTTP 500 if InfluxDB is unreachable or models fail.
    """
    try:
        return run_inference()
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/all", response_model=AllPredictions)
def predict_all():
    """
    Run all three models in a single call.
    Returns: current AQI, trend direction + confidence,
             6-hour forecast curve, and current pollutant levels.
    Use this endpoint for the main dashboard.
    """
    data = _get_data()
    return AllPredictions(
        current_aqi=data["current_aqi"],
        trend_direction=data["trend_direction"],
        trend_confidence=data["trend_confidence"],
        forecast_6h=data["forecast_6h"],
        pollutants=PollutantLevels(**data["pollutants"]),
        timestamp=data["timestamp"],
    )


@router.get("/current", response_model=CurrentPrediction)
def predict_current():
    """
    Regression model only.
    Returns the predicted AQI value for the next 1 hour.
    """
    data = _get_data()
    return CurrentPrediction(
        current_aqi=data["current_aqi"],
        timestamp=data["timestamp"],
    )


@router.get("/trend", response_model=TrendPrediction)
def predict_trend():
    """
    Trend classification model only.
    Returns whether AQI is rising or falling and
    how confident the model is (0–100%).
    """
    data = _get_data()
    return TrendPrediction(
        direction=data["trend_direction"],
        confidence=data["trend_confidence"],
    )


@router.get("/forecast", response_model=ForecastPrediction)
def predict_forecast():
    """
    LSTM model only.
    Returns a list of 6 predicted AQI values,
    one for each of the next 6 hours.
    """
    data = _get_data()
    return ForecastPrediction(
        forecast_6h=data["forecast_6h"],
        timestamp=data["timestamp"],
    )
