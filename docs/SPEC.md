# Wanderlot — spec

Trip planning for one fixed group of friends, built as two halves that never
blur into each other:

- **Panel** — runs only on the organiser's machine. Research and curation.
- **Site** — published, used by the group. Reading, commenting, voting.

Wanderlot is open source (MIT) and self-hosted: **one deployment serves one
group**. Anyone can deploy their own site for free (§11) and run the panel from
a clone of the repo. The reference group throughout this spec and the mocks is
Grupo 51: six people, planning from Madrid.

The one rule everything else serves: **nothing reaches the site until the
organiser approves it.** The panel generates twelve options; the group sees the
four the organiser stands behind.

Design reference: the "Wanderlot · Planes de viaje" canvas (six screens, v1 and
current). UI copy is Spanish; code and docs are English.

---

## 1. Domain model

All money is integer euro cents (`priceCents`). All timestamps are ISO 8601 UTC.
All dates without time (trip dates) are `YYYY-MM-DD` in the origin's local time.

### Plan
The organising unit: one named trip window.

| field | notes |
|---|---|
| `id` | slug, e.g. `noviembre-2026` |
| `name` | "Noviembre 2026" |
| `origin` | IATA code, e.g. `MAD` |
| `dateFrom`, `dateTo` | the window the search ran against |
| `nights` | 3, 5, 7 or 10 |
| `flexDays` | 0, 1 or 2 |
| `partySize` | 6 |
| `maxPriceCents` | ceiling per person |
| `status` | `draft` → `voting` → `closed` (see §4) |
| `voteDeadline` | set when voting opens |
| `winnerDestinationId` | set when closed |

A plan in `draft` exists only in the panel. The site sees a plan from its first
publish onwards.

### Proposal (panel only)
One candidate the research produced. Never leaves the machine unless approved.

| field | notes |
|---|---|
| `id`, `planId` | |
| `place` | city, country, IATA code |
| `category` | `ciudad` \| `escapada` \| `playa` \| `naturaleza`: the Plan page's filter |
| `outbound`, `inbound` | flight legs (§1.1) |
| `stays` | 0–2 accommodation options (`name`, `kind`, `description?`, whole-group `nightlyCents`), one may be `recommended` |
| `todo`, `see` | lists of specific things ("Qué hacer", "Qué ver"), each `{ title, detail? }` |
| `provenance` | §3 |
| `review` | `pending` \| `approved` \| `discarded` |
| `sources` | list of `{label, url}` — required when provenance is `claude` |

### 1.1 Flight leg
`{ from, to, departAt, arriveAt, carrier, flightNumber, stops, priceCents }`.
`priceCents` on the leg is per person; the proposal's flight price is the sum
of both legs.

### Destination (site)
An approved proposal as published: everything above except `review`, plus
the organiser's editorial additions from Comparativa:

- `pros`, `cons` — drafted by Claude, rewritten by the organiser
- `weather` — one line for the trip month
- `photos` — §6, chosen by the organiser at approval
- `inVote` — the Comparativa checkbox; only `inVote` destinations are ballot options
- `totalPerPersonCents` — flights + recommended stay × nights ÷ party size

### Member
One of the six. `{ id, name, tokenHash }`. There are no accounts or passwords
(§5).

### Ballot
`{ planId, memberId, ranking: destinationId[], castAt, updatedAt }`.

### Comment
`{ id, planId, destinationId, memberId, parentId?, body, createdAt }`.
Threads are one level deep: a reply's parent must be a top-level comment.

---

## 2. The two halves and the boundary between them

```
 ┌───────────── organiser's machine ─────────────┐        ┌──────── hosted ────────┐
 │  Panel (localhost only)                        │        │  Site                   │
 │   Generar ── flight API / `claude` binary      │ publish│   Plan, Destino,        │
 │   Revisar ── approve / discard / verify        │ ─────▶ │   Votación              │
 │   Comparativa ── pros/cons, inVote             │ snapshot│  votes + comments DB   │
 │  local store: proposals, drafts, API keys      │        │                         │
 └────────────────────────────────────────────────┘        └─────────────────────────┘
```

