---
name: run-project
description: How to install, run, build, test, and reset the UIGen app locally (Next.js + Prisma/SQLite on Windows). Use whenever asked to run/start/launch the dev server, run tests, build, lint, or reset the database — including as the project-specific skill for the generic "run" skill to discover.
---

# Running UIGen locally

This is a Next.js 15 (App Router) app with a Prisma/SQLite database. All npm scripts on
Windows are wired to run through `node-compat.cjs` automatically (see `package.json`) — you
don't need to set that up manually.

## First-time setup

Run once, or again after any `prisma/schema.prisma` change:

```bash
npm run setup
```

This installs dependencies, generates the Prisma client, and runs migrations against the
local SQLite dev database.

## Start the dev server

```bash
npm run dev
```

Starts Next.js with Turbopack at **http://localhost:3000**. Prefer `run_in_background: true`
(Bash tool) or the project's own dev workflow if you need to keep working while it's up —
watch the output for the "Ready" line and the actual port (falls back to 3001+ if 3000 is
taken).

No `ANTHROPIC_API_KEY` is required to exercise the generation flow: `getLanguageModel()`
(`src/lib/provider.ts`) falls back to `MockLanguageModel`, a scripted fake that replays a
canned tool-call sequence, so chat/generation works fully offline.

## Build

```bash
npm run build
```

Production build. Run this to catch type/build errors before considering a change done.

## Lint

```bash
npm run lint
```

Runs `next lint`.

## Tests

```bash
npm test              # vitest in watch mode (don't use this for one-shot verification)
npm test -- --run            # run the full suite once and exit
npm test -- path/to/file     # run a single test file once
```

Tests are co-located in `__tests__` directories next to the module they cover (e.g.
`src/lib/transform/__tests__`), not in one top-level folder — follow that convention if you
add new ones.

## Reset the dev database

```bash
npm run db:reset
```

Runs `prisma migrate reset --force` against the local SQLite DB. Destructive — wipes local
data. Only run if asked or if migrations are broken.

## Troubleshooting

- **SSR errors mentioning `localStorage`/`sessionStorage`**: expected root cause is Node 25's
  experimental storage globals confusing feature-detection in a dependency. All npm scripts
  already set `NODE_OPTIONS=--require ./node-compat.cjs` to strip those globals during SSR —
  if you're invoking `next`/`node` directly instead of via an npm script, you'll need to set
  that env var yourself.
- **Chat/generation doesn't call a real model**: expected in this environment unless
  `ANTHROPIC_API_KEY` is set — the mock model in `src/lib/provider.ts` is designed to make the
  full flow (create component → edit → create `App.jsx` → summary) work without one.
