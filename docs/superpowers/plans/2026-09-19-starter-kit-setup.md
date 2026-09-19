# Starter Kit Setup Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Apply the `claude-project-setup` template to `mahjong-site`, giving it a fully configured Claude Code workspace — CLAUDE.md, rules, context, commands, agents, and skills — accurate for this project's React/Node/MongoDB stack.

**Architecture:** File-copy and token-substitution operation. All changes are in `mahjong-site/`. The existing `.claude/settings.local.json` is never touched. Three skills are deleted (no message bus, no log platform). The `typescript-angular` profile is the base but adapted to React/Node/Jest.

**Tech Stack:** Node.js/Express (backend), TypeScript/React 18/CRA (frontend), MongoDB/Mongoose, Jest (tests)

---

## File Map

| Action | Path |
|--------|------|
| Copy verbatim | `.ai/` (whole directory) |
| Create | `.claude/settings.json` |
| Create | `CLAUDE.md` |
| Copy verbatim | `.claude/agents/mutation-tester.md` |
| Copy verbatim | `.claude/agents/planner.md` |
| Copy verbatim | `.claude/agents/story-author.md` |
| Copy verbatim | `.claude/agents/agentic-engineer.md` |
| Create (with tokens) | `.claude/commands/test.md` |
| Create (with tokens) | `.claude/commands/coverage-report.md` |
| Create (with tokens) | `.claude/commands/bug-handoff.md` |
| Copy verbatim | `.claude/commands/review.md` |
| Copy verbatim | `.claude/commands/improve.md` |
| Copy verbatim | `.claude/commands/learn.md` |
| Copy verbatim | `.claude/commands/model-route.md` |
| Copy verbatim | `.claude/commands/tech-debt.md` |
| Create (merged) | `.claude/rules/rules.md` |
| Create (from scratch) | `.claude/rules/context.md` |
| Copy + fill tokens | `.claude/skills/tdd-workflow/SKILL.md` |
| Copy + fill tokens | `.claude/skills/local-db-qa/SKILL.md` |
| Copy + fill tokens | `.claude/skills/tech-debt-scorer/SKILL.md` |
| Copy + fill tokens | `.claude/skills/troubleshoot-bug/SKILL.md` |
| Copy + fill tokens | `.claude/skills/verify-production/SKILL.md` |
| Copy + fill tokens | `.claude/skills/authoring-prds/SKILL.md` |
| Copy + fill tokens | `.claude/skills/authoring-prds/prd-template.md` |
| Copy + fill tokens | `.claude/skills/prd-to-feature/SKILL.md` |
| Copy + fill tokens | `.claude/skills/feature-to-stories/SKILL.md` |
| Copy + fill tokens | `.claude/skills/load-feature-context/SKILL.md` |
| Copy + fill tokens | `.claude/skills/reviewing-prd-scope/SKILL.md` |
| Copy verbatim | `.claude/skills/author-feature/SKILL.md` |
| Copy verbatim | `.claude/skills/clean-code-refactor/SKILL.md` |
| Copy verbatim | `.claude/skills/continuous-learning/SKILL.md` |
| Copy verbatim | `.claude/skills/continuous-learning/config.json` |
| Copy verbatim | `.claude/skills/continuous-learning/hooks/observe.sh` |
| Copy verbatim | `.claude/skills/continuous-learning/scripts/detect-project.sh` |
| Copy verbatim | `.claude/skills/speed-aware-llm-pipeline/SKILL.md` |
| Copy verbatim | `.claude/skills/speed-aware-llm-pipeline/hooks/cost-tracker.sh` |
| Copy from profile | `.claude/skills/fix-linting/SKILL.md` |
| **Delete** | `.claude/skills/test-message-bus-listener/` |
| **Delete** | `.claude/skills/test-message-bus-publisher/` |
| **Delete** | `.claude/skills/log-query/` |
| Preserve | `.claude/settings.local.json` |

---

### Task 1: Create directory structure and copy .ai/

**Files:**
- Create: `.ai/` (all contents)

- [ ] **Step 1: Create .claude subdirectories**

```bash
cd C:\Users\conor\workbench\mahjong-site
mkdir -p .claude/agents .claude/commands .claude/rules .claude/skills
```