- The panel binds to `127.0.0.1` only. API keys and the `claude` binary never
  leave the machine. There is no hosted panel in v1 (§10).
- **Publish** is the only way data crosses. It sends a **snapshot**: the plan
  plus its approved destinations, validated against one shared schema
  (`packages/core`). The site stores snapshots verbatim; it never computes
  anything about destinations itself.
- The site owns only what the group creates: ballots and comments.
- Publish is authenticated with an admin token held by the panel.

### Publish rules
- Only `approved` proposals are included. Discarded and pending ones never are.
- Every publish replaces the plan's destination set wholesale (idempotent).
- **Once the first ballot is cast, the set of `inVote` destinations is frozen.**
  A later publish may edit content (text, photos, re-verified prices) but may
  not add, remove, or change `inVote` on any destination. The site rejects such
  a publish with `409`.
- Voting needs at least 2 `inVote` destinations.

---

## 3. Trust model

Every figure on the site traces to where it came from. Provenance has exactly
two kinds:

| kind | badge | meaning |
|---|---|---|
| `api` | green **Verificado con la API** | price and schedule returned by a flight API; carries `provider` and `checkedAt` |
| `claude` | amber **Lo escribió Claude** | produced by Claude from web research; carries `sources`, not yet checked |

**Staleness.** Prices move, so a verification has a shelf life. A verified
proposal whose `checkedAt` is older than **72 hours** is *stale*. Staleness is
derived, not a third provenance kind:

- On the site, a verified badge always shows its age: "Verificado hace 3 días".
  A stale one renders in the neutral tone rather than green.
- In the panel, publishing a stale or unverified proposal is allowed but asks
  for confirmation, and **opening a vote re-checks every verified `inVote`
  destination** first.

"Verificar con la API" on a `claude` proposal searches the same route and dates
on the configured flight provider. If it finds a matching itinerary, provenance
becomes `api`. If not, the proposal keeps its `claude` badge and the panel says
why.

Every destination page has a "De dónde salen los números" card listing the
provider (or sources) and the check date.

---

## 4. Voting

### Rule — Borda count over the top three
Each member ranks the `inVote` destinations: first gets 3 points, second 2,
third 1: six points per person, so 36 in play for a group of six.

- A ballot ranks exactly `min(3, n)` distinct destinations, where `n` is the
  number of `inVote` destinations. (With 2 destinations: 3 and 2 points.)
- Unranked destinations get 0 from that ballot.

Why Borda: with one vote each, a place two people love and four hate beats one
everybody is happy with. Here broad second choices win.

### Ranking and ties
Order by, in turn:
1. total points, descending
2. number of first places, descending
3. `totalPerPersonCents`, ascending (cheaper wins)

If two destinations are still level after all three, the result is a **tie**
and the organiser picks in the panel. There is no hidden fourth rule.

### Lifecycle
```
draft ──open vote (deadline)──▶ voting ──all 6 voted, or deadline passes──▶ closed
```
- While `voting`, a member may change their ballot any number of times.
- **The scoreboard is hidden while `voting`.** Visible to everyone at all times:
  who has voted and who hasn't (names only, never rankings).
