FROM python:3.12-slim

WORKDIR /app

# System dependencies
RUN apt-get update && apt-get install -y \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Python dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Gunicorn für Multi-Worker
RUN pip install --no-cache-dir gunicorn

# Application code
COPY app ./app
COPY gunicorn.conf.py .

# Create data directory
RUN mkdir -p /data/users

# Default: Development mode (1 Worker mit Reload)
# Für Production: docker-compose.yml überschreibt CMD
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000", "--reload"]

# Production Command (in docker-compose.yml oder k8s):
# CMD ["gunicorn", "app.main:app", "-c", "gunicorn.conf.py"]
