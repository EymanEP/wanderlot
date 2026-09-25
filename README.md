# Wanderlot

Trip planning for Grupo 51: a **local panel** where the organiser researches
and curates destinations, and a **published site** where the six friends read,
comment and vote. Nothing reaches the site until the organiser approves it.

The full design is in [`docs/SPEC.md`](docs/SPEC.md).

## Layout

```
packages/core   shared model (zod), Borda tally, trust/staleness, voting rules
packages/ui     Tailwind theme: colours and type from the design canvas
apps/panel      local-only app: generate, review, verify, compare, publish
  src/            API (Hono)
  web/            UI (React + Tailwind, Vite)
apps/site       published app: member links, plan view, ballots, comments
  src/            API (Hono + node:sqlite)
  web/            UI (React + Tailwind, Vite)
```

Stack: TypeScript everywhere, React 19, Tailwind CSS 4 (via `@tailwindcss/vite`),
Vite, Hono, zod, Vitest. Design tokens live in `packages/ui/theme.css` as
Tailwind `@theme` variables, so classes like `bg-accent-soft`, `text-muted` and
`border-line` match the canvas.

The panel and the site share one contract, the `Snapshot` schema in
`packages/core`. Publishing is the only way data moves from panel to site.

## Running

Requires Node ≥ 22.13 (the site uses the built-in `node:sqlite`).

```sh
npm install
npm test            # vitest, all packages
npm run typecheck   # servers and both UIs

# development: API + Vite with hot reload, in one terminal each
WANDERLOT_ADMIN_TOKEN=<32+ random chars> npm run dev:site    # UI on :5173, API on :8787
WANDERLOT_ADMIN_TOKEN=<same token> npm run dev:panel         # UI on 127.0.0.1:5174, API on :5151

# production: build the UIs, then each server serves its own
npm run build
WANDERLOT_ADMIN_TOKEN=… npm run start -w @wanderlot/site
npm run start -w @wanderlot/panel
```

In development Vite proxies `/api` (and the site's `/p/…?k=` private links) to
the API server, so open the Vite URL.

| variable | used by | default |
|---|---|---|
| `WANDERLOT_ADMIN_TOKEN` | both | — (required by the site) |
| `WANDERLOT_DB` | site | `data/site.sqlite` |
| `WANDERLOT_SITE_URL` | panel | `http://localhost:8787` |
| `WANDERLOT_PANEL_DATA` | panel | `data/panel.json` |
| `DUFFEL_API_KEY` | panel | — |
| `CLAUDE_BIN` | panel | `claude` |

## State

- Backend APIs for both halves, with tests covering the vote rules, the publish
  freeze, member links and a panel → site round trip.
- Claude research runs through `claude -p --json-schema`; it hasn't been run
  against the real binary yet.
- The Duffel provider is a stub; `verify` and API search need it implemented.
- UI is a shell: the panel has its header and tabs, the site shows the plan
  and its destinations. The screens themselves are designed in the
  "Wanderlot · Planes de viaje" canvas and not built yet.
