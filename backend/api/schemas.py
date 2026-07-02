from pydantic import BaseModel
from typing import Optional


class PollutantLevels(BaseModel):
    pm25:        float
    pm10:        float
    co2:         float
    no2:         float
    voc:         float
    humidity:    float
    temperature: float


class CurrentPrediction(BaseModel):
    current_aqi: float
    timestamp:   str


class TrendPrediction(BaseModel):
    direction:  str    # "rising" or "falling"
    confidence: float  # percentage 0–100


class ForecastPrediction(BaseModel):
    forecast_6h: list[float]   # 24 hourly AQI values (1 day)
    timestamp:    str


class AllPredictions(BaseModel):
    current_aqi:        float
    trend_direction:    str
    trend_confidence:   float
    forecast_6h:       list[float]           # 24-hour AQI forecast
    pm25_forecast_6h:  Optional[list[float]]  # 24-hour PM2.5 forecast
    pm10_forecast_6h:  Optional[list[float]]  # 24-hour PM10 forecast
    pollutants:         PollutantLevels
    timestamp:          str


class RecommendationResponse(BaseModel):
    advice:       str
    aqi:          float
    aqi_category: str
    timestamp:    str


class HealthResponse(BaseModel):
    status:  str
    message: str


class MetricsResponse(BaseModel):
    history: dict
