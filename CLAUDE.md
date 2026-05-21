# CLAUDE.md

## Project Overview

Role Reactor Bot is a Discord bot built with Discord.js v14 and Node.js 22. It uses ES modules throughout (`"type": "module"` in package.json). The API server runs on port 3030 and is proxied via Caddy on a self-hosted VPS.

## Tech Stack

- **Runtime:** Node.js 22, ES modules (`import`/`export` everywhere — no `require`)
- **Discord:** Discord.js v14
- **Database:** MongoDB via native driver (`mongodb` package)
- **Package manager:** pnpm 9.9.0 — always use `pnpm`, never `npm` or `yarn`
- **Testing:** Vitest
- **Linting/Formatting:** ESLint + Prettier
- **Deployment:** Docker (multi-stage) + Caddy reverse proxy on VPS

## Key Commands

```bash
pnpm dev                    # Start with nodemon (hot reload)
pnpm start                  # Start without hot reload
pnpm test                   # Run tests (Vitest)
pnpm lint                   # ESLint
pnpm lint:fix               # ESLint with auto-fix
pnpm format                 # Prettier
pnpm run deploy:dev         # Deploy slash commands to dev guild
pnpm run deploy:prod        # Deploy slash commands globally
pnpm run docker:dev         # Start dev Docker environment
pnpm run docker:prod        # Start production Docker environment
pnpm run deploy:latest      # Pull + rebuild + deploy latest on VPS
```

## Project Structure

```
src/
  index.js              # Entry point
  commands/
    admin/              # Server management commands (role-reactions, moderation, etc.)
    general/            # User-facing commands (help, ping, avatar, etc.)
  events/               # Discord event handlers
  features/             # Complex feature modules (giveaway, XP, temp-roles, etc.)
  server/               # Express API server (port 3030)
    routes/             # API route definitions
    controllers/        # Route handlers
    middleware/         # Auth, CORS, rate limiting
  utils/
    core/               # Command handler, event loader, base utilities
    storage/            # MongoDB wrappers
    monitoring/         # Health checks, metrics
    ai/                 # AI provider integrations
    discord/            # Discord-specific helpers
  config/               # Environment config, prompts
scripts/                # Deployment, git helpers, DB migrations
tests/                  # Vitest test files
```

## Git & Branch Workflow

- **`dev`** — integration branch, all work goes here first
- **`main`** — production-ready only, merged from `dev`
- **`feature/*`** — feature branches, merge into `dev`
- **`fix/*`** — bug fix branches, merge into `dev`
- **`hotfix/*`** — critical fixes, merge into `main` and `dev`

**Always commit directly to `dev` unless told otherwise. Never create a worktree unless explicitly asked.**

## Deployment Architecture

```
Internet → Caddy (SSL, api.rolereactor.app) → Docker network → role-reactor-bot:3030
```

- Port 3030 is NOT exposed to the host — Caddy proxies internally
- SSL is automatic via Caddy + Let's Encrypt
- Environment variables come from the host `.env` file, never baked into the image
- `docker-compose.prod.yml` runs both `caddy` and `role-reactor-bot` services

## Code Conventions

- **ES modules only** — `import`/`export`, never `require()`
- **Async/await** over `.then()` chains
- **Structured logging** via `getLogger()` from `src/utils/logger.js` — no `console.log` in production code
- **Error handling** — always handle errors at command/event boundaries; let utilities throw
- **MongoDB** — use helpers in `src/utils/storage/` rather than direct collection access
- **Command structure** — each command exports `{ data, execute }` where `data` is a `SlashCommandBuilder`

## Known Pre-existing Test Failures

`tests/unit/utils/security/sessionSecurity.test.js` has **3 failing tests** (`globalThis.crypto.getRandomValues` is undefined in the Vitest environment). These are **not caused by code changes** — they were failing before any of our work. Do not investigate unless specifically asked to fix them.

Expected result: `3 failed | 1184 passed` (or similar passing count).

## Behavioral Guidelines

**Think before coding.** State assumptions explicitly. If multiple interpretations exist, ask before picking one. If a simpler approach exists, say so.

**Minimum code that solves the problem.** No speculative features, no abstractions for single-use code, no error handling for impossible scenarios.

**Surgical changes.** Touch only what the task requires. Don't improve adjacent code. Don't refactor things that aren't broken. Match existing style.

**Verify before reporting done.** For Docker changes, build and validate. For API changes, check the health endpoint. For commands, confirm the deploy script runs cleanly.
