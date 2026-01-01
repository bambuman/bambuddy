# Build frontend
FROM node:22-bookworm-slim AS frontend-builder

WORKDIR /app/frontend

COPY frontend/package*.json ./
RUN npm ci

COPY frontend/ ./
RUN npm run build

# Production image
FROM python:3.13-slim

WORKDIR /app

# Install system dependencies
ENV DEBIAN_FRONTEND=noninteractive
RUN apt-get update && apt-get install -y --no-install-recommends \
    curl \
    ffmpeg \
    && rm -rf /var/lib/apt/lists/*

# Install Python dependencies
COPY requirements.txt ./
RUN pip install --no-cache-dir --root-user-action=ignore -r requirements.txt

# Copy backend
COPY backend/ ./backend/

# Copy built frontend from builder stage
COPY --from=frontend-builder /app/static ./static

# Create data directory for persistent storage
RUN mkdir -p /app/data /app/logs

# Environment variables
ENV PYTHONUNBUFFERED=1
ENV DATA_DIR=/app/data
ENV LOG_DIR=/app/logs

EXPOSE 8000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=10s --retries=3 \
    CMD python -c "import urllib.request; urllib.request.urlopen('http://localhost:8000/health')" || exit 1

# Run the application
CMD ["uvicorn", "backend.app.main:app", "--host", "0.0.0.0", "--port", "8000"]
