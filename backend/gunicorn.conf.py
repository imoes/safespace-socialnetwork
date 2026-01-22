"""
Uvicorn Multi-Worker Konfiguration für Multi-Core CPUs

Verwendung:
    # Development (1 Worker, Auto-Reload)
    uvicorn app.main:app --reload
    
    # Production (Multi-Worker)
    uvicorn app.main:app --workers 4 --host 0.0.0.0 --port 8000
    
    # Oder mit gunicorn für bessere Worker-Verwaltung:
    gunicorn app.main:app -w 4 -k uvicorn.workers.UvicornWorker --bind 0.0.0.0:8000
"""

import multiprocessing
import os

# Worker-Anzahl basierend auf CPU-Kernen
# Formel: (2 * CPU_CORES) + 1 ist eine gute Basis für I/O-bound Apps
cpu_count = multiprocessing.cpu_count()
workers_count = int(os.getenv("WORKERS", (2 * cpu_count) + 1))

# Uvicorn Config
bind = os.getenv("BIND", "0.0.0.0:8000")
workers = workers_count
worker_class = "uvicorn.workers.UvicornWorker"

# Timeouts
timeout = 120
keepalive = 5
graceful_timeout = 30

# Logging
accesslog = "-"
errorlog = "-"
loglevel = os.getenv("LOG_LEVEL", "info")

# Performance
worker_connections = 1000
max_requests = 10000
max_requests_jitter = 1000

print(f"🚀 Starting with {workers} workers (CPU cores: {cpu_count})")