Expected: directories created with no error.

- [ ] **Step 2: Copy the .ai/ directory verbatim**

```bash
cp -r C:\Users\conor\workbench\claude-project-setup\template\.ai .
```

If on Windows PowerShell:
```powershell
Copy-Item -Recurse -Force "C:\Users\conor\workbench\claude-project-setup\template\.ai" "C:\Users\conor\workbench\mahjong-site\.ai"
```

- [ ] **Step 3: Verify**

```bash
ls .ai/
```

Expected output includes: `instructions.md`, `version`, `overrides/`, `playbooks/`, `skills/`

- [ ] **Step 4: Commit**

```bash
git add .ai/
git commit -m "feat: add .ai org-standard workspace layer"
```

---

### Task 2: Create .claude/settings.json

**Files:**
- Create: `.claude/settings.json`

- [ ] **Step 1: Write settings.json**

Write the file at `.claude/settings.json` with this exact content (merges template hooks + template permissions + typescript-angular permissions adapted for React/Node):

```json
{
  "hooks": {
    "PreToolUse": [
      {
        "matcher": "",
        "hooks": [
          {
            "type": "command",
            "command": "\"$CLAUDE_PROJECT_DIR\"/.claude/skills/continuous-learning/hooks/observe.sh pre"
          }
        ]
      }
    ],
    "PostToolUse": [
      {
        "matcher": "",
        "hooks": [
          {
            "type": "command",
            "command": "\"$CLAUDE_PROJECT_DIR\"/.claude/skills/continuous-learning/hooks/observe.sh post"
          }
        ]
      },
      {
        "matcher": "",
        "hooks": [
          {
            "type": "command",
            "command": "\"$CLAUDE_PROJECT_DIR\"/.claude/skills/speed-aware-llm-pipeline/hooks/cost-tracker.sh"
          }
        ]
      }
    ]
  },
  "permissions": {
    "allow": [
      "Bash(git status *)",
      "Bash(git diff *)",
      "Bash(git log *)",
      "Bash(git branch *)",
      "Bash(git checkout *)",
      "Bash(git add *)",
      "Bash(git stash *)",
      "Bash(ls *)",
      "Bash(mkdir *)",
      "Bash(cp *)",
      "Bash(mv *)",
      "Bash(npm test *)",
      "Bash(npm run build *)",
      "Bash(npm start *)",
      "Bash(npm run dev *)"
    ],
    "deny": [
      "Bash(rm -rf *)",
      "Bash(git push --force *)",
      "Bash(git reset --hard *)",
      "Bash(git clean -f *)"
    ]
  }
}
```

- [ ] **Step 2: Verify settings.local.json is untouched**

```bash
cat .claude/settings.local.json
```

Expected: the original content with the existing `npm install`, `node -e`, and `npx tsc` permissions.

- [ ] **Step 3: Commit**

```bash
git add .claude/settings.json
git commit -m "feat: add .claude/settings.json with hooks and permissions"
```

---

### Task 3: Write CLAUDE.md

**Files:**
- Create: `CLAUDE.md`

- [ ] **Step 1: Write CLAUDE.md**

Write the file at `CLAUDE.md` with this exact content:

```markdown
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

## Creating Pull Requests

When creating pull requests, default to creating a Draft pull request instead of a
published one. If the user seems to want a published one, ask for confirmation before
creating one instead of a Draft.

## Custom Commands

- `/test` — Detect changed projects, run tests, analyze failures, flag coverage gaps
- `/review` — Review code changes against project rules and patterns
- `/improve` — Review, test, and iteratively fix code changes
- `/tech-debt` — Score and route tech debt in changed files
- `/bug-handoff` — Build a structured bug investigation handoff document
- `/coverage-report` — Fetch CI pipeline coverage (GitHub Actions — not yet configured)
- `/learn` — Extract reusable patterns from the current session into a learned skill
- `/model-route` — Recommend the cheapest viable model for a given task
```

- [ ] **Step 2: Verify CLAUDE.md has no remaining [[tokens]]**

```bash
grep -n '\[\[' CLAUDE.md
```

Expected: no output.

- [ ] **Step 3: Commit**

```bash
git add CLAUDE.md
git commit -m "feat: add CLAUDE.md project workspace config"
```

