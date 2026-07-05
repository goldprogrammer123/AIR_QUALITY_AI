from pydantic import BaseModel
from typing import Optional


class PollutantLevels(BaseModel):
    pm25:        float
    pm10:        float
    co2:         float
    no2:         float
    voc:         float
    humidity:    Optional[float]
    temperature: Optional[float]


class SensorPrediction(BaseModel):
    current_aqi:       float
    trend_direction:   str
    trend_confidence:  float
    forecast_6h:       list[float]
    pm25_forecast_6h:  Optional[list[float]]
    pm10_forecast_6h:  Optional[list[float]]
    pollutants:        PollutantLevels
    timestamp:         str


class AllSensorsResponse(BaseModel):
    sensors: dict[str, SensorPrediction]


# ── Kept for individual sub-endpoints ──────────────────────────
class CurrentPrediction(BaseModel):
    sensor:      str
    current_aqi: float
    timestamp:   str


class TrendPrediction(BaseModel):
    sensor:     str
    direction:  str
    confidence: float


class ForecastPrediction(BaseModel):
    sensor:      str
    forecast_6h: list[float]
    timestamp:   str


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
