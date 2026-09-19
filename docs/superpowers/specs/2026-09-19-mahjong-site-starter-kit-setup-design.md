# Design: Apply claude-project-setup Starter Kit to mahjong-site

**Date:** 2026-09-19
**Status:** Approved

## What We're Doing

Applying the `claude-project-setup` template to `mahjong-site` so the repo has a full Claude Code workspace — coding rules, commands, agents, skills, and context docs — configured accurately for this project's stack and workflow.

## Section 1: What Gets Copied and What Gets Skipped

### Copied verbatim from template
- `CLAUDE.md` (top-level, filled with project tokens)
- `.claude/settings.json` (merged with existing `settings.local.json` which is left untouched)
- `.claude/agents/` — all 4 agents: mutation-tester, planner, story-author, agentic-engineer
- `.claude/commands/` — all 8 commands: learn, improve, coverage-report, tech-debt, review, test, bug-handoff, model-route
- `.claude/rules/rules.md` — with profile addendum merged in
- `.claude/rules/context.md` — written from scratch (see Section 3), replacing `context.md.template`
- `.ai/` — verbatim, as the README instructs (org-standard, not templated)

### Skills — kept
All skills including the full planning bundle:
- `author-feature`, `authoring-prds`, `prd-to-feature`, `feature-to-stories`, `load-feature-context`, `reviewing-prd-scope`
- `clean-code-refactor`, `continuous-learning`, `tdd-workflow`, `local-db-qa`, `tech-debt-scorer`
- `speed-aware-llm-pipeline`, `verify-production`, `troubleshoot-bug`
- `fix-linting` (from typescript-angular profile)

### Skills — deleted (don't apply to this project)
- `test-message-bus-listener` — no message bus
- `test-message-bus-publisher` — no message bus
- `log-query` — no log aggregation platform (console/local logs only)

### Profile: typescript-angular (adapted)
Used as the base for the rules addendum, with Angular-specific content replaced:
- Target: TypeScript + React 18 (not Angular)
- Async: `async/await` + React hooks (not RxJS / `takeUntilDestroyed`)
- Testing: Jest + React Testing Library (not Karma/Jasmine)
- Linting: `react-app` ESLint preset (not `@angular-eslint`)
- Code style rules (braces, indentation, Prettier) carried over unchanged

`settings-fragment.json` permissions merged into `.claude/settings.json`.

## Section 2: Token Values

| Token | Value |
|---|---|
| `[[PROJECT_NAME]]` | Mahjong Club Website |
| `[[PROJECT_REPO_SLUG]]` | mahjong-site |
| `[[TECH_STACK]]` | TypeScript / React 18 (frontend), Node.js / Express (backend), MongoDB |
| `[[DATA_STORE]]` | MongoDB (Mongoose ODM) |
| `[[MESSAGE_BUS]]` | *(line deleted — no message bus)* |
| `[[LOG_PLATFORM]]` | N/A — console/local logs only |
| `[[ISSUE_TRACKER]]` | GitHub Issues |
| `[[ISSUE_TRACKER_PROJECT]]` | mahjong-site |
| `[[CI_PLATFORM]]` | GitHub Actions (placeholder — not set up yet) |
| `[[PIPELINE_ID]]` | N/A |
| `[[BUILD_COMMAND]]` | `cd client && npm run build` |
| `[[TEST_COMMAND]]` | `cd client && npm test -- --watchAll=false` |
| `[[TEST_PROJECTS]]` | client |
| `[[TEST_FRAMEWORK]]` | Jest (via react-scripts) |
| `[[MOCK_LIBRARY]]` | Jest mocks (built-in) |
| `[[ASSERTION_LIBRARY]]` | Jest expect / React Testing Library |
| `[[SOURCE_FILE_GLOB]]` | `**/*.{ts,tsx,js}` |
| `[[LINE_ENDING_STYLE]]` | LF |
| `[[FEATURE_DOMAIN_FOLDERS]]` | Games/, Tournaments/, Users/, Auth/, Resources/ |
| `[[PLANNING_REPO]]` | mahjong-site (same repo) |
| `[[PRODUCT_VISION_DOC]]` | TBD — no doc exists yet |
| `[[PRODUCT_AREA]]` | Mahjong Club Platform |
| `[[PARENT_DOC_LINK]]` | N/A |
| `[[ACCESS_MODEL]]` | JWT-based auth (registered users) |

## Section 3: context.md Content

The `context.md` will be written as real prose (not a skeleton) with these sections:

**Domain overview:** A club management site for a local mahjong group. Players register, submit completed 4-player games with scores, verify each other's games, and track statistics. Includes a ranked league, tournament tracking, achievements, and educational resources (score calculator, discard/decision quizzes, penalties search).

**Architecture:** Monorepo with `client/` (Create React App / TypeScript SPA) and `server/` (Node.js / Express REST API). They communicate over HTTP — no real-time layer. JWT access + refresh token auth pattern. MongoDB accessed via Mongoose ODM.

**Data model key entities:** User, Game (4 players, scores, verified flag), Tournament, RankedLeague, Achievement.

**Feature domains:** Auth (register/login/refresh/password-reset), Games (submit/verify/list/detail), Users (profiles/stats/search), Tournaments (submit/detail/admin/waitlist/games), Resources (penalties search, score calculator, discard quiz, decision quiz), RankedLeague.

**Local dev:** MongoDB required locally; `.env` files required in both `client/` and `server/` (see `env.example` in each). Start with `cd server && npm run dev` then `cd client && npm start`.

**Integrations:** None — no external services, no message bus, no log platform, no CI pipeline yet.
