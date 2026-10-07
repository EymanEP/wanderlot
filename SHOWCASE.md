# Wanderlot: case study notes

Facts collected from the repository (code, config, docs, git history) on
2026-10-07, at release 1.0.0 (`main` at `8aa7e83`). Anything not in the repo is
marked `UNKNOWN — ask` and listed in section 8.

---

## 1. Identity

| | |
|---|---|
| Project name | Wanderlot |
| Short generic name | Group trip planner (destinations, dates and voting for a group of friends) |
| Client and city/country | UNKNOWN — ask. The repo has no client. The reference group in the spec and mock data is "Grupo 51: six people, planning from Madrid" (`docs/SPEC.md`). |
| Type | UNKNOWN — ask. Everything points to Personal: an MIT-licensed open-source repo under one GitHub account (`EymanEP/wanderlot`), self-hosted, with no client named anywhere. |
| Suggested slug | `wanderlot` (alternative: `wanderlot-group-trip-planner`) |
| Live URL | UNKNOWN — ask. No production domain is in the repo. `apps/site/wrangler.jsonc` deploys a Worker named `wanderlot` to Cloudflare (so by default `wanderlot.<account>.workers.dev`), but the account subdomain and any custom domain aren't recorded. Source code: https://github.com/EymanEP/wanderlot |
| Headline tags | React 19 · Cloudflare Workers + D1 · Hono · Tailwind CSS 4 |

**Timeline from git:**
- First commit: 2026-09-25. Release 1.0.0: 2026-10-06 (`CHANGELOG.md`).
- 114 commits on `main`: 77 non-merge commits, all authored as "Eyman", plus 37 merge commits from pull requests.
- About 31,700 lines of TypeScript/TSX, tests included.

---

## 2. Stack

Versions are the ones resolved in `package-lock.json`.

| Technology | Used for here |
|---|---|
| TypeScript 5.9 | Every package, both servers and both UIs; `npm run typecheck` runs `tsc` over all 7 projects. |
| npm workspaces | Monorepo: `packages/core`, `packages/ui`, `packages/mocks`, `apps/site`, `apps/panel`. |
| React 19.3 | UI for the friends' site and the organiser's panel. |
| React Router 7.18 | Client routing in both UIs (`apps/site/web/src/App.tsx`, `apps/panel/web/src/App.tsx`). |
| Vite 8.3 (+ `@vitejs/plugin-react` 6) | Dev server and builds; also produces single-file HTML preview builds (`scripts/inline-preview.mjs`). |
| Tailwind CSS 4.3 (`@tailwindcss/vite`) | Styling; design tokens are Tailwind `@theme` variables in `packages/ui/theme.css`. |
| tailwind-merge 3.7 | `cn()` merges classes so a passed `className` wins over component defaults. |
| GSAP 3.15 | Page transitions in both UIs (`packages/ui/src/motion.tsx`); off when the OS asks for reduced motion. |
| Hono 4.13 | HTTP API for the site (Worker and Node) and for the panel's local server. |
| zod 4.6 | Shared domain model and the `Snapshot` contract between panel and site (`packages/core/src/model.ts`). |
| Cloudflare Workers + Wrangler 4.141 | Hosting for the friends' site and its API (`apps/site/src/worker.ts`, `apps/site/wrangler.jsonc`). |
| Cloudflare D1 | The site's database on Cloudflare; 9 additive SQL migrations in `apps/site/migrations/`. |
| Workers rate limiting (`ratelimits` binding) | Sign-in attempts per client address (`AUTH_LIMIT` in `wrangler.jsonc`). |
| Node ≥ 22.13 with `node:sqlite` | Same site on plain Node (self-hosting and tests), same SQL (`apps/site/src/sqlite.ts`). |
| SimpleWebAuthn 14 (server + browser) | Optional passkey sign-in for friends. |
| Web Crypto API | Tokens, SHA-256 and HMAC-keyed PIN hashes, written once to run on both Node and Workers (`apps/site/src/crypto.ts`). |
| Anthropic SDK 0.128 / `claude` CLI | Destination research, reading prices off screenshots, writing the trip guide (`apps/panel/src/providers/`). |
| OpenAI API or any OpenAI-compatible endpoint | Alternative research providers (`apps/panel/src/providers/openai.ts`, `ai.ts`). |
| Playwright MCP (`@playwright/mcp` 0.0.83) | Lets Claude drive a visible browser to check finalists' flight prices on Google Flights (`apps/panel/src/providers/browse.ts`). |
| Duffel API | Verified flight prices (`apps/panel/src/providers/duffel.ts`). |
| Unsplash / Pexels / Wikimedia | Destination photos, linked rather than stored (`apps/panel/src/providers/photos.ts`). |
| Vitest 5 + Testing Library + jsdom 30 | Unit and component tests (303 tests in 33 files at 1.0.0). |
| Playwright 1.56 (Chromium) | End-to-end tests, including a virtual WebAuthn authenticator (`e2e/roundtrip.e2e.ts`, `apps/site/e2e/access.e2e.ts`). |
| GitHub Actions | CI on every push and PR: typecheck, unit tests, e2e on Node and on the Worker under `wrangler dev` with a local D1 (`.github/workflows/ci.yml`). |
| Web app manifest | The site installs to a phone's home screen (`apps/site/web/public/manifest.webmanifest`). |

