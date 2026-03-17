# H2A-PQC Device Simulator
# Simulates constrained IoT devices with PQC capabilities
# =========================================================

FROM python:3.11-slim AS base

# Install system dependencies required for liboqs
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    cmake \
    ninja-build \
    libssl-dev \
    git \
    && rm -rf /var/lib/apt/lists/*

# Set working directory
WORKDIR /app

# Copy requirements first for better caching
COPY requirements.txt .

# Install Python dependencies
RUN pip install --no-cache-dir -r requirements.txt

# Copy source code
COPY src/ ./src/

# Environment variables (can be overridden)
ENV DEVICE_ID=device-001
ENV DEVICE_TIER=1
ENV GATEWAY_URL=http://edge-gateway:4000
ENV TELEMETRY_INTERVAL_MS=1000
ENV PQC_ALGORITHM=dilithium2
ENV ENABLE_METRICS=true
ENV PYTHONUNBUFFERED=1

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD python -c "import sys; sys.exit(0)"

# Run the device simulator
CMD ["python", "-m", "src.device"]
