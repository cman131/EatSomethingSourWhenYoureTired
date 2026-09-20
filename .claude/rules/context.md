# context.md - Project Architecture & Domain Context

## What This Service Does

A club management web application for a local mahjong group. Players register accounts, submit completed 4-player games with scores, and verify each other's game submissions. The app tracks statistics over time, runs a ranked league, manages tournaments, and provides educational resources (score calculator, discard/decision quizzes, penalties search).

## Core Domain Concepts

- **Game**: A completed 4-player mahjong game. Has a scores array (one entry per player), a `verifiedBy` field (set when another player confirms it), and counts toward stats only after verification.
- **User**: A registered club member. Has a profile with cumulative stats (games played, avg score, wins). Users can search for each other by name to add as game participants.
- **Tournament**: A club tournament with a registration/waitlist phase, game submission phase, and admin tools for reviewing results.
- **RankedLeague**: A persistent ladder that updates as verified games are submitted.
- **Achievement**: A milestone badge earned automatically when a user meets certain statistical thresholds.

## Architecture Reference

Monorepo:
- `client/` — Create React App (TypeScript). SPA served separately from the API. Communicates with the backend exclusively over HTTP via the service layer in `client/src/services/`.
- `server/` — Node.js/Express REST API. Entry point: `server/src/server.js`. Route handlers in `server/src/routes/`; business logic lives in route handlers (no separate service layer currently).

No real-time layer (no WebSockets). No background jobs or queues.

## Authentication & Authorization

JWT-based auth with access + refresh tokens.

- `POST /api/auth/register` and `POST /api/auth/login` are unauthenticated.
- All other routes require a valid JWT in the `Authorization: Bearer <token>` header, validated by `server/src/middleware/auth.js`'s `authenticateToken` function.
- Tokens are issued on login and refreshable via `POST /api/auth/refresh-token`.
- Frontend stores tokens in memory via `AuthContext` (`client/src/contexts/AuthContext.tsx`).

## Key Configuration Files

- `server/.env` — `PORT`, `MONGODB_URI`, `JWT_SECRET`, `JWT_EXPIRE`, `FRONTEND_URL`; copy from `server/env.example`
- `client/.env` — `REACT_APP_API_URL`, `REACT_APP_ENV`; copy from `client/env.example`
- `client/tsconfig.json` — TypeScript config for the frontend; strict mode enabled
- `client/tailwind.config.js` — Tailwind CSS configuration

## Local Development

1. Start MongoDB locally (or set `MONGODB_URI` to a cloud connection string)
2. `cd server && npm install && npm run dev` — API on `http://localhost:5000`
3. `cd client && npm install && npm start` — SPA on `http://localhost:3000`

Both `server/` and `client/` require their own `.env` files before first run.
