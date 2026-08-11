# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run setup       # install deps, generate Prisma client, run migrations (run once, or after schema changes)
npm run dev          # start dev server (Next.js + Turbopack) at localhost:3000
npm run build         # production build
npm run lint          # next lint
npm test              # run vitest test suite (watch mode by default)
npm test -- --run           # run once, no watch
npm test -- path/to/file    # run a single test file
npm run db:reset       # reset the SQLite dev database (prisma migrate reset --force)
```

- All npm scripts on Windows set `NODE_OPTIONS=--require ./node-compat.cjs` — this shim deletes the
  Node 25 experimental `localStorage`/`sessionStorage` globals during SSR so libraries that feature-detect
  `window`/`localStorage` don't misfire on the server. Keep this in mind if you ever see SSR errors that
  reference storage APIs.
- No `ANTHROPIC_API_KEY` is required to run the app: `getLanguageModel()` (`src/lib/provider.ts`) falls back
  to `MockLanguageModel`, a hand-scripted fake that replays a canned tool-call sequence (create component →
  edit it → create `App.jsx` → summary) so the whole generation flow works offline/without billing. When
  changing the tool-calling flow, check that the mock's step-counting logic (based on `messages.filter(role
  === "tool").length`) still lines up.

## Architecture

UIGen is a Next.js 15 (App Router) app where an LLM (Claude, via the Vercel AI SDK) generates React
components into an **in-memory virtual file system** — nothing is written to disk. Preview is rendered
client-side via an in-browser Babel transform.

### Core data flow

1. `src/components/chat/ChatInterface.tsx` (and `src/lib/contexts/chat-context.tsx`) drive `useChat` from
   `@ai-sdk/react`, posting to `POST /api/chat` (`src/app/api/chat/route.ts`) with the conversation
   `messages` plus the serialized virtual file system (`fileSystem.serialize()`).
2. The route rebuilds a `VirtualFileSystem` (`src/lib/file-system.ts`) server-side via
   `deserializeFromNodes`, prepends the system prompt (`src/lib/prompts/generation.tsx`, cached with
   Anthropic's `ephemeral` cache control), and calls `streamText` with two tools:
   - `str_replace_editor` (`src/lib/tools/str-replace.ts`) — Anthropic-style text-editor tool: `view`,
     `create`, `str_replace`, `insert` (`undo_edit` is intentionally unimplemented).
   - `file_manager` (`src/lib/tools/file-manager.ts`) — `rename` (also used to "move" files) and `delete`.
   Both tools execute directly against the same `VirtualFileSystem` instance, mutating it as the model
   calls them.
3. On `onFinish`, if a `projectId` was supplied and the user has a session (`src/lib/auth.ts`, JWT in an
   httpOnly cookie), the route persists the updated chat `messages` and `fileSystem.serialize()` as JSON
   strings on the `Project` row (`prisma/schema.prisma`) via `prisma`. Anonymous users' work only lives in
   the client (`src/lib/anon-work-tracker.ts` flags unsaved anonymous work so it can be offered for
   migration after sign-in/sign-up).
4. `src/lib/contexts/file-system-context.tsx` mirrors tool-call side effects into React state
   (`refreshTrigger`) so the file tree/editor/preview re-render as the model edits files mid-stream.
5. `src/lib/transform/jsx-transformer.ts` uses `@babel/standalone` to transpile each virtual file
   (JSX/TSX, `automatic` runtime) in the browser, resolves imports against the virtual file map, and
   `src/components/preview/PreviewFrame.tsx` executes the result in an iframe/blob URL for live preview —
   there is no server-side bundler or real filesystem involved at any point.

### Persistence model

- `VirtualFileSystem` (`src/lib/file-system.ts`) is a `Map`-backed in-memory tree (`FileNode`) with its own
  path normalization, and Anthropic-text-editor-style methods (`viewFile`, `createFileWithParents`,
  `replaceInFile`, `insertInFile`) layered on top of basic CRUD (`createFile`, `readFile`, `updateFile`,
  `deleteFile`, `rename`). `serialize()`/`deserializeFromNodes()` round-trip it to/from the JSON stored in
  `Project.data`; a fresh instance is constructed per API request (server) and per session (client) —
  there's no shared server-side singleton across requests despite the module-level `export const
  fileSystem` instance.
- Prisma/SQLite (`prisma/schema.prisma`) has two models: `User` and `Project`. `Project.messages` and
  `Project.data` are both stored as raw JSON strings (not relational), so a project is really "chat
  transcript + file system snapshot" persisted wholesale on every `onFinish`.
- Auth (`src/lib/auth.ts`) is a minimal hand-rolled JWT-in-cookie session (via `jose`), not a full auth
  library — `createSession`/`getSession`/`deleteSession` for server actions/route handlers,
  `verifySession` for middleware-style use with a `NextRequest`.

### Where things live

- `src/actions/` — server actions for project CRUD (`create-project.ts`, `get-project(s).ts`).
- `src/lib/prompts/generation.tsx` — the system prompt governing how the model should use the two tools
  and structure generated components.
- `src/components/editor/` — Monaco-based code editor + file tree UI, kept in sync with
  `FileSystemContext`.
- `src/components/ui/` — Radix-based primitives (shadcn-style), shared across the app.
- Path alias `@/*` maps to `src/*` (see `tsconfig.json`).

### Testing

Vitest + Testing Library + jsdom (`vitest.config.mts`), with `vite-tsconfig-paths` so `@/` imports resolve.
Tests live alongside their subject in `__tests__` directories (e.g. `src/lib/transform/__tests__`,
`src/lib/contexts/__tests__`, `src/components/chat/__tests__`) rather than in one top-level test folder —
when adding a test, follow the existing co-located convention for that module.
