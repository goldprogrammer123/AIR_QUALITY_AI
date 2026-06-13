"""
Recommendation Route
=====================
Combines the inference pipeline with the Groq LLM to generate
real-time health advice based on live sensor readings.

  GET /recommend/  — returns LLM-generated health effects,
                     who is at risk, protective actions,
                     and a forecast warning based on the 6-hour trend.
"""

from fastapi import APIRouter, HTTPException
from datetime import datetime, timezone

from api.schemas import RecommendationResponse
from utils.inference import run_inference
from utils.llm_engine import get_recommendation, _aqi_category

router = APIRouter(prefix="/recommend", tags=["Recommendations"])


@router.get("/", response_model=RecommendationResponse)
def get_health_recommendation():
    """
    Step 1: Run all three ML models to get current AQI,
            trend, forecast, and pollutant levels.
    Step 2: Send those live readings to Groq LLM.
    Step 3: Return the LLM's health advice as a response.

    Requires GROQ_API_KEY in your .env file.
    Get a free key at https://console.groq.com
    """

    # ── Step 1: Get live predictions from ML models ──
    try:
        data = run_inference()
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Inference error: {e}")

    # ── Step 2: Send readings to LLM for health advice ──
    try:
        advice = get_recommendation(data)
    except EnvironmentError as e:
        # GROQ_API_KEY missing — tell the user how to fix it
        raise HTTPException(status_code=503, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"LLM error: {e}")

    # ── Step 3: Return the full recommendation response ──
    return RecommendationResponse(
        advice=advice,
        aqi=data["current_aqi"],
        aqi_category=_aqi_category(data["current_aqi"]),
        timestamp=datetime.now(timezone.utc).isoformat(),
    )
