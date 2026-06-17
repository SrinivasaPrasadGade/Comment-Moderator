# Use an official lightweight Python image
FROM python:3.10-slim

# Set work directory
WORKDIR /app

# Install system dependencies if any are needed (e.g. for building packages)
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    && rm -rf /var/lib/apt/lists/*

# Copy requirements and install python packages
COPY backend/requirements.txt ./backend/requirements.txt
RUN pip install --no-cache-dir --upgrade pip && \
    pip install --no-cache-dir -r backend/requirements.txt

# Copy application files
COPY backend/ ./backend/
COPY frontend/ ./frontend/

# Expose the port. Hugging Face Spaces runs on port 7860 by default.
EXPOSE 7860

# Start the application using gunicorn with gevent websocket worker, bound to port 7860
CMD ["gunicorn", "-k", "geventwebsocket.gunicorn.workers.GeventWebSocketWorker", "-w", "1", "--chdir", "backend", "-b", "0.0.0.0:7860", "app:app"]
