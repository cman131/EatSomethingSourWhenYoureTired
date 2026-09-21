# CLAUDE.md - Mahjong Club Website

## Quick Reference

- **Project**: Mahjong Club Website (`mahjong-site`)
- **Stack**: TypeScript / React 18 (frontend), Node.js / Express (backend), MongoDB

## Build & Test Commands

```bash
# Build (frontend)
cd client && npm run build

# Run all tests — --watchAll=false is mandatory, the process hangs indefinitely without it
cd client && npm test -- --watchAll=false

# Run a single test file
cd client && npm test -- --watchAll=false --testPathPattern="path/to/spec"

# Start frontend dev server
cd client && npm start

# Start backend dev server
cd server && npm run dev
```

## Project Structure

```text
mahjong-site/
  client/
    src/
      components/   # Shared React components
      contexts/     # React contexts (AuthContext, etc.)
      hooks/        # Custom React hooks
      pages/        # Page-level route components
      services/     # API service layer (HTTP calls)
      types/        # TypeScript type definitions
      utils/        # Utility functions
  server/
    src/
      models/       # Mongoose models (User, Game, Tournament, etc.)
      routes/       # Express route handlers
      middleware/   # auth, validation, error handling
      utils/        # Server-side utilities
docs/
  decisions/        # Architecture Decision Records (ADRs)
.claude/
  rules/rules.md    # Coding standards, conventions
  rules/context.md  # Domain concepts, architecture, integrations
  commands/         # Custom slash commands
  agents/           # Custom subagent definitions
  skills/           # Project-specific and reusable skills
.ai/
  instructions.md   # Org-standard AI workspace instructions
```

## Key Architectural Decisions

- All API endpoints require JWT auth except `/api/auth/register` and `/api/auth/login` — enforced by the `authenticateToken` middleware in `server/src/middleware/auth.js`
- Frontend reads API base URL from `REACT_APP_API_URL` env var — never hardcode localhost URLs in source
- Games require verification by a second player before counting toward ranked stats

## Documentation

Architecture documentation lives in `docs/`. Start at `docs/index.md` if present.

## Custom Commands

- `/test` — Detect changed projects, run tests, analyze failures, flag coverage gaps
- `/review` — Review code changes against project rules and patterns
- `/improve` — Review, test, and iteratively fix code changes
- `/tech-debt` — Score and route tech debt in changed files
- `/bug-handoff` — Build a structured bug investigation handoff document
- `/coverage-report` — Fetch CI pipeline coverage (GitHub Actions — not yet configured)
- `/learn` — Extract reusable patterns from the current session into a learned skill
- `/model-route` — Recommend the cheapest viable model for a given task
