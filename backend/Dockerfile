FROM mcr.microsoft.com/playwright/python:v1.47.0-jammy

WORKDIR /app/backend
COPY requirements.txt /app/backend/requirements.txt
RUN pip install --no-cache-dir -r /app/backend/requirements.txt

COPY . /app/backend

ENV PYTHONPATH=/app

CMD ["uvicorn", "backend.src.main:app", "--host", "0.0.0.0", "--port", "8000"]
