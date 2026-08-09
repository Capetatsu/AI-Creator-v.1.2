# Autonomous AI Creator — Frontend

React + Vite dashboard that displays an AI content agent's status and post feed.

## Setup

```bash
cd frontend
npm install
cp .env.example .env
```

Edit `.env` and set `VITE_API_URL` to your backend's base URL (e.g. `http://localhost:4000`).

## Run

```bash
npm run dev
```

Opens the dashboard at `http://localhost:5173`.

## Build for production

```bash
npm run build
npm run preview
```

## Notes

- The agent id used to call the feed is a temporary constant (`TEMP_AGENT_ID` in `src/constants.js`) until there's a real agent-selection flow.
- The `/api/agent/feed` response only includes posts, not agent name/domain/status, so those three fields are shown from a placeholder object (`AGENT_DISPLAY_INFO`) in the same file — swap them for real data once the backend exposes it.