---

### Task 4: Copy agents

**Files:**
- Create: `.claude/agents/mutation-tester.md`
- Create: `.claude/agents/planner.md`
- Create: `.claude/agents/story-author.md`
- Create: `.claude/agents/agentic-engineer.md`

- [ ] **Step 1: Copy all 4 agent files**

```powershell
Copy-Item -Force "C:\Users\conor\workbench\claude-project-setup\template\.claude\agents\*" "C:\Users\conor\workbench\mahjong-site\.claude\agents\"
```

- [ ] **Step 2: Verify all 4 agents exist**

```bash
ls .claude/agents/
```

Expected: `agentic-engineer.md`, `mutation-tester.md`, `planner.md`, `story-author.md`

- [ ] **Step 3: Check for tokens in agents**

```bash
grep -rn '\[\[' .claude/agents/
```

Expected: no output (agents use no placeholder tokens).

- [ ] **Step 4: Commit**

```bash
git add .claude/agents/
git commit -m "feat: add .claude agents (agentic-engineer, planner, story-author, mutation-tester)"
```

---

### Task 5: Write commands with tokens substituted

**Files:**
- Create: `.claude/commands/test.md` (tokens filled)
- Create: `.claude/commands/coverage-report.md` (tokens filled)
- Create: `.claude/commands/bug-handoff.md` (tokens filled)
- Copy verbatim: `review.md`, `improve.md`, `learn.md`, `model-route.md`, `tech-debt.md`

- [ ] **Step 1: Copy the verbatim commands**

```powershell
$src = "C:\Users\conor\workbench\claude-project-setup\template\.claude\commands"
$dst = "C:\Users\conor\workbench\mahjong-site\.claude\commands"
foreach ($f in @("review.md","improve.md","learn.md","model-route.md","tech-debt.md")) {
  Copy-Item "$src\$f" "$dst\$f" -Force
}
```

- [ ] **Step 2: Copy test.md then substitute tokens**

Copy `template/.claude/commands/test.md` to `.claude/commands/test.md`, then make these substitutions in the file:

| Token | Replace with |
|-------|-------------|
| `[[BUILD_COMMAND]]` | `cd client && npm run build` |
| `[[TEST_COMMAND]]` | `cd client && npm test -- --watchAll=false` |
| `[[TEST_PROJECTS]]` | `client` |

After substitution, the two key lines in the file should read:
```
[[BUILD_COMMAND]] → cd client && npm run build
[[TEST_COMMAND]] → cd client && npm test -- --watchAll=false
```
And the reference to `[[TEST_PROJECTS]]` in section 3 should read:
```
cd client && npm test -- --watchAll=false
```

- [ ] **Step 3: Copy coverage-report.md then substitute tokens**

Copy `template/.claude/commands/coverage-report.md` to `.claude/commands/coverage-report.md`, then make these substitutions:

| Token | Replace with |
|-------|-------------|
| `[[CI_PLATFORM]]` | `GitHub Actions` |
| `[[PIPELINE_ID]]` | `N/A` |
| `[[ISSUE_TRACKER_PROJECT]]` | `mahjong-site` |

- [ ] **Step 4: Copy bug-handoff.md then substitute tokens**

Copy `template/.claude/commands/bug-handoff.md` to `.claude/commands/bug-handoff.md`, then make these substitutions:

| Token | Replace with |
|-------|-------------|
| `[[ISSUE_TRACKER]]` | `GitHub Issues` |
| `[[ISSUE_TRACKER_PROJECT]]` | `mahjong-site` |

- [ ] **Step 5: Clean up profile cross-references in test.md**

In `.claude/commands/test.md`, find and replace all occurrences of the pattern `See \`profiles/<your-stack>/commands-test-addendum.md\`` with the actual content. There are two:

First occurrence (in step 3 "Run tests"):
Replace: `See \`profiles/<your-stack>/commands-test-addendum.md\` for this stack's exact test/coverage invocation and named test projects/modules ([[TEST_PROJECTS]] — list this project's actual test projects/modules and, for each, when to target it vs. running the full suite).`
With: `Test project: **client**. Run the full suite when changes span components, hooks, or services. Target a single file with \`--testPathPattern\` when only one component changed.`

