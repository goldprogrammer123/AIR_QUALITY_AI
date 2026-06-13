import os
from dotenv import load_dotenv

load_dotenv()

_groq_client = None


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
    """
    aqi       = inference_result["current_aqi"]
    trend     = inference_result["trend_direction"]
    confidence = inference_result["trend_confidence"]
    forecast  = inference_result["forecast_6h"]
    p         = inference_result["pollutants"]
    category  = _aqi_category(aqi)

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
- 6-hour AQI forecast: {forecast}

Provide your response in this exact structure:

**Current Health Effects**
(What these specific levels are doing to people's health right now)

**Who Is Most at Risk**
(List specific groups based on these exact readings)

**Immediate Protective Actions**
(What people must do RIGHT NOW based on these readings)

**What to Avoid**
(Specific activities or situations to avoid given these conditions)

**Forecast Warning**
(Based on the 6-hour forecast trend, what should people expect and prepare for)
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

    return response.choices[0].message.content
