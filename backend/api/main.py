"""
Air Quality AI — FastAPI Backend
=================================
Entry point for the API server.

Endpoints:
  GET /predict/all        → current AQI + trend + 6-hr forecast + pollutants
  GET /predict/current    → next 1-hour AQI (regression model)
  GET /predict/trend      → rising or falling direction (trend model)
  GET /predict/forecast   → 6-hour AQI curve (LSTM model)
  GET /recommend/         → real-time health advice from Groq LLM
  GET /history/metrics    → full training history for all models
  GET /history/metrics/{model_name} → training history for one model
  GET /health             → API status check

Run:
  cd backend
  ./myvenv/bin/uvicorn api.main:app --reload --port 8000
"""

import sys
from pathlib import Path

# Make sure the backend root is on the Python path so all imports resolve
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from api.routes import predict, recommend, history
from utils.inference import load_models


# ─────────────────────────────────────────────
# LIFESPAN — runs once when the server starts
# Load all ML models into memory so every API
# request gets a fast response without re-loading
# ─────────────────────────────────────────────
@asynccontextmanager
async def lifespan(app: FastAPI):
    print("Loading ML models into memory...")
    load_models()
    print("API ready.")
    yield
    # Nothing to clean up on shutdown


# ─────────────────────────────────────────────
# CREATE THE FASTAPI APP
# ─────────────────────────────────────────────
app = FastAPI(
    title="Air Quality AI API",
    description=(
        "Real-time AQI predictions, trend detection, 6-hour forecasting, "
        "pollutant monitoring and LLM-powered health recommendations."
    ),
    version="1.0.0",
    lifespan=lifespan,
)


# ─────────────────────────────────────────────
# CORS — allow the frontend (running on any
# origin during development) to call this API
# ─────────────────────────────────────────────
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],   # tighten this to your frontend URL in production
    allow_methods=["*"],
    allow_headers=["*"],
)


# ─────────────────────────────────────────────
# REGISTER ROUTE GROUPS
# Each router handles its own prefix and logic
# ─────────────────────────────────────────────
app.include_router(predict.router)    # /predict/*
app.include_router(recommend.router)  # /recommend/
app.include_router(history.router)    # /history/*


# ─────────────────────────────────────────────
# HEALTH CHECK — quick way to verify the API
# is running and models are loaded
# ─────────────────────────────────────────────
@app.get("/health", tags=["Health"])
def health_check():
    return {"status": "ok", "message": "Air Quality AI API is running."}


# ─────────────────────────────────────────────
# ROOT — helpful message for anyone hitting /
# ─────────────────────────────────────────────
@app.get("/", tags=["Root"])
def root():
    return {
        "message": "Air Quality AI API",
        "docs":    "/docs",
        "health":  "/health",
    }
