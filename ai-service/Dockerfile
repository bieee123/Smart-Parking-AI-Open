# ── Smart Parking AI Service — Production Dockerfile ─────────────────────────
# Multi-stage build: slim Python image with only runtime deps
# 
# Build:  docker build -t smart-parking-ai:v2.0 .
# Run:    docker run -p 9000:9000 --env-file .env.production smart-parking-ai:v2.0

FROM python:3.11-slim AS base

# System libs for OpenCV and EasyOCR
RUN apt-get update && apt-get install -y --no-install-recommends \
    libglib2.0-0 \
    libsm6 \
    libxext6 \
    libxrender-dev \
    libgl1 \
    libgomp1 \
    ffmpeg \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# ── Dependencies ──────────────────────────────────────────────────────────────
COPY requirements.txt .
RUN pip install --no-cache-dir --upgrade pip && \
    pip install --no-cache-dir -r requirements.txt

# ── Application ───────────────────────────────────────────────────────────────
COPY . .

# Create models directory (mount as volume in production)
RUN mkdir -p models

# Non-root user for security
RUN useradd -m -u 1000 aiservice && chown -R aiservice:aiservice /app
USER aiservice

# ── Runtime ───────────────────────────────────────────────────────────────────
EXPOSE 9000

ENV PORT=9000
ENV HOST=0.0.0.0
ENV PYTHONUNBUFFERED=1
ENV PYTHONDONTWRITEBYTECODE=1

HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 \
    CMD python -c "import requests; r=requests.get('http://localhost:9000/ai/health/models',timeout=5); exit(0 if r.ok else 1)"

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "9000", \
     "--workers", "1", "--loop", "uvloop", "--access-log"]