---

## 3. Context: the problem

**What it is.** A trip planner for one fixed group of friends, built as two apps
(`docs/SPEC.md`):

- **Panel**, for the one person who organises. It runs on their computer. It
  researches destinations with an AI, and the organiser approves, edits and
  prices them, then publishes. The site also serves it at `/admin`, without AI,
  so the organiser can manage things from a phone.
- **Site**, for everyone else. Friends sign in and:
  - say which dates work for them;
  - read the proposals, comment and suggest destinations;
  - rank their top three (Borda count);
  - then see the trip page: flights, stay, each person's share, how to get to
    the airport, what to do, and a Tricount link.

The rule the spec calls central: "nothing reaches the site until the organiser
approves it. The panel generates twelve options; the group sees the four the
organiser stands behind."

**Who uses it:**
- the organiser, on the panel;
- their friends, on the site, mostly from phones: the site has a bottom
  navigation bar at phone width and installs to the home screen.

**What made it necessary.**
- What came before is UNKNOWN — ask: how the group planned before (chat
  threads, polls, spreadsheets?) and what went wrong.
- What the repo does record (`docs/ROADMAP.md`) is the first real trip on the
  app:
  - the group voted: Budapest won and Prague came second;
  - they then decided on Prague anyway;
  - later they moved the dates from the week of 16 November to 3–7 November;
  - the organiser "re-checked every finalist by hand on Google Flights and
    Airbnb".
- The roadmap after that trip lists the fixes it caused:
  - choose a destination other than the vote's winner;
  - paste screenshots of prices;
  - flag checked prices when the dates change;
  - a vote on dates;
  - a trip page;
  - checking prices in the browser.

**Constraints found in the repo:**
- **Languages:** Spanish by default, English throughout. The group has a language, and each person can switch (`packages/core/src/i18n.ts`). AI-written text and WhatsApp messages follow the group's language.
- **Who edits content:** only the organiser, in the panel. Friends write comments, ideas, votes and their date answers, nothing else.
- **Hosting:** one deployment per group, on Cloudflare's free tier (Workers + D1) or Node. `npm run setup` and `npm run deploy:site` do the deploy.
- **No image storage:** photos are linked from Unsplash, Pexels or Wikimedia ("a deployment stores no image files", `docs/SPEC.md`).
- **Existing groups must keep working** (`docs/ROADMAP.md`, "Rules for every item"):
  - migrations only add tables or columns;
  - new features are optional per trip;
  - friends never have to do anything new.

  The panel checks the site's API version (`SITE_API_VERSION`, 16 at 1.0.0) and tells the organiser to redeploy when the site is older.
- **Accounts:** friends get no passwords or emails. Access comes from a one-time invite, then a name and a 4-digit PIN.

---

## 4. Approach: 3 key decisions

### 4.1 One site codebase that runs on Cloudflare Workers and on plain Node

**What was done.**
- The site's storage is written once in SQL over a small async driver:
  - D1 on Cloudflare;
  - `node:sqlite` for self-hosting and tests.
- The schema lives in `apps/site/migrations/`. Wrangler applies it on D1, and
  the Node store applies the same files.