Second occurrence (in step 5a "Find the coverage report"):
Replace: `(format and location are stack-specific — see \`profiles/<your-stack>/commands-test-addendum.md\`)`
With: `(Jest writes it to \`client/coverage/lcov-report/\` when run with \`--coverage\`)`

Last occurrence (in Key conventions):
Replace: `See \`.claude/rules/rules.md\` and \`profiles/<your-stack>/rules-addendum.md\` for this project's test framework, mocking library, assertion style, and naming conventions.`
With: `See \`.claude/rules/rules.md\` for this project's test framework (Jest), assertion style (Jest expect / React Testing Library), and naming conventions.`

- [ ] **Step 6: Clean up profile cross-references in review.md**

In `.claude/commands/review.md`, find all occurrences of `profiles/<your-stack>/rules-addendum.md` and replace with `.claude/rules/rules.md`. There are three occurrences in the "See profiles/..." lines at the ends of the Idempotency, Code Style, and Testing sections.

- [ ] **Step 7: Verify no remaining tokens in commands**

```bash
grep -rn '\[\[' .claude/commands/
grep -rn 'profiles/<your-stack>' .claude/commands/
```

Expected: no output for either command.

- [ ] **Step 8: Commit**

```bash
git add .claude/commands/
git commit -m "feat: add .claude commands with project tokens filled"
```

---

### Task 6: Write rules.md (template + adapted typescript-angular addendum)

**Files:**
- Create: `.claude/rules/rules.md`

- [ ] **Step 1: Copy template rules.md**

```powershell
Copy-Item "C:\Users\conor\workbench\claude-project-setup\template\.claude\rules\rules.md" "C:\Users\conor\workbench\mahjong-site\.claude\rules\rules.md" -Force
```

- [ ] **Step 2: Fill the two base tokens**

In `.claude/rules/rules.md`, make these substitutions:

| Token | Replace with |
|-------|-------------|
| `[[LINE_ENDING_STYLE]]` | `LF` |
| `[[FEATURE_DOMAIN_FOLDERS]]` | `Games/, Tournaments/, Users/, Auth/, Resources/` |

- [ ] **Step 3: Replace the profile placeholder with the actual adapted addendum**

The template has two occurrences of `See profiles/<your-stack>/rules-addendum.md` — one in the Language & Framework section and one in Async Patterns. Replace the entire section from `## Language & Framework Settings` through the Async Patterns section placeholder with the actual content below.

Find this in the file:
```
## Language & Framework Settings

See profiles/<your-stack>/rules-addendum.md for language/framework-specific settings (target version, nullable/strict-mode config, file organization conventions).
```

Replace with:
```markdown
## Language & Framework Settings

- **Frontend target**: TypeScript 4.9+, React 18 — pin exact major versions in `package.json`
- **Backend target**: Node.js (CommonJS modules, `require`/`module.exports`), Express 4
- **Strict mode**: Enabled (`"strict": true` in `client/tsconfig.json`) — all frontend code must be null-safe
- **Linting**: ESLint via `react-app` preset on the frontend; standard ESLint on the backend
```

Find this in the file:
```
## Async Patterns

See profiles/<your-stack>/rules-addendum.md for this stack's async conventions.
```

Replace with:
```markdown
## Async Patterns

- Prefer `async`/`await` for all async logic — no raw `.then()` chains
- In React components, handle loading and error states explicitly — never leave the user staring at an empty component while data is fetching
- On the backend, always pass errors to `next(err)` in Express route handlers — do not let unhandled promise rejections crash the server
```

Also find the Testing Standards section placeholder:
```
See profiles/<your-stack>/rules-addendum.md for this stack's test framework, mocking library, and assertion library conventions. Keep test class/method naming conventions generic: `{ClassUnderTest}Tests`, `{MethodName}_{Scenario}_{ExpectedResult}`.
```

Add these lines immediately after:
```markdown
- **Framework**: Jest (via `react-scripts test`)
- **Component testing**: React Testing Library — query by accessible role/label, not CSS class or DOM structure
- Run tests with `--watchAll=false` so the process exits; never omit this flag
- Prefer `screen.getByRole` and `screen.getByLabelText` over `querySelector` in component tests
```

