# ─── Backend Dockerfile ────────────────────────────────────────────────────
# Python 3.12 slim — matches the dev environment exactly.
# Models in models_saved/ are baked into the image so no extra volume needed
# for inference.  training_history/ and data/cache/ use volumes (see compose).
# ───────────────────────────────────────────────────────────────────────────

FROM python:3.12-slim

WORKDIR /app

# System libraries needed by numpy / scipy / TensorFlow at runtime
RUN apt-get update && apt-get install -y --no-install-recommends \
        gcc \
        g++ \
        libgomp1 \
        curl \
    && rm -rf /var/lib/apt/lists/*

# Install Python deps first so Docker layer cache reuses this step
# when only source code changes (not requirements)
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy the full backend source (models_saved/ is included)
COPY . .

# Create directories that are mounted as volumes at runtime
RUN mkdir -p model_history data/cache

EXPOSE 8000

# 1 worker is enough for a single-node ARM instance; increase if you scale
CMD ["uvicorn", "api.main:app", \
     "--host", "0.0.0.0", \
     "--port", "8000", \
     "--workers", "1"]
