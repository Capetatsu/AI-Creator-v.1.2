# Alternative to render.yaml: a single container running the backend,
# which also serves the built frontend (see backend/server.js).
#
# Build:  docker build -t autonomous-ai-creator .
# Run:    docker run -p 3001:3001 --env-file backend/.env autonomous-ai-creator
#
# Note: SQLite is written to /app/backend/database.sqlite inside the
# container. Mount a volume there if you need the data to survive
# container recreation:
#   docker run -p 3001:3001 -v ai-creator-data:/app/backend autonomous-ai-creator

FROM node:22.5-slim

WORKDIR /app

COPY backend/package*.json backend/
COPY frontend/package*.json frontend/

RUN npm install --prefix backend --omit=dev \
 && npm install --prefix frontend

COPY backend backend
COPY frontend frontend

RUN npm run build --prefix frontend

ENV PORT=3001
EXPOSE 3001

CMD ["node", "backend/server.js"]