Also find the Code Style Rules placeholder:
```
See profiles/<your-stack>/rules-addendum.md for this stack's brace style, `this.`/self qualifier convention, indentation width, and expression-body usage — these vary by language and are defined there, not here.
```

Add these lines immediately after:
```markdown
- **Braces**: Same-line (K&R-style) — opening brace on the same line as the declaration
- **`this.` qualifier**: Not applicable in functional React — use plain variable names in hooks and components
- **Indentation**: 2 spaces
- **Formatting**: Prettier-enforced — run `prettier --check` before considering work done
```

- [ ] **Step 4: Verify no remaining profile placeholders or [[tokens]]**

```bash
grep -n 'profiles/<your-stack>' .claude/rules/rules.md
grep -n '\[\[' .claude/rules/rules.md
```

Expected: the only remaining `profiles/<your-stack>` references should be in `test.md` and `commands/` (intentionally left pointing at the profile for reference). In `rules.md` itself, expected: no output.

- [ ] **Step 5: Commit**

```bash
git add .claude/rules/rules.md
git commit -m "feat: add rules.md with React/Node/Jest conventions"
```

---

### Task 7: Write context.md

**Files:**
- Create: `.claude/rules/context.md`

- [ ] **Step 1: Write context.md**

Write the file at `.claude/rules/context.md` with this exact content:

```markdown
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
```

- [ ] **Step 2: Verify no [[tokens]] in context.md**

```bash
grep -n '\[\[' .claude/rules/context.md
```

Expected: no output.

- [ ] **Step 3: Commit**

```bash
git add .claude/rules/context.md
git commit -m "feat: add context.md with domain and architecture documentation"
```

---

### Task 8: Copy and configure skills

**Files:**
- Create: all skills listed in the file map (copy + fill tokens)

- [ ] **Step 1: Copy all template skills**

```powershell
Copy-Item -Recurse -Force "C:\Users\conor\workbench\claude-project-setup\template\.claude\skills\*" "C:\Users\conor\workbench\mahjong-site\.claude\skills\"
```

- [ ] **Step 2: Delete the three inapplicable skills**

```powershell
Remove-Item -Recurse -Force ".claude\skills\test-message-bus-listener"
Remove-Item -Recurse -Force ".claude\skills\test-message-bus-publisher"
Remove-Item -Recurse -Force ".claude\skills\log-query"
```

- [ ] **Step 3: Copy fix-linting skill from the typescript-angular profile**

```powershell
Copy-Item -Recurse -Force "C:\Users\conor\workbench\claude-project-setup\profiles\typescript-angular\skills\fix-linting" "C:\Users\conor\workbench\mahjong-site\.claude\skills\fix-linting"
```

- [ ] **Step 4: Substitute tokens in tdd-workflow/SKILL.md**

In `.claude/skills/tdd-workflow/SKILL.md`, make these substitutions:

| Token | Replace with |
|-------|-------------|
| `[[TEST_FRAMEWORK]]` | `Jest` |
| `[[MOCK_LIBRARY]]` | `Jest mocks (built-in)` |
| `[[ASSERTION_LIBRARY]]` | `Jest expect / React Testing Library` |
| `[[TEST_COMMAND]]` | `cd client && npm test -- --watchAll=false` |
| `[[BUILD_COMMAND]]` | `cd client && npm run build` |
| `[[TEST_PROJECTS]]` | `client` |

- [ ] **Step 5: Substitute tokens in local-db-qa/SKILL.md**

In `.claude/skills/local-db-qa/SKILL.md`, make these substitutions:

| Token | Replace with |
|-------|-------------|
| `[[DATA_STORE]]` | `MongoDB (Mongoose ODM)` |
| `[[QUERY_SYNTAX]]` | `MongoDB shell / mongosh queries` |

- [ ] **Step 6: Substitute tokens in tech-debt-scorer/SKILL.md**

In `.claude/skills/tech-debt-scorer/SKILL.md`, make these substitutions:

| Token | Replace with |
|-------|-------------|
| `[[SOURCE_FILE_GLOB]]` | `**/*.{ts,tsx,js}` |

- [ ] **Step 7: Substitute tokens in troubleshoot-bug/SKILL.md**

