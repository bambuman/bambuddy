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

# Install dependencies
COPY requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt

# Copy backend
COPY backend/ ./backend/

# Copy built frontend from builder stage
COPY --from=frontend-builder /app/static ./static

# Create data directory for persistent storage
RUN mkdir -p /app/data /app/logs

# Environment variables
ENV PYTHONUNBUFFERED=1
ENV DATA_DIR=/app/data

EXPOSE 8000

# Run the application
CMD ["uvicorn", "backend.app.main:app", "--host", "0.0.0.0", "--port", "8000"]
