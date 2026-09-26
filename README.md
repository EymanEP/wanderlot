# Wanderlot

Trip planning for Grupo 51: a **local panel** where the organiser researches
and curates destinations, and a **published site** where the six friends read,
comment and vote. Nothing reaches the site until the organiser approves it.

Wanderlot is open source and self-hosted: one deployment serves one group of
friends. The site runs free on Cloudflare (Workers + D1); the panel runs on the
organiser's own computer. Hosting and setup: [`docs/SPEC.md` §11](docs/SPEC.md#11-hosting-and-setup).

The full design is in [`docs/SPEC.md`](docs/SPEC.md).

## Layout

```
packages/core   shared model (zod), Borda tally, trust/staleness, voting rules,
                Spanish display helpers (euros, durations, dates)
packages/ui     the design system: tokens (theme.css), components, and a gallery
packages/mocks  mock data for "Noviembre 2026", taken from the design canvas
apps/panel      local-only app: Generar, Revisar, Comparativa
  src/            API (Hono)
  web/            UI (React + Tailwind, Vite)
apps/site       published app: Destinos, Destino, Votación, Comentarios
  src/            API (Hono): Cloudflare Worker + D1, or Node + node:sqlite
  migrations/     the database schema, for both
  web/            UI (React + Tailwind, Vite)
```

Stack: TypeScript everywhere, React 19, React Router 7, Tailwind CSS 4 (via
`@tailwindcss/vite`), Vite, Hono, zod, Vitest + Testing Library.

### Design system

`packages/ui` holds every visual building block; the apps compose pages from it
and never restyle primitives.

- **Tokens** live in `packages/ui/theme.css` as Tailwind `@theme` variables:
  colours (`ink`, `muted`, `accent`, `accent-soft`, `claude`, …), the type scale
  (`text-display`, `text-title`, `text-heading`, …), radii (`rounded-tile`,
  `rounded-card`) and shadows (`shadow-card`, `shadow-raised`, `shadow-pop`).
- **Components**: `Button`/`IconButton`, `Badge`/`ProvenanceBadge`, `Chip`/
  `ChoiceChip`, `Card`, `Avatar`, `Heading`/`Text`/`PageHeader`/`SectionHeader`,
  `StatTile`/`DataList`/`DataRow`/`ProsCons`/`BulletList`, `Photo`/`IataTile`,
  `Notice`/`StatusDot`/`Skeleton`/`EmptyState`/toasts, `TopBar`/`Brand`/
  `InfoPill`/`Main`/`Footer`, `IconTabs`, `Calendar`, `Dialog`, and the form
  controls `Field`, `TextInput`, `TextArea`, `Select`, `Stepper`, `Range`,
  `Checkbox`, `RadioCard`, `Fieldset`. Icons are in `icons.tsx`.
- `cn()` merges classes with tailwind-merge, so a `className` passed to a
  component always wins over its defaults.
- **Gallery**: `npm run dev -w @wanderlot/ui` (port 5175) shows every component
  in every state the screens use.

### Mock data

Both UIs talk to their own server by default. Build or run them with
`VITE_DATA=mock` to use `packages/mocks` instead (the previews do). Each app
reads and changes data through one interface (`SiteSource` in
`apps/site/web/src/data/source.ts`, `PanelBackend` in
`apps/panel/web/src/data/backend.ts`) with an HTTP and a mock implementation.
In the mocks, generation "streams" the design's twelve proposals on a timer and
"Verificar con la API" flips a proposal to verified after a second.

Screens:

| app | route | screen |
|---|---|---|
| panel | `/planes/nuevo` | create a plan: name, dates, origin, people, budget |
| panel | `/generar` | search form + proposals arriving |
| panel | `/revisar` | approve, discard, verify, publish |
| panel | `/comparativa` | side-by-side, editable pros/cons, in-vote checkbox |
| panel | `/personas` | group name, who can get in: invites, passkeys, closing sessions, removing access |
| site | `/entrar` | sign in with a passkey |
| site | `/i/:token` | accept a one-time invite by creating a passkey |
| site | `/p/noviembre-2026` | plan: destinations, recent comments, other plans |
| site | `/p/noviembre-2026/destinos/nap` | destination detail and comments |
| site | `/p/noviembre-2026/votacion` | rank three; scoreboard hidden until close |
| site | `/p/noviembre-2026/comentarios` | every comment, by destination |

Add `?estado=cerrada` to any site URL to preview it after the vote closes.