- All crypto uses the Web Crypto API, so the same code runs in both runtimes.
- CI runs the full end-to-end suite twice: against Node, and against the
  Worker in `wrangler dev` with a local D1 (commit `6573eaa`).

**Why.** Free hosting for each group on Cloudflare, while keeping a Node
option for self-hosting and fast tests.

**What made it hard:**
- When the panel's data moved into the site's database (commit `67881ce`),
  the panel's own code had to run inside the Worker. Its publish fingerprint
  was rewritten as "a pure-JS SHA-256 (same hex), so the panel code runs in
  the Worker".
- The e2e job for the Worker failed until the local D1 migrations were applied
  before starting `wrangler dev` (commit `f4ed0ea`).

**Files:**
- `apps/site/src/sql-store.ts`, `d1.ts`, `sqlite.ts`, `worker.ts`, `server.ts`, `crypto.ts`
- `apps/site/wrangler.jsonc`
- `.github/workflows/ci.yml`

### 4.2 Sign-in for friends who will never make an account

**What was done.** Access went through three versions in the history:

1. **Private links.** Commit `82d0ce9` replaced them because "a link was the
   login: forwarding it handed over the account".
2. **One-time invites plus passkeys.**
   - An invite expires in 7 days.
   - Opening it, for example in a chat app's link preview, doesn't use it up.
   - Only finishing the sign-up does, and atomically.
3. **Name plus PIN** (`25b7a8c`), with the passkey kept as an option.

**What made it hard:**
- A 4-digit PIN has only 10,000 values (`1fabaa5`). The answer:
  - obvious PINs (repeats, runs, 1212, 2580…) are refused;
  - lockouts after 5 wrong tries grow: 15 min, 1 h, 4 h, then a day;
  - PINs are stored as an HMAC keyed by a server secret, not a plain hash.
- PINs were 6 digits before the switch to 4, and existing users couldn't type
  their old PIN anymore (`80f4035`). The sign-in screen got "Mi PIN tiene 6
  números", which leads straight to choosing a new 4-digit PIN. Nobody needed
  a new invite.
- A security review (`629dc46`) added:
  - security headers and a CSP;
  - Origin checks on writes;
  - rate limits on sign-in;
  - Host and Origin checks on the local panel, against CSRF and DNS rebinding.

**Files:**
- `apps/site/src/crypto.ts` (HMAC PIN hash)
- `apps/site/src/app.ts` (`PIN_LOCKS_MS`, around line 138)
- `apps/site/migrations/0005_pin_lockouts.sql`
- `apps/site/src/headers.ts`, `apps/site/web/public/_headers`
- `apps/panel/src/guard.ts`

### 4.3 Saying where every price came from

**What was done.** Every price carries its provenance, and the UI labels it:

- "Verificado" when it came from a flight API or a hand check;
- stale after 72 hours, or when it was checked for other dates;
- "Lo escribió Claude", or an estimate, when it is the AI's figure.

The organiser can firm a price up three ways:
- type in a price checked by hand;
- paste screenshots, which the AI reads (`ead6030`);
- have Claude open Google Flights in a visible browser through Playwright MCP
  and read the price (`2d17375`). That run gets only page-reading tools:
  scripts, files, cookies and storage are refused.

**Why.** On the first real trip the organiser re-checked every finalist by
hand anyway (`docs/ROADMAP.md`). The group needed to see which numbers were
real.

**What made it hard:**
- Checked prices were first shown next to research's guesses: a hand-checked
  flight price beside made-up flight times (`ead6030`). Hand-checked entries
  now show only what was actually checked.
- The flight price's meaning changed to what one person pays for the round
  trip, "as airlines show it", instead of a group total divided by people
  (`c716258`).
- The browser check first covered Airbnb too. Airbnb's pages "couldn't be read
  reliably, so Claude no longer tries" (`5d662b8`): the stay is now checked by
  hand from a prefilled Airbnb link.

**Files:**
- `packages/core/src/trust.ts`, `packages/core/src/pricing.ts`
- `apps/panel/src/providers/browse.ts`, `apps/panel/src/providers/extract.ts`
- `apps/panel/web/src/components/PriceDialog.tsx`

---

## 5. Performance & quality

