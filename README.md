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
  src/            API (Hono + node:sqlite)
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

Both UIs run entirely on `packages/mocks`; nothing calls an API, Claude or a
flight provider yet. Each app reads and changes data through one store
(`apps/*/web/src/data/store.tsx`): swapping its actions for API calls is the
only change needed to make a screen real. Mock-only behaviour: generation
"streams" proposals on a timer, "Verificar con la API" flips a proposal to
verified after a second, and publishing, nudging and saving show a toast.

Screens:

| app | route | screen |
|---|---|---|
| panel | `/generar` | search form + proposals arriving |
| panel | `/revisar` | approve, discard, verify, publish |
| panel | `/comparativa` | side-by-side, editable pros/cons, in-vote checkbox |
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

## Running

Requires Node ≥ 22.13 (the site uses the built-in `node:sqlite`).

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

- Every designed screen is built, responsive down to phone width, on mock data.
- Backend APIs for both halves exist and are tested (vote rules, publish
  freeze, member links, panel → site round trip) but the UIs don't call them yet.
- Claude research runs through `claude -p --json-schema`; it hasn't been run
  against the real binary yet.
- The Duffel provider is a stub.
- Photos are labelled placeholders until sources are picked (SPEC §6).

## Licence

[MIT](LICENSE). Photos shown on a site keep their own licences and credits.
