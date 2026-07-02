import os
import time
from dotenv import load_dotenv

load_dotenv()

_groq_client = None

# Cache Groq responses for 10 minutes — health advice doesn't change minute-to-minute
_llm_cache: dict = {"result": None, "aqi_bucket": None, "ts": 0.0}
_LLM_CACHE_TTL = 600  # seconds


def _get_client():
    global _groq_client
    if _groq_client is None:
        from groq import Groq
        api_key = os.getenv("GROQ_API_KEY")
        if not api_key:
            raise EnvironmentError(
                "GROQ_API_KEY is not set in your .env file. "
                "Get a free key at https://console.groq.com"
            )
        _groq_client = Groq(api_key=api_key)
    return _groq_client


def _aqi_category(aqi: float) -> str:
    if aqi <= 50:   return "Good"
    if aqi <= 100:  return "Moderate"
    if aqi <= 150:  return "Unhealthy for Sensitive Groups"
    if aqi <= 200:  return "Unhealthy"
    if aqi <= 300:  return "Very Unhealthy"
    return "Hazardous"


def get_recommendation(inference_result: dict) -> str:
    """
    Send current air quality readings to Groq LLM and return
    real-time health advice and protective actions.
    Responses are cached for 10 minutes when AQI stays in the same 5-point bucket.
    """
    aqi       = inference_result["current_aqi"]
    # Round to nearest 5 so minor AQI fluctuations reuse the cached response
    aqi_bucket = round(aqi / 5) * 5
    now = time.time()

    if (
        _llm_cache["result"]
        and _llm_cache["aqi_bucket"] == aqi_bucket
        and (now - _llm_cache["ts"]) < _LLM_CACHE_TTL
    ):
        return _llm_cache["result"]

    trend      = inference_result["trend_direction"]
    confidence = inference_result["trend_confidence"]
    forecast   = inference_result["forecast_6h"]
    p          = inference_result["pollutants"]
    category   = _aqi_category(aqi)

    aqi_6h  = forecast or []
    pm25_6h = inference_result.get("pm25_forecast_6h") or []
    pm10_6h = inference_result.get("pm10_forecast_6h") or []

    def _fmt_hourly(label, values, unit=""):
        if not values:
            return ""
        pairs = ", ".join(f"+{i+1}h: {v}{unit}" for i, v in enumerate(values))
        return f"- {label}: {pairs}\n"

    forecast_block = (
        _fmt_hourly("AQI",   aqi_6h)
        + _fmt_hourly("PM2.5", pm25_6h, " µg/m³")
        + _fmt_hourly("PM10",  pm10_6h, " µg/m³")
    )

    prompt = f"""You are an air quality health expert. Based on the EXACT live readings below,
provide specific health effects, who is at risk right now, and what people must do immediately
to protect themselves. Be direct, practical, and use simple language.

LIVE AIR QUALITY READINGS:
- AQI: {aqi} — Category: {category}
- PM2.5: {p['pm25']} µg/m³
- PM10:  {p['pm10']} µg/m³
- CO2:   {p['co2']} ppm
- NO2:   {p['no2']} µg/m³
- VOC:   {p['voc']}
- Humidity:    {p['humidity']}%
- Temperature: {p['temperature']}°C
- Trend: AQI is {trend} (confidence: {confidence}%)

6-HOUR FORECAST (hourly):
{forecast_block}
Provide your response in this exact structure:

**Current Health Effects**
(What these specific levels are doing to people's health right now)

**Who Is Most at Risk**
(List specific groups based on these exact readings)

**Immediate Protective Actions**
(What people must do RIGHT NOW based on these readings)

**What to Avoid**
(Specific activities or situations to avoid given these conditions)

**6-Hour Forecast Warning**
(Based on the 6-hour pollutant forecasts above, what should people expect and prepare for in the next 6 hours)
"""

    client = _get_client()

    response = client.chat.completions.create(
        model="llama-3.3-70b-versatile",
        messages=[
            {
                "role": "system",
                "content": (
                    "You are a certified air quality health advisor. "
                    "You give accurate, specific, actionable health guidance "
                    "based on real sensor readings. Never give generic advice — "
                    "always reference the actual numbers provided."
                ),
            },
            {"role": "user", "content": prompt},
        ],
        temperature=0.4,
        max_tokens=600,
    )

    advice = response.choices[0].message.content

    _llm_cache["result"] = advice
    _llm_cache["aqi_bucket"] = aqi_bucket
    _llm_cache["ts"] = time.time()

    return advice