**Tests and CI:**
- **Unit and component tests:** 303 tests in 33 files (Vitest + Testing Library), run in CI on every push and PR.
- **End-to-end:** Playwright in Chromium covers the whole round trip: create a plan in the panel, research, approve, publish, open the vote, then a friend accepts the invite and signs in. It runs against both the Node server and the Cloudflare Worker (`.github/workflows/ci.yml`).
- **Passkeys under test:** unit tests use a software authenticator; e2e uses Chromium's virtual authenticator.
- **Type safety:** strict TypeScript across 7 projects. The panel and site share one zod-validated `Snapshot` contract (`packages/core/src/model.ts`).

**Images:**
- **Never stored:** photos are linked from Unsplash, Pexels or Wikimedia; the site's CSP allows only those image hosts (`apps/site/web/public/_headers`).
- **Wikimedia sizing** (`1421d1f`, `standardImageUrl` in `packages/core/src/display.ts`):
  - Wikimedia only serves its standard thumbnail widths and rejects the rest;
  - saved thumbnails are moved to the largest standard width that fits;
  - the panel requests 1280px.
- **Broken photos:** a photo that fails to load shows a grey placeholder instead of a broken image (`packages/ui/src/Media.tsx`).
- **Layout shift:** photos sit in fixed-size tiles (absolute-positioned `object-cover` images), so loading doesn't move the layout.
- **Lazy loading:** used only in the panel's photo picker (`loading="lazy"`); other images load eagerly.

**Delivery and caching:**
- **Fonts:** Plus Jakarta Sans from Google Fonts with `preconnect` and `display=swap`. Not self-hosted.
- **Bundle:** a single JS bundle per app: site ≈ 622 kB minified / 197 kB gzip, panel ≈ 722 kB / 228 kB gzip, measured with a local `vite build` on 2026-10-06. No code splitting.
- **Caching:** no service worker. Static assets are served by Cloudflare's static assets with hashed filenames from Vite. No custom cache headers in the code.

**Accessibility:**
- **Roles and live regions:** components use `aria-live`/`role="status"` for progress and toasts.
- **Tests query by role:** component tests find elements by role and accessible name (radiogroups, dialogs, labelled fields), which checks labels exist.
- **Motion:** GSAP transitions turn off under `prefers-reduced-motion` (`packages/ui/src/motion.tsx`).

**A production bug fixed with a regression test** (`4b32ae4`):
- Newer Chrome's `window.scrollTo` returns a Promise.
- An expression-bodied React effect returned it, so React called it as a cleanup on the next navigation, and the whole site went blank.
- Fixed, with a test that stubs `scrollTo` to return a Promise.

**Not found in the repo:** Lighthouse or any other performance measurements.

---

## 6. Outcome

**What's live:**
- Release 1.0.0 is merged to `main` on 2026-10-06.
- The production D1 database id is committed (`fb9cda7`), so a production deployment exists.
- Its URL is UNKNOWN — ask.

**What the organiser can do without a developer:**
- Deploy and update the site with `npm run setup` / `npm run deploy:site`.
- Create trips, research and publish destinations, and open and close votes.
- Invite and remove people.
- Export a trip's data as JSON.
- Manage from a phone at `/admin`.

**What friends can do:**
- Sign in from any device with name and PIN.
- Answer dates, track their days off, suggest destinations, comment, like and vote.
- See the decided trip, in Spanish or English.

**Real use recorded in the repo** (`docs/ROADMAP.md`):
- At least one real trip: Budapest won the vote, the group went with Prague, and the dates moved to 3–7 November.
- The roadmap's rules mention "Some groups already use the app".

**Measurable results** (users, groups, trips, time saved): UNKNOWN — ask. Nothing like that is in the repo.

---

## 7. Media plan

**About these captures:**
- They come from the apps' preview builds (`VITE_PREVIEW=1`), which run on the bundled mock data ("Grupo 51", trip "Noviembre 2026").
- The preview-only banner was hidden for the shots.
- **Photos show as grey placeholders with labels** like "[FOTO DE NÁPOLES]", because the mock data has no images. For the portfolio, consider recapturing the site from the live deployment, where photos load.
- Viewport-only captures at device scale factor 1. Sizes below were measured from the files.

