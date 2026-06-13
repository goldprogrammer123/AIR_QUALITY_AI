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
    forecast_6h: list[float]   # 6 hourly AQI values
    timestamp:   str


class AllPredictions(BaseModel):
    current_aqi:      float
    trend_direction:  str
    trend_confidence: float
    forecast_6h:      list[float]
    pollutants:       PollutantLevels
    timestamp:        str


class RecommendationResponse(BaseModel):
    advice:      str
    aqi:         float
    aqi_category: str
    timestamp:   str


class HealthResponse(BaseModel):
    status:  str
    message: str


class MetricsResponse(BaseModel):
    history: dict
