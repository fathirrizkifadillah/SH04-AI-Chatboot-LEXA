FROM python:3.10-slim

WORKDIR /app

# Install dependencies untuk rembg dan chromadb (C++)
RUN apt-get update && apt-get install -y \
    build-essential \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .

RUN pip install --no-cache-dir -r requirements.txt

COPY . .

# Buat folder data SQLite
RUN mkdir -p /app/data

EXPOSE 8000

CMD ["uvicorn", "api:app", "--host", "0.0.0.0", "--port", "8000"]