### Desktop: friends' site (`showcase-media/desktop/`)

| File | Size (px) | Route | What it shows | Caption | Alt text |
|---|---|---|---|---|---|
| `01-site-plan.webp` | 1900×917 | `/p/noviembre-2026` | Plan page top: trip title, vote status, days-off tracker | One page per trip: who has voted and who has the days off | Trip page "Noviembre 2026" with "4 de 6 habéis votado", buttons to propose a destination and change your vote, and a "Días libres" card listing six people and their days-off status |
| `02-site-destinations.webp` | 1900×917 | `/p/noviembre-2026` (scrolled) | Four destination cards and latest comments | Four destinations, each with price per person and your ranking | Four destination cards (Marrakech, Lisboa, Budapest, Nápoles) with "Verificado" badges, grey photo placeholders, flight and stay details and price per person, above three recent comments |
| `03-site-destination.webp` | 1900×917 | `/p/noviembre-2026/destinos/nap` | Destination detail | Everything about one destination before you vote | Nápoles detail page: 388 € per person, "Darle mis puntos" button, a five-tile photo grid of placeholders, four fact tiles and the outbound and return flights |
| `04-site-vote.webp` | 1900×917 | `/p/noviembre-2026/votacion` | Ranking three destinations | Rank three: 3, 2 and 1 points; the scoreboard stays hidden until it closes | Votación page with Marrakech, Lisboa and Budapest ranked 3, 2 and 1 points, Nápoles outside the ranking, a "4 de 6 votos" box and a closed scoreboard listing destinations alphabetically |
| `05-site-dates.webp` | 1900×917 | `/p/semana-santa-2027/fechas` | Dates vote | Yes, if need be, or no for each date option | "¿Cuándo nos vamos?" page with three date options, each with Sí / Si hace falta / No, and a side panel showing who can go when |
| `06-site-trip.webp` | 1900×917 | `/p/noviembre-2026/viaje` (vote closed) | Decided trip page | Once decided: what each person pays, and the flights | El viaje page for Nápoles: "Lo que pone cada uno 422 €" broken into flight, stay and getting to the airport, a Tricount button, the days-off card, a boarding-pass style flight card and a "Antes de ir" accordion |
| `07-site-trip-getting-there.webp` | 1900×917 | `/p/noviembre-2026/viaje` (scrolled) | Getting to the airport, things to do | Several ways to the airport, and the one the group takes | Transport options with icons and prices (car to Barajas marked "El que cogemos", ALSA bus, Alibus, taxi) above "Qué hacer" cards with price chips |
| `08-site-sign-in.webp` | 1900×917 | `/entrar` | Sign-in | Name and a 4-digit PIN; passkey optional | Centred sign-in card "Entra en Grupo 51" with name and PIN fields, an "Entrar" button and an "Entrar con passkey" link |

### Mobile: friends' site (`showcase-media/mobile/`)

| File | Size (px) | Route | What it shows | Caption | Alt text |
|---|---|---|---|---|---|
| `01-site-plan.webp` | 366×820 | `/p/noviembre-2026` | Plan page on a phone | Built for phones first | Phone view of "Noviembre 2026" with vote status, two buttons, the days-off card and a bottom bar with Viajes, Destinos, Votación and Comentarios |
| `02-site-vote.webp` | 366×820 | `/p/noviembre-2026/votacion` | Ranking on a phone | Reorder your three picks with one thumb | Phone view of Votación with a "4 de 6 votos" box and Marrakech (3 points) and Lisboa (2 points) cards with move and remove buttons |
| `03-site-dates.webp` | 366×820 | `/p/semana-santa-2027/fechas` | Dates vote on a phone | Answer each date in one tap | Phone view of "¿Cuándo nos vamos?" with "3 de 6 respuestas" and date options with Sí / Si hace falta / No buttons |
| `04-site-trip.webp` | 366×820 | `/p/noviembre-2026/viaje` | Trip page on a phone | Each person's share, at a glance | Phone view of the Nápoles trip page with the 422 € per-person breakdown, a Tricount button and the start of the days-off card, with "El viaje" active in the bottom bar |

### Admin / behind the scenes: organiser's panel