In `.claude/skills/troubleshoot-bug/SKILL.md`, make these substitutions:

| Token | Replace with |
|-------|-------------|
| `[[ISSUE_TRACKER]]` | `GitHub Issues` |
| `[[LOG_PLATFORM]]` | `console/local logs (no centralized platform)` |

Also remove the paragraph that references `log-query/SKILL.md` (lines beginning "Before running any log query in this workflow, read `.claude/skills/log-query/SKILL.md`") since that skill has been deleted.

- [ ] **Step 8: Substitute tokens in verify-production/SKILL.md**

In `.claude/skills/verify-production/SKILL.md`, make these substitutions:

| Token | Replace with |
|-------|-------------|
| `[[LOG_PLATFORM]]` | `console/local logs (no centralized platform)` |
| `[[ISSUE_TRACKER]]` | `GitHub Issues` |

- [ ] **Step 9: Substitute tokens in planning skills**

In each of the following files, make the substitutions shown:

**`.claude/skills/authoring-prds/SKILL.md`** and **`.claude/skills/authoring-prds/prd-template.md`**:

| Token | Replace with |
|-------|-------------|
| `[[PLANNING_REPO]]` | `mahjong-site` |
| `[[PRODUCT_VISION_DOC]]` | `docs/product-vision.md (not yet written)` |
| `[[PRODUCT_AREA]]` | `Mahjong Club Platform` |
| `[[PARENT_DOC_LINK]]` | `N/A` |
| `[[ACCESS_MODEL]]` | `JWT-based auth (registered users only)` |
| `[[ISSUE_TRACKER]]` | `GitHub Issues` |
| `[[ISSUE_TRACKER_PROJECT]]` | `mahjong-site` |

**`.claude/skills/prd-to-feature/SKILL.md`**:

| Token | Replace with |
|-------|-------------|
| `[[ISSUE_TRACKER]]` | `GitHub Issues` |
| `[[ISSUE_TRACKER_PROJECT]]` | `mahjong-site` |

**`.claude/skills/feature-to-stories/SKILL.md`**:

| Token | Replace with |
|-------|-------------|
| `[[ISSUE_TRACKER]]` | `GitHub Issues` |
| `[[ISSUE_TRACKER_PROJECT]]` | `mahjong-site` |

**`.claude/skills/load-feature-context/SKILL.md`**:

| Token | Replace with |
|-------|-------------|
| `[[ISSUE_TRACKER]]` | `GitHub Issues` |

**`.claude/skills/reviewing-prd-scope/SKILL.md`**:

| Token | Replace with |
|-------|-------------|
| `[[ISSUE_TRACKER]]` | `GitHub Issues` |

- [ ] **Step 10: Commit skills**

```bash
git add .claude/skills/
git commit -m "feat: add .claude skills configured for React/Node/MongoDB stack"
```

---

### Task 9: Final verification — no remaining tokens

**Files:** All files under `.claude/`, `CLAUDE.md`

- [ ] **Step 1: Grep for any remaining [[tokens]]**

```bash
grep -rn '\[\[' .claude/ CLAUDE.md
```

Expected output: **no matches** (or only intentional ones like `[[...]]` wikilinks in skill docs that are not placeholder tokens — these use the `[[name]]` format inside running prose and are fine).

If any `[[TOKEN_NAME]]` placeholders (all-caps with underscores) are found, fix them by looking up the correct value in the token table in `docs/superpowers/specs/2026-09-19-mahjong-site-starter-kit-setup-design.md`.

- [ ] **Step 2: Verify settings.local.json is still intact**

```bash
cat .claude/settings.local.json
```

Expected: the original file content with `npm install`, `node -e`, and `npx tsc` permissions. If anything changed, restore from git:
```bash
git checkout HEAD -- .claude/settings.local.json
```

- [ ] **Step 3: Verify deleted skills are gone**

```bash
ls .claude/skills/
```

Expected: `test-message-bus-listener/`, `test-message-bus-publisher/`, and `log-query/` are NOT present.

- [ ] **Step 4: Final commit**

```bash
git add -A
git status  # review what's staged — confirm no secrets or node_modules
git commit -m "feat: complete claude-project-setup starter kit application to mahjong-site"
```
