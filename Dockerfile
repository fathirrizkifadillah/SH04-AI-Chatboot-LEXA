# Stage 1: Build frontend widget
FROM node:20-alpine AS frontend-builder
WORKDIR /app/frontend
COPY frontend/package*.json ./
RUN npm ci
COPY frontend/ ./
RUN npm run build

# Stage 2: Backend API
FROM python:3.11-slim
WORKDIR /app

# Install build dependencies untuk chromadb (C++) dan curl untuk healthcheck
RUN apt-get update && apt-get install -y \
    build-essential \
    curl \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

# Copy built frontend widget dari builder stage
COPY --from=frontend-builder /app/frontend/dist /app/frontend/dist

# Buat folder data untuk settings & cache
RUN mkdir -p /app/data

EXPOSE 8000

CMD ["sh", "-c", "uvicorn api:app --host 0.0.0.0 --port ${PORT:-8000}"]
