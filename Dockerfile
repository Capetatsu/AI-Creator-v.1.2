FROM node:24-slim

WORKDIR /app

COPY backend/package*.json backend/
COPY agent/package*.json agent/
COPY frontend/package*.json frontend/

RUN npm install --prefix backend --omit=dev \
    && npm install --prefix agent --omit=dev \
    && npm install --prefix frontend

COPY backend backend
COPY agent agent
COPY frontend frontend

RUN npm run build --prefix frontend

ENV PORT=3001

EXPOSE 3001

CMD ["node", "backend/server.js"]