# Wanderlot

Trip planning for Grupo 51: a **local panel** where the organiser researches
and curates destinations, and a **published site** where the six friends read,
comment and vote. Nothing reaches the site until the organiser approves it.

The full design is in [`docs/SPEC.md`](docs/SPEC.md).

## Layout

```
packages/core   shared model (zod), Borda tally, trust/staleness, voting rules
apps/panel      local-only API: generate, review, verify, compare, publish
apps/site       published API: member links, plan view, ballots, comments
```

The panel and the site share one contract, the `Snapshot` schema in
`packages/core`. Publishing is the only way data moves from panel to site.

## Running

Requires Node ≥ 22.13 (the site uses the built-in `node:sqlite`).

```sh
npm install
npm test            # vitest, all packages
npm run typecheck

# site (default :8787)
WANDERLOT_ADMIN_TOKEN=<32+ random chars> npm run dev:site

# panel (127.0.0.1:5151 only)
WANDERLOT_ADMIN_TOKEN=<same token> WANDERLOT_SITE_URL=http://localhost:8787 npm run dev:panel
```

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
- No UI yet: both apps expose JSON APIs only. The screens are designed in the
  "Wanderlot · Planes de viaje" canvas.
