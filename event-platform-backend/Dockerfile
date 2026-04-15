# Use Python 3.11 slim image
FROM python:3.11-slim-bookworm

# Set environment variables
ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PYTHONPATH=/app

# Create working directory
WORKDIR /app

# Install system dependencies (required for psycopg2 and uv)
RUN apt-get update \
    && apt-get install -y --no-install-recommends gcc libpq-dev curl \
    && rm -rf /var/lib/apt/lists/*

# Install uv for fast dependency resolution
# RUN curl -LsSf https://astral.sh/uv/install.sh | sh
ENV PATH="/root/.local/bin:${PATH}"

# Copy pyproject.toml and uv.lock
# COPY pyproject.toml uv.lock ./
COPY requirements.txt .

# Install dependencies directly into the system environment to avoid virtualenv inside Docker
RUN pip install --upgrade pip \
    && pip install --no-cache-dir --default-timeout=100 -r requirements.txt

# Copy project files
COPY . .

# Expose port 8000
EXPOSE 8000

# Start Gunicorn with Uvicorn workers
CMD ["gunicorn", "main:app", "--workers", "4", "--worker-class", "uvicorn.workers.UvicornWorker", "--bind", "0.0.0.0:8000"]