`npm run build:preview -w <package>` builds a UI into one self-contained HTML
page with in-memory routing, for sharing a clickable preview:
`@wanderlot/site` (with a switch between the open and the closed vote),
`@wanderlot/panel` (set `VITE_SITE_URL` for its "Ver sitio" link) and
`@wanderlot/ui` (the gallery).

The panel and the site share one contract, the `Snapshot` schema in
`packages/core`. Publishing is the only way data moves from panel to site.

## Hosting your own

One deployment serves one group. The site runs free on Cloudflare Workers + D1;
the panel runs on the organiser's computer.

```sh
git clone https://github.com/EymanEP/wanderlot && cd wanderlot
npm install
npx wrangler login     # once, with a free Cloudflare account
npm run setup          # deploys the site, connects the panel, writes .env
npm run panel          # http://127.0.0.1:5151 → Personas → invite your friends
```

Passkeys belong to the site's address, so settle on it (the `workers.dev` one
or a custom domain) before inviting anyone. After pulling new code, run
`npm run deploy:site` again. Details: [`docs/SPEC.md` §11](docs/SPEC.md#11-hosting-and-setup).

## Running

Requires Node ≥ 22.13 (the Node site uses the built-in `node:sqlite`).

```sh
npm install
npm test            # vitest, all packages
npm run typecheck   # every package, servers and both UIs

# development: API + Vite with hot reload, in one terminal each
WANDERLOT_ADMIN_TOKEN=<32+ random chars> npm run dev:site    # UI on :5173, API on :8787
WANDERLOT_ADMIN_TOKEN=<same token> npm run dev:panel         # UI on 127.0.0.1:5174, API on :5151

# production: build the UIs, then each server serves its own
npm run build
WANDERLOT_ADMIN_TOKEN=… npm run start -w @wanderlot/site
npm run start -w @wanderlot/panel
```

In development Vite proxies `/api` to the API server, so open the Vite URL. To
sign in with passkeys through Vite, start the API with
`WANDERLOT_ORIGIN=http://localhost:5173`.

`npm run dev:worker -w @wanderlot/site` runs the site as a Cloudflare Worker
locally (`wrangler dev`, local D1; copy `apps/site/.dev.vars.example` to
`.dev.vars` first).

`npm run test:e2e` builds both UIs and runs, in Chromium with the browser's
virtual authenticator:

- the round trip (`e2e/roundtrip.e2e.ts`): in the panel, create a plan, name
  the group, add a friend, research with a stand-in `claude`, approve, publish
  and open the vote; then the friend takes the invite from the WhatsApp
  message, creates a passkey and sees the plan;
- the site on its own (`apps/site/e2e/passkeys.e2e.ts`): invite, passkey
  sign-up, vote, comment, like, sign-out, sign-in, removed access.

`npm run test:e2e:worker -w @wanderlot/site` runs the site checks against the
Worker in `wrangler dev` with a local D1 (no Cloudflare account needed). CI
(`.github/workflows/ci.yml`) runs typecheck, unit tests and all of the above on
every push and pull request.

The panel reads these from `.env` (written by `npm run setup`) or the environment.

| variable | used by | default |
|---|---|---|
| `WANDERLOT_ADMIN_TOKEN` | both | — (required by the site; on Cloudflare it's the `ADMIN_TOKEN` secret) |
| `WANDERLOT_DB` | site | `data/site.sqlite` |
| `WANDERLOT_ORIGIN` | site | `http://localhost:$PORT`; passkeys belong to this address, so set the final public one |
| `WANDERLOT_SITE_URL` | panel | `http://localhost:8787` |
| `WANDERLOT_PANEL_DATA` | panel | `data/panel.json` |
| `ANTHROPIC_API_KEY` | panel | — (optional; otherwise the `claude` command) |
| `DUFFEL_API_KEY` | panel | — |
| `UNSPLASH_ACCESS_KEY`, `PEXELS_API_KEY` | panel | — (optional photo search) |
| `CLAUDE_BIN` | panel | `claude` |

## State

- Every designed screen is built, responsive down to phone width.
- Both UIs run on their servers: plans are created and researched in the
  panel, published to the site, and voted on by friends with passkeys. The
  whole path is covered end to end.
- Claude research runs through `claude -p --json-schema`; it hasn't been run
  against the real binary yet.
- The Duffel provider is a stub.
- Photos are labelled placeholders until sources are picked (SPEC §6).

## Licence

[MIT](LICENSE). Photos shown on a site keep their own licences and credits.
