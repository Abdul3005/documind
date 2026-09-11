# ==============================================================================
# Stage 1: Builder - Build dependencies and wheels
# ==============================================================================
FROM python:3.12-slim AS builder

WORKDIR /build

# Install compilation prerequisites
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Copy dependency manifest
COPY requirements.txt .

# Install dependencies into a standalone wheels directory
RUN pip install --upgrade pip setuptools wheel && \
    pip wheel --no-cache-dir --wheel-dir /build/wheels -r requirements.txt


# ==============================================================================
# Stage 2: Production Runtime
# ==============================================================================
FROM python:3.12-slim AS runtime

# Set operational environment variables
ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PORT=8000 \
    APP_HOME=/app \
    TORCH_HOME=/app/.cache/torch \
    HF_HOME=/app/.cache/huggingface

WORKDIR ${APP_HOME}

# Install runtime utilities
RUN apt-get update && apt-get install -y --no-install-recommends \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Create non-privileged system user for container security
RUN groupadd -r appgroup && useradd -r -g appgroup -d ${APP_HOME} -s /sbin/nologin appuser

# Copy pre-compiled wheels from builder stage
COPY --from=builder /build/wheels /wheels

# Install wheels without dev dependencies
RUN pip install --no-cache-dir --no-index --find-links=/wheels /wheels/* && \
    rm -rf /wheels

# Create cache directories with appropriate ownership
RUN mkdir -p ${APP_HOME}/data ${APP_HOME}/.cache/torch ${APP_HOME}/.cache/huggingface && \
    chown -R appuser:appgroup ${APP_HOME}

# Copy application source code
COPY --chown=appuser:appgroup src/ ./src/
COPY --chown=appuser:appgroup api/ ./api/
COPY --chown=appuser:appgroup tests/ ./tests/
COPY --chown=appuser:appgroup data/ ./data/

# Switch to non-root user
USER appuser

# Healthcheck to probe service readiness
HEALTHCHECK --interval=30s --timeout=10s --start-period=45s --retries=3 \
    CMD curl -f http://localhost:${PORT}/health || exit 1

# Expose service port
EXPOSE 8000

# Start production uvicorn server
CMD ["uvicorn", "api.main:app", "--host", "0.0.0.0", "--port", "8000", "--workers", "1"]
