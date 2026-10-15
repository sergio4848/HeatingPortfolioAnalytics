FROM node:24-alpine AS web
WORKDIR /src
COPY apps/web/package*.json apps/web/
RUN cd apps/web && npm ci
COPY apps/web apps/web
COPY packages/brand packages/brand
RUN cd apps/web && npm run build
FROM python:3.11-slim
WORKDIR /app
COPY requirements.lock.txt .
RUN pip install --no-cache-dir -r requirements.lock.txt
COPY . .
COPY --from=web /src/apps/web/dist apps/web/dist
RUN useradd --create-home app && chown -R app:app /app
USER app
EXPOSE 8000
CMD ["sh", "-c", "python -m alembic upgrade head && python -m apps.api.seed && python -m uvicorn apps.api.main:app --host 0.0.0.0 --port 8000"]
