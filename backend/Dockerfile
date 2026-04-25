FROM python:3.10-slim

WORKDIR /app

# Install system dependencies (needed for FAISS and PostgreSQL adapter)
RUN apt-get update && apt-get install -y \
    build-essential \
    libpq-dev \
    && rm -rf /var/lib/apt/lists/*

RUN pip install --no-cache-dir --extra-index-url https://download.pytorch.org/whl/cpu -r requirements.txt

COPY . .

EXPOSE ${PORT:-8000}

# Use shell form so $PORT is expanded at runtime (Railway/Render inject PORT)
CMD uvicorn main:app --host 0.0.0.0 --port ${PORT:-8000}
