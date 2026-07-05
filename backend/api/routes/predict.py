"""
Prediction Routes
=================
  GET /predict/all              — all sensors, all models (main endpoint)
  GET /predict/sensor/{sensor}  — one sensor: 'lands' or 'planning'
  GET /predict/current/{sensor} — regression only for one sensor
  GET /predict/trend/{sensor}   — trend only for one sensor
  GET /predict/forecast/{sensor}— LSTM forecast only for one sensor
"""

from fastapi import APIRouter, HTTPException
from api.schemas import (
    AllSensorsResponse,
    SensorPrediction,
    PollutantLevels,
    CurrentPrediction,
    TrendPrediction,
    ForecastPrediction,
)
from utils.inference import run_inference, run_all_inference

router = APIRouter(prefix="/predict", tags=["Predictions"])

VALID_SENSORS = {"lands", "planning"}


def _get_sensor_data(sensor: str) -> dict:
    if sensor not in VALID_SENSORS:
        raise HTTPException(status_code=400, detail=f"Unknown sensor '{sensor}'. Use: {sorted(VALID_SENSORS)}")
    try:
        return run_inference(sensor)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


def _to_sensor_prediction(data: dict) -> SensorPrediction:
    return SensorPrediction(
        current_aqi=data["current_aqi"],
        trend_direction=data["trend_direction"],
        trend_confidence=data["trend_confidence"],
        forecast_6h=data["forecast_6h"],
        pm25_forecast_6h=data.get("pm25_forecast_6h"),
        pm10_forecast_6h=data.get("pm10_forecast_6h"),
        pollutants=PollutantLevels(**data["pollutants"]),
        timestamp=data["timestamp"],
    )


@router.get("/all", response_model=AllSensorsResponse)
def predict_all():
    """Run all models for all sensors. Main endpoint for the dashboard."""
    try:
        results = run_all_inference()
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    return AllSensorsResponse(
        sensors={sensor: _to_sensor_prediction(data) for sensor, data in results.items()}
    )


@router.get("/sensor/{sensor}", response_model=SensorPrediction)
def predict_sensor(sensor: str):
    """All models for a single sensor."""
    return _to_sensor_prediction(_get_sensor_data(sensor))


@router.get("/current/{sensor}", response_model=CurrentPrediction)
def predict_current(sensor: str):
    data = _get_sensor_data(sensor)
    return CurrentPrediction(sensor=sensor, current_aqi=data["current_aqi"], timestamp=data["timestamp"])


@router.get("/trend/{sensor}", response_model=TrendPrediction)
def predict_trend(sensor: str):
    data = _get_sensor_data(sensor)
    return TrendPrediction(sensor=sensor, direction=data["trend_direction"], confidence=data["trend_confidence"])


@router.get("/forecast/{sensor}", response_model=ForecastPrediction)
def predict_forecast(sensor: str):
    data = _get_sensor_data(sensor)
    return ForecastPrediction(sensor=sensor, forecast_6h=data["forecast_6h"], timestamp=data["timestamp"])
