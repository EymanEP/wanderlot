# Wanderlot — spec

Trip planning for one fixed group of friends (Grupo 51, six people), built as two
halves that never blur into each other:

- **Panel** — runs only on the organiser's machine. Research and curation.
- **Site** — published, used by the six. Reading, commenting, voting.

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
| `outbound`, `inbound` | flight legs (§1.1) |
| `stays` | 0–2 accommodation options, one may be `recommended` |
| `todo`, `see` | lists of specific things ("Qué hacer", "Qué ver") |
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
- `photos` — §6
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
  leave the machine.
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
third 1. Six members × 6 points = 36 points in play.

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
  whichever is first. Closing is checked on every read, so no cron is needed.
- Once `closed`, ballots are read-only and the full scoreboard is shown:
  points, first places, and each member's ranking.
- Each member sees their own ballot at all times ("Tu 1.ª opción" on Plan cards).
  They never see the group tally before the close.

---

## 5. Identity on the site

Six known people, no sign-up. Each member gets **one private link**:
`https://<site>/p/<planId>?k=<token>`.

- The token is 32 random bytes, base64url. The site stores only its SHA-256.
- The first visit sets an http-only cookie and redirects to the clean URL.
- The panel issues the six links once and can revoke/reissue one.
- Anyone without a valid token sees nothing — not even the plan name.

---

## 6. Photos

Picked by the organiser at approval time in Revisar, never scraped.

- Hero shot: Unsplash or Pexels.
- Specific landmarks: Wikimedia Commons.
- Google Images is not a source (licensing).

Each photo stores `{ url, source, author, license, sourceUrl }`, and the site
renders the attribution. v1 hotlinks the provider URL; copying files to our own
storage is a later decision.

---

## 7. Telling people (v1)

No email or push in v1. When the organiser opens or closes a vote, the panel
produces a ready-to-paste message for the group chat: what opened/closed, the
deadline or the winner, and each person's private link. The group chat is
already where they are.

---

## 8. Data sources

The panel talks to one flight provider at a time through a `FlightProvider`
interface, plus the local `claude` binary through a `ResearchProvider`.

| source | status to check before building on it |
|---|---|
| Duffel | default. Offers API with real bookable fares. |
| Amadeus Self-Service | reportedly being decommissioned in 2026 — confirm before use |
| Kiwi (Tequila) | public sign-ups reportedly closed — confirm access |
| `claude` binary | `claude -p --output-format json --json-schema …`; always yields `claude` provenance |

Claude never produces `api` provenance, even when it quotes a price it found on
an airline site.

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

- Mobile layouts of the site (the group votes from phones — next design task).
- Plan-creation screen in the panel.
- Email/push notifications (§7 is the v1 answer).
- Booking. Wanderlot decides; it doesn't buy.
- Multiple groups. Grupo 51 is the only group; the model doesn't generalise it.