| File | Size (px) | Route | What it shows | Caption | Alt text |
|---|---|---|---|---|---|
| `desktop/admin-01-review.webp` | 1900×917 | panel `/revisar` | Reviewing proposals | Twelve proposals in, the organiser approves four | Panel Revisar page: filter tabs (Todas 12, Por revisar 6, Aprobadas 4, Descartadas 2), two proposal cards (Nápoles approved, Praga) with "Verificado con la API" badges and price breakdowns, and a "Publicar 4 aprobadas" button |
| `desktop/admin-02-search.webp` | 1900×917 | panel `/generar` | AI search running | Research streams in live | Panel Generar page: search form with a date calendar on the left; on the right a live "Consultando la API de vuelos" progress card with a timer and search steps, and two group ideas (Oporto, Azores) to research |
| `desktop/admin-03-compare.webp` | 1900×917 | panel `/comparativa` | Side-by-side finalists | Pros and cons the organiser can rewrite before the vote | Four comparison columns (Lisboa, Nápoles, Marrakech, Budapest) with flight, stay and total per person, weather, pros and cons, and an "Entra en la votación" checkbox each |
| `desktop/admin-04-live-vote.webp` | 1900×917 | panel `/votacion` (vote open) | Live count | Only the organiser sees the count before it closes | Panel Votación page: provisional count table (Marrakech 8 points first), a 4-of-6 progress bar and each person's ballot, with "Recordar a quien falta" and "Cerrar ya" buttons |
| `desktop/admin-05-people.webp` | 1900×917 | panel `/personas` | Group and access | Invites, PINs and the phone panel | Personas page: group name form, "Panel en el móvil" password setup, and six people checked for the trip |
| `desktop/admin-06-new-trip.webp` | 1900×917 | panel `/planes/nuevo` (scrolled) | New trip, place and dates together | Pick a month or two and the nights; each proposal brings its dates | New plan form with "El destino, con sus fechas" selected, twelve month chips with November and December chosen, a "5 noches" select, six people and a budget slider |
| `mobile/admin-01-search.webp` | 366×820 | panel `/generar` | Panel on a phone | The panel also works at phone width | Phone view of the panel with the trip selector, the Cuándo / Dónde / El viaje steps and the start of the search form |

**Not captured (optional extras):**
- `/p/noviembre-2026/comentarios` (all comments by destination) and the
  closed-vote plan page. Both were captured, but they look much like the
  shots above.
- The invite page `/i/:token` and the price dialog (`PriceDialog`, opened from
  "poner precios reales" on a Revisar card).

### Screen recording

- **Suggested clip (about 15–20 s):** in the panel's Generar, start "Buscar 12
  más". The progress card ticks through searches and pages read, and proposals
  appear one by one. Then switch to Revisar and approve one.
- **Poster:** `desktop/admin-02-search.webp`.
- **Alternative:** on mobile, reordering picks on the site's Votación. Poster:
  `mobile/02-site-vote.webp`.
- Not recorded.

---

## 8. Questions for me

1. Is this a personal project, or was it for a client or employer? If a client, what's their name and city/country?
2. Which portfolio type: Freelance, Corporate, Personal or Agency?
3. What's the live URL (the `workers.dev` address or a custom domain), and can it be shown publicly? Friends sign in, so a public demo would need a demo group.
4. What was your role: sole designer, developer and product owner? The git history has every commit authored as "Eyman", and PR descriptions note they were generated with Claude Code. How do you want to describe your work and the AI's part in it?
5. Who made the visual design? `docs/ROADMAP.md` says screens are drawn first "in Claude Design". Was that you?
6. Why did you build it? How did your group plan trips before (chat threads, polls, spreadsheets), and what went wrong?
7. How many groups and people use it now? Is it only your own group of six?
8. How many trips have been planned with it so far? Can I use the first trip (vote won by Budapest, trip to Prague, dates moved to 3–7 November) in the case study?
9. Any measurable result to cite, such as time saved, fewer messages, or how many friends voted on time?
10. Is it fine to show the real group name and friends' names from production, or should the case study stay on the demo data ("Grupo 51")?
11. Should I recapture the site screens from the live deployment so real photos show instead of grey placeholders?
12. Anything that happened after launch to mention, such as feedback from friends or features they asked for?