- The vote closes the moment the sixth ballot arrives or the deadline passes,
  whichever is first. ("Sixth" means the group's `partySize`.) Closing is checked on every read, so no cron is needed.
- Once `closed`, ballots are read-only and the full scoreboard is shown:
  points, first places, and each member's ranking.
- Each member sees their own ballot at all times ("Tu 1.ª opción" on Plan cards).
  They never see the group tally before the close.

---

## 5. Identity on the site

A small, known group, no sign-up. Each member gets **one private link**:
`https://<site>/p/<planId>?k=<token>`.

- The token is 32 random bytes, base64url. The site stores only its SHA-256.
- The first visit sets an http-only cookie and redirects to the clean URL.
- The panel issues everyone's link once and can revoke/reissue one.
- Anyone without a valid token sees nothing — not even the plan name.

---

## 6. Photos

Photos are **linked, not hosted**: the site shows each image straight from the
photo service that serves it, so a deployment stores no image files. That is
only safe for images whose licence allows reuse and whose service allows
direct linking, so photos come **only from three services**:

| source | used for | direct linking | attribution | key |
|---|---|---|---|---|
| Unsplash | hero and mood shots | **required** by its API rules: use the `urls` it returns | photographer + Unsplash, with `utm_source=wanderlot&utm_medium=referral` links; call `download_location` when a photo is chosen | free API key |
| Pexels | hero and mood shots | allowed: use the `src` it returns | "Foto de X en Pexels", linked | free API key |
| Wikimedia Commons | specific landmarks ("Castel dell'Ovo") | allowed but discouraged (files can be renamed or deleted); link a sized thumbnail | author + licence (usually CC BY-SA), linked | none (send a descriptive User-Agent) |

**Claude never supplies an image URL.** An arbitrary image Claude finds on the
web is usually copyrighted, may block direct linking, may be moved or deleted,
and would let a third-party site log every friend who opens the page. So the
work is split:

1. **Claude picks what to show.** With each proposal it suggests 4–6 photo
   subjects: one hero ("Bahía de Nápoles al atardecer") and the landmarks the
   proposal mentions ("Pompeya", "Spaccanapoli").
2. **The panel finds candidates** for each subject through the services' own
   search APIs (Unsplash/Pexels for the hero, Wikimedia for landmarks), using
   whichever keys the organiser configured. With no keys, Wikimedia alone works.
3. **The panel checks each candidate** before showing it: the URL loads, it is
   an image, and the service returned a licence and an author.
4. **The organiser picks** in Revisar (one hero, up to three tiles). Picking an
   Unsplash photo triggers its download event.
5. **Publish carries the choice** with its credits. The site renders the image
   from the service's URL and the credit under it. An image that fails to load
   falls back to the labelled placeholder.

Each photo stores:

```
{ url, width, height, source: "unsplash"|"pexels"|"wikimedia",
  author, authorUrl, license, sourceUrl, alt, downloadLocation? }
```

Copying files into our own storage (Cloudflare R2's free tier would hold
them) is not part of v1. It becomes worth doing if linked Wikimedia images
start disappearing; Unsplash photos must stay linked either way.

---

## 7. Telling people (v1)

No email or push in v1. When the organiser opens or closes a vote, the panel
produces a ready-to-paste message for the group chat: what opened/closed, the
deadline or the winner, and each person's private link. The group chat is
already where they are.

---

## 8. Providers

Every outside service sits behind an interface in the panel, and each hoster
configures only the ones they have. The panel works with none of the paid ones.

### Research (AI)
`ResearchProvider` produces proposals, pros and cons, and photo subjects.

| provider | how | cost to the hoster |
|---|---|---|
| `claude-cli` (default) | the local `claude` binary: `claude -p --output-format json --json-schema …` | their Claude subscription, no API bill |
| `anthropic-api` | Anthropic API with the web search tool, `ANTHROPIC_API_KEY` | pay per use |

Other providers can implement the same interface later. Whatever the provider,
research always yields `claude` provenance (§3): it is labelled as written by
AI until a flight API confirms it, even when it quotes an airline's price.

### Flights (optional)
`FlightProvider` searches and verifies fares; it is the only way to `api`
provenance.

| provider | status |
|---|---|
| Duffel (default) | real bookable fares with a live account; test mode returns made-up flights. Check its pricing for search-only use before relying on it |
| Amadeus Self-Service | reportedly being decommissioned in 2026 — confirm before use |
| Kiwi (Tequila) | public sign-ups reportedly closed — confirm access |

Without a flight provider, every proposal stays "Lo escribió Claude" and the
panel says so on Generar.

### Photos
Unsplash, Pexels and Wikimedia Commons, per §6.

---

## 9. Site API (v1)

All member routes require the member cookie. Admin routes require
`Authorization: Bearer <ADMIN_TOKEN>`.

| method | path | who | notes |
|---|---|---|---|
| `PUT` | `/api/admin/plans/:planId` | panel | publish snapshot; `409` if it breaks the freeze |
| `POST` | `/api/admin/plans/:planId/open-vote` | panel | `{ deadline }`; needs ≥ 2 in-vote destinations |
| `POST` | `/api/admin/members` | panel | `[{ id, name }]`; issues (or reissues, revoking) each link; returns tokens once |
| `GET` | `/p/:planId?k=<token>` | member | exchanges the link for the cookie, redirects to `/p/:planId` |
| `GET` | `/api/plans/:planId` | member | plan + destinations + own ballot + participation |
| `PUT` | `/api/plans/:planId/ballot` | member | `{ ranking }`; `409` unless voting |
| `GET` | `/api/plans/:planId/results` | member | `403` until closed |
| `GET` | `/api/plans/:planId/comments?destinationId=` | member | newest first; without a filter: the 3 most recent across the plan |
| `POST` | `/api/plans/:planId/comments` | member | `{ destinationId, body, parentId? }` |

Members and their links belong to the group, not to a plan: a person gets one
link, once, and it works for every plan. Reissuing a link revokes the old one
(and logs that person out).

On the site, a plan in `draft` has been published for browsing and comments
but its vote hasn't opened.

---

## 10. Out of scope for v1 / still open

- **A hosted panel.** v1's panel is local only. A later option: serve it from
  the same Cloudflare deployment under `/admin`, behind Cloudflare Access for
  login, using `anthropic-api` (a Worker can't run the `claude` binary).
- Plan-creation and "Personas y enlaces" screens in the panel (next).
- Email/push notifications (§7 is the v1 answer).
- Booking. Wanderlot decides; it doesn't buy.
- More than one group per deployment. Each group deploys its own site.

---

## 11. Hosting and setup

### The site: Cloudflare Workers + D1 (default)
The site is one Cloudflare Worker: it serves the built UI as static assets and
runs the Hono API, with a D1 database (SQLite) for plans, members, ballots and
comments. Cloudflare's free plan covers a group comfortably: D1 allows 5 M
rows read and 100 K written per day and 5 GB of storage, and queries past the
daily cap fail until midnight UTC rather than billing. Workers and D1 don't
sleep, so the site answers instantly after weeks of silence between trips.

Storage sits behind one interface with two implementations: **D1** for
Cloudflare and **`node:sqlite`** for tests, local development, and anyone who
prefers running the Node server themselves (Docker on any small server). Both
use the same SQL schema and migrations.

Considered and not the default:
- **Vercel Hobby + Neon Postgres.** Free, but Hobby is for non-commercial
  personal use only and lets Vercel use deployed content to train AI models,
  a poor fit for a group's private comments; and it means two accounts and a
  Postgres version of the storage layer.
- **Supabase.** Free projects pause after a week without database activity,
  and a group site sits idle for weeks between trips.

### What a hoster does
1. **Deploy the site**: the README's "Deploy to Cloudflare" button (or
   `npm run deploy:site` with Wrangler) creates the Worker and the D1 database.
2. **Set one secret**: `ADMIN_TOKEN`, 32+ random characters
   (`openssl rand -base64 32`).
3. **Clone the repo and run `npm run setup`**: it asks for the site URL, the
   admin token, and any optional keys (Anthropic, Duffel, Unsplash, Pexels),
   checks each one, and writes `.env`.
4. **Run the panel**: `npm run panel`, then open `http://127.0.0.1:5151`.
   "Personas y enlaces" issues each friend's private link (§5).
5. **Research, approve, publish, open the vote**, and paste the panel's message
   into the group chat (§7).

### Secrets
| secret | lives in | used for |
|---|---|---|
| `ADMIN_TOKEN` | Worker secret + panel `.env` | panel → site publishing and link issuing |
| `ANTHROPIC_API_KEY` | panel `.env`, optional | `anthropic-api` research |
| `DUFFEL_API_KEY` | panel `.env`, optional | flight search and verification |
| `UNSPLASH_ACCESS_KEY`, `PEXELS_API_KEY` | panel `.env`, optional | photo search |

The site holds no provider keys at all: photos are picked in the panel and
published as plain URLs with their credits.

---

## 12. Licence

MIT. Photos keep their own licences (§6); the site shows each credit.
