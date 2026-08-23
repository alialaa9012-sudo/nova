FROM python:3.12-slim

ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PIP_NO_CACHE_DIR=1

WORKDIR /app

# طبقة الاعتماديات منفصلة حتى لا تُعاد مع كل تغيير في الكود
COPY tracker/requirements.txt ./tracker/requirements.txt
RUN pip install --no-cache-dir -r tracker/requirements.txt

COPY tracker ./tracker

EXPOSE 8000
CMD ["sh", "-c", "cd tracker && python -m alembic upgrade head && cd .. && uvicorn tracker.app:app --host 0.0.0.0 --port ${PORT:-8000}"]
