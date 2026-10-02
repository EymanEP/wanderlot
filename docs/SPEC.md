# Wanderlot — spec

Trip planning for one fixed group of friends, built as two halves that never
blur into each other:

- **Panel** — for the organiser. Research and curation run on their machine;
  the site also serves the panel at `/admin`, without AI, to manage the group
  from a phone (§5, "The organiser on the site").
- **Site** — published, used by the group. Reading, commenting, voting.

Wanderlot is open source (MIT) and self-hosted: **one deployment serves one
group**. Anyone can deploy their own site for free (§11) and run the panel from
a clone of the repo. The reference group throughout this spec and the mocks is
Grupo 51: six people, planning from Madrid.

The one rule everything else serves: **nothing reaches the site until the
organiser approves it.** The panel generates twelve options; the group sees the
four the organiser stands behind.

Design reference: the "Wanderlot · Planes de viaje" canvas (six screens, v1 and
current). UI copy is Spanish by default, with English for the site (§12);
code and docs are English.

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
| `nights` | 1–30: the days between the start and end picked on the calendar |
| `flexDays` | 0, 1 or 2 |
| `partySize` | 6 |
| `maxPriceCents` | ceiling per person, flights and stay; `null` for no limit |
| `status` | `draft` → `voting` → `closed` (see §4) |
| `voteDeadline` | set when voting opens |
| `winnerDestinationId` | where they're going: set when closed; the vote's winner unless the organiser chose another |
| `decidedNote` | optional, up to 300 characters: why the organiser chose another destination |

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

### Trip page (El viaje)
Once the destination is decided, an optional part of the snapshot:
`trip: { destinationId, intro, todo, food, sights, beforeYouGo, home,
toAirport, fromAirport, stay: { address, checkIn, checkOut }, tricountUrl,
sources, preparedAt }`. Guide items are `{ title, detail, priceCents?,
where? }`; ways to get there are `{ mode: car | bus | train | metro | taxi |
shuttle | walk | other, title, detail, minutes, priceCents }`, per person.
Its `destinationId` must be one of the published destinations. Research
drafts the guide and the transport; the organiser edits it and adds the
stay's details and the Tricount link. Flights and stay show the destination's
own (checked) prices; everything the guide says is labelled as Claude's and
approximate.

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
- **The panel's data lives on the site** (ROADMAP 3.2): proposals, drafts,
  notes, the last publish and unused invite links, in tables friends never
  read (§9, `/api/admin/panel/*`). One JSON entry per trip, versioned, so the
  laptop and the phone can't overwrite each other: a save names the version
  it read and is refused (409) if someone saved first. Every panel request
  reads what changed first and waits for its own writes. Invite links are
  sealed (AES-GCM) with a key from the admin token.
- With a site older than API version 10, the local panel keeps them in
  `data/panel.json`; the first start against a newer site moves the trips it
  doesn't have yet there and keeps the file as `panel.json.moved-to-site`.
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

Every figure on the site traces to where it came from. Provenance has three
kinds:

| kind | badge | meaning |
|---|---|---|
| `api` | green **Verificado con la API** | price and schedule returned by a flight API; carries `provider` and `checkedAt` |
| `organiser` | green **Comprobado a mano** | the organiser checked the real prices (airline, booking site) and typed them in Revisar; carries `checkedAt`, and research's `sources` for reference |
| `claude` | amber **Lo escribió Claude** | produced by Claude from web research; carries `sources`, not yet checked |

**Staleness.** Prices move, so a verification has a shelf life. A verified
proposal (by API or by hand) whose `checkedAt` is older than **72 hours** is
*stale*. Staleness is
derived, not a third provenance kind:

- On the site, a verified badge always shows its age: "Verificado hace 3 días".
  A stale one renders in the neutral tone rather than green.
- A price checked for other dates is stale too: when a trip's dates change,
  every checked proposal gets `forOtherDates` and shows "Precio de otras
  fechas", and flight times read from a screenshot are dropped. Checking it
  again clears the flag.
- In the panel, publishing a stale or unverified proposal is allowed but asks
  for confirmation, and **opening a vote re-checks every verified `inVote`
  destination** first.

"Verificar con la API" on a `claude` proposal searches the same route and dates
on the configured flight provider. If it finds a matching itinerary, provenance
becomes `api`. If not, the proposal keeps its `claude` badge and the panel says
why. Without a flight API, "poner precios reales" on any proposal lets the
organiser type the checked prices the way booking sites show them: one person's
flights there and back, and the recommended stay for the whole group and all the
nights (as Airbnb does). The panel divides the stay by the people going and
stores both the way proposals keep prices (each flight leg per person, the stay
per night); provenance becomes `organiser`. Revisar shows prices the same way:
the flight per person, the stay's total with each person's share beside it.

The organiser can also upload screenshots (the airline or Google Flights, Airbnb)
and have Claude read them: the flights' times, numbers and price (a total for
several passengers becomes one person's share), and the stay's name, a short
description and its total. The dialog fills in what was read for the organiser
to review; nothing is saved until they do. Checked this way the flights carry
`flightDetails: true`. Without it, a hand-checked price sits beside research's
guessed times, so the site shows the round trip's price alone (no times, dates
or flight numbers). A checked stay replaces research's options: the site shows
only that one, with its link if the organiser added one.

A new search in Generar adds to a trip's proposals and never replaces them:
research is told which destinations are already there, and each new proposal
gets an unused id.

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
and the organiser picks one of the tied destinations in the panel's Votación
screen; the site then shows it as the winner. There is no hidden fourth rule.

Once closed, the organiser can also send the group to another destination in
the vote, with an optional note ("Lo hablamos y preferimos Praga"). The count
doesn't change: the site shows both where they're going and who won the vote.

### Lifecycle
```
draft ──open vote (deadline)──▶ voting ──all 6 voted, or deadline passes──▶ closed
```
- While `voting`, a member may change their ballot any number of times.
- **The scoreboard is hidden from friends while `voting`.** Visible to everyone
  at all times: who has voted and who hasn't (names only, never rankings).
- The organiser follows the vote live in the panel's Votación screen: the
  running count and what each person has voted. (If the organiser also
  votes, they can see others' ballots first; it's their group.)
- The vote closes the moment the sixth ballot arrives or the deadline passes,
  whichever is first. ("Sixth" means the group's `partySize`.) Closing is checked on every read, so no cron is needed.
- The organiser can also close it early from the panel's Votación screen
  ("Cerrar ya"), once at least one ballot is in. It counts what's there.
- Once `closed`, ballots are read-only and the full scoreboard is shown:
  points, first places, and each member's ranking.
- Each member sees their own ballot at all times ("Tu 1.ª opción" on Plan cards).
  They never see the group tally before the close.

---

### Ideas from the group
- While a trip's vote isn't closed, anyone on it can **propose a destination**
  from the site ("Proponer un destino"): a place in their own words and,
  optionally, why. Everyone on the trip sees what has been suggested, so
  nobody proposes the same place twice. Each person can have up to 5 waiting.
- The organiser sees them in the panel's Generar, under "Ideas del grupo":
  **Investigar** researches that place (one proposal, the same checks as any
  other) and credits it ("Idea de Marta", in the panel and on the site);
  **Descartar** drops it from the list.
- A researched idea still goes through Revisar and publishing like any
  proposal; after the first ballot, new destinations can't join the vote.

### Dates (Cuándo)
Optional, per trip, and independent of the destination vote: before it, after
it or alongside.
- The organiser proposes **2–5 date windows** in the panel's Fechas page, with
  an optional "responder antes del" (informative: answering stays open until
  the organiser chooses). A trip that isn't on the site yet goes up without
  destinations, so the group can answer before anything is researched.
- On the site, a **Fechas** tab (first while open, last once decided): for each
  window **Sí**, **Si hace falta** or **No**, plus one optional note. Every
  window must be answered. Everyone on the trip sees everyone's answers: it's
  a Doodle, not a secret ballot, and nothing is ranked.
- A window's id is its dates (`2026-11-03_2026-11-07`), so when the organiser
  changes the windows, answers to the ones that stay are kept.
- The panel shows who can go when and suggests the best windows (most yes,
  then fewest no, then most "si hace falta"). **Elegir** closes the date vote
  and gives the trip those dates, in the panel and in the site's snapshot;
  prices checked for other dates are flagged (§3). Proposing again reopens it.
- Or, without a vote, the organiser **fixes** the dates in the panel ("Fijar
  estas fechas"). The site takes them at once, without publishing anything
  else (`PUT /api/admin/plans/:id/dates/settled`), and the snapshot carries
  `datesDecided: true` from then on.

### Days off (vacaciones)
Everyone works somewhere different, so before anything is booked each person
confirms they've got the trip's days off.
- It starts once the dates are decided: a date vote chose them, or the
  organiser fixed them. A reopened date vote, or dates unfixed, puts it away.
- Each person on the trip answers on the site: **Aún no los he pedido**,
  **Los he pedido**, **Me los han aprobado** or **No me los dan**. Everyone
  on the trip sees everyone's answer: it's for coordinating, like Fechas.
- The organiser follows it in the panel (Fechas, and a step in El viaje
  before the prices). They can mark it for someone who told them in the
  group chat; the site then says "Lo marcó … por ti". The panel has a message
  for the chat naming whoever hasn't confirmed.
- An answer is for the dates it was given for. If the dates change, everyone
  is back to "Aún no los ha pedido", and anyone who had answered is flagged
  as having answered for other dates.
- Nothing is blocked: it's a check, not a gate. El viaje ticks the step only
  when everyone has the days, and says who is missing.

---

## 5. Identity on the site

A small, known group, no passwords to remember beyond a short PIN. The
organiser brings each person in with a **one-time invite**; they choose a
**4-digit PIN** and from then on sign in with **their name and PIN** on any
device. A **passkey** (Face ID, a fingerprint) is an optional extra for
whoever wants it on a given device.

"Cambiar mi PIN" in the account menu sets a new one while signed in
(`PUT /api/session/pin`, same rules as a new PIN); the old one stops working.

### The organiser on the site (`/admin`)
- The site serves the panel itself at `/admin` (ROADMAP 3.1): the same pages
  on the same data (§2), for the organiser's phone. There is no AI there: a
  Worker can't run `claude`, so Generar, reading screenshots and "Preparar
  con Claude" say to use the laptop, and prices are typed.
- It's off until the organiser sets a password from the local panel
  (Personas, "Panel en el móvil"), at least 10 characters. It's stored like a
  PIN: an HMAC-SHA256 with a per-password salt, keyed by the PIN secret, so
  the database alone can't test guesses (a slow hash wouldn't fit a free
  Worker's CPU budget). Changing it signs every device out and lifts a
  lockout; clearing it turns `/admin` off.
- Signing in at `/admin` takes that password, with the PIN's growing
  lockouts after five wrong ones. It starts an organiser session: a random
  token in an http-only cookie limited to `/admin`, `SameSite=Strict`, 30
  days. Members' sessions never reach the panel, and the admin token never
  reaches a browser: the hosted panel calls the admin API inside the Worker.
- Changes under `/admin/api` must come from the site's own origin, as JSON.

### Trips
- Members belong to the group, and the organiser puts them on **trips**
  (plans): who goes is chosen when the trip is created and can change later
  in Personas.
- A member sees only the trips they're on: the list, the plan, its comments,
  results and vote. Any other trip answers "not found", as if it didn't exist.
- The vote waits for the trip's people: it closes when **all of them** have
  voted, or at the deadline. A ballot from someone later taken off the trip
  no longer counts.
- Invites in the vote-opened message go only to the trip's people.

### Invites
- The panel asks the site for an invite for one member. The site returns a
  link once, `https://<site>/i/<token>`, and stores only the token's SHA-256.
- The token is 32 random bytes, base64url. An invite expires after **7 days**
  and works **once**. Creating a new invite for someone cancels their previous
  unused one.
- Opening the link shows "¿Eres Laura?" and asks her to choose a PIN (typed
  twice), or to create a passkey on this device instead. **Only finishing that
  consumes the invite.** Merely opening the link (a WhatsApp link preview, a
  second tap) changes nothing.
- A used, expired or cancelled invite says so and tells the person to ask the
  organiser for a new one. A new invite is also how someone resets a
  forgotten PIN.

### PINs
- Four digits; obvious ones (all the same digit, 1234, 9876, repeated
  pairs like 1212, and the most common PINs such as 2580) are refused.
- Stored as an HMAC-SHA256 of the PIN with a per-member salt, keyed by a
  server secret (`PIN_SECRET`, set by `npm run deploy:site`; the admin token
  if unset). Four digits are too few to survive a copied database on their
  own; the secret means the database alone can't test guesses.
- Signing in takes a name (accents, case and spacing ignored; the member id
  works too) and the PIN. A wrong name and a wrong PIN get the same answer.
- **Five wrong PINs in a row lock that person out**, longer each time: 15
  minutes, then 1 hour, 4 hours, then a day per lockout, until they sign in
  with the right PIN or get a new invite. With 10,000 possible PINs, that
  keeps guessing one person's PIN out of reach. Each
  address is also rate-limited on the sign-in routes. Changing the PIN means
  a new invite.
- Names must be unique within the group, since people sign in with them.

### Signing in
- Coming back needs only the site's address: "Entrar", then name and PIN, or
  "Entrar con passkey" on a device that has one.
- Signing in creates a **session**: a random token in an http-only, `Secure`,
  `SameSite=Lax` cookie, stored hashed on the site, valid **180 days** from last
  use (refreshed at most once a day).
- Without a session the site shows only the sign-in screen: not the plan name,
  not who is in the group.

### What the organiser can do (panel → "Personas")
- Add people, choose who goes on the selected trip, and see each one's state:
  *sin invitar*, *invitación pendiente*, *invitación caducada*, or *dentro*
  with their PIN (and whether it's locked), passkeys and devices.
- Send a new invite, **close sessions** (signs the person out everywhere; their
  PIN and passkeys still work), or **remove access** (deletes their PIN,
  passkeys, sessions and pending invite; they need a new invite).

### Why this shape
- A forwarded invite is useless once used. If someone uses it first, the real
  person finds it spent, and the organiser sees who signed in when, removes
  that access and sends a new invite.
- It needs no email service or third-party login, so it costs a hoster nothing.
- A PIN works on any device, including a laptop with no passkey, which a
  passkey-only sign-in made awkward.
- Passkeys belong to the site's domain. **A hoster should settle the final
  address before inviting anyone**: passkeys made on `*.workers.dev` don't
  work on a custom domain (PINs do).

Implementation: SimpleWebAuthn (`@simplewebauthn/server` on the site,
`@simplewebauthn/browser` in the UI), MIT-licensed and run on Node and on
Cloudflare Workers.

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

1. **Claude picks what to show.** With each proposal it suggests three photo
   subjects as search terms: a hero ("Bahía de Nápoles") and landmarks the
   proposal mentions ("Pompeya", "Spaccanapoli").
2. **The panel finds candidates** for a subject (or anything the organiser
   types) through every configured service's own search API at once, results
   interleaved (`GET /api/photos?q=`). With no keys, Wikimedia alone works.
3. **The panel filters candidates**: Wikimedia results need a reusable licence
   (CC0, public domain, CC BY, CC BY-SA) and get their author in plain text; a
   service that fails is reported in the picker while the others still show.
4. **The organiser picks** in Revisar's photo picker, up to four in order: the
   first is the hero, the rest tiles. Keeping a new Unsplash photo triggers its
   download event.
5. **Publish carries the choice** with its credits. The site renders the image
   from the service's URL and the credit under it. An image that fails to load
   falls back to the labelled placeholder.

Each photo stores:

```
{ url, width, height, source: "unsplash"|"pexels"|"wikimedia",
  author, authorUrl, license, sourceUrl, alt, downloadLocation? }
```

Wikimedia serves thumbnails from `thumb.wikimedia.org` (originals from
`upload.wikimedia.org`); the site's Content-Security-Policy allows both. It serves
other sites only its standard thumbnail widths (…, 960, 1280,
1920, …) and rejects the rest. The panel asks for 1280px, and every screen
moves a saved thumbnail to the largest standard width that fits
(`standardImageUrl`), so photos saved at another width still load. A photo that
fails to load anyway shows its grey placeholder, never a broken image.

Copying files into our own storage (Cloudflare R2's free tier would hold
them) is not part of v1. It becomes worth doing if linked Wikimedia images
start disappearing; Unsplash photos must stay linked either way.

---

## 7. Telling people (v1)

No email or push in v1. The panel writes ready-to-paste messages for the
group chat, each with an "Abrir WhatsApp" button:
- **Vote opened:** the deadline and the site's address, plus a working invite
  for anyone who hasn't signed up yet.
- **Reminder** (while voting): names who hasn't voted, never what anyone voted.
- **Result** (once closed and any tie broken): the winner and the site's address.
- **Dates proposed:** the windows, the "responder antes del" if any, the link
  to the Fechas tab and invites for anyone who hasn't signed up.
- **Dates reminder:** who hasn't answered every window.
- **Dates chosen:** the dates, so people can ask for the days off.

The group chat is already where they are.

---

## 8. Providers

Every outside service sits behind an interface in the panel, and each hoster
configures only the ones they have. The panel works with none of the paid ones.

### Research (AI)
`ResearchProvider` produces proposals, pros and cons, and photo subjects; it
also reads screenshots of prices (`extract`) and drafts the trip page
(`guide`: what to do, eat and see, what to know, and how to get from the
group's home town to the airport and from the airport to the stay, with
sources). `guide` uses the same tools and settings as research.

| provider | how | cost to the hoster |
|---|---|---|
| `claude-cli` (default) | the local `claude` binary: `claude -p --output-format stream-json --verbose --json-schema <draft-07 schema> --tools WebSearch,WebFetch --allowedTools WebSearch,WebFetch` (only web search and fetch, pre-approved, since a headless run can't ask) | their Claude subscription, no API bill |
| `anthropic-api` | Anthropic API (`claude-opus-5`, web search, structured output), `ANTHROPIC_API_KEY` | pay per use |
| `openai-api` | OpenAI's Responses API with its web search tool and a JSON schema, `OPENAI_API_KEY` (model `OPENAI_MODEL`, default `gpt-5`); streamed, so each search shows in Generar | pay per use |
| `compatible-api` | any endpoint that speaks OpenAI's chat completions (OpenRouter, a local model…): `AI_BASE_URL`, `AI_API_KEY`, `AI_MODEL`, and `AI_NAME` for how friends see it. It can't search the web, so research answers from what the model knows and every proposal is an **estimate** (below) | whatever the endpoint charges |

Which one runs is chosen in **Ajustes** (ROADMAP 3.3), among those set up;
the choice is kept in `.env` as `WANDERLOT_AI`. Without a choice, the first
set up in the order above. Keys are never typed in the browser: they live in
the panel's `.env`, or as Worker secrets for the panel at `/admin`, where
`npm run deploy:site` copies them only if `npm run setup` was told to
(`WANDERLOT_SITE_AI=1`). There, screenshots are read within the request.
Research and the guide take minutes, longer than a Worker request should
wait and far more than its CPU allows, so they run as **background jobs** on
the AI's own servers:

- `anthropic-api` sends a one-request Message Batch (web search and the
  output schema as usual; batches don't take the refusal fallback, so a
  refusal fails the job). A batch that ends on `pause_turn` is resumed once
  in a second batch; a second pause fails the job. Most batches end within
  minutes, some take up to an hour.
- `openai-api` uses the Responses API's `background: true` mode.
- `compatible-api` can't: the panel at `/admin` says to use one of the two
  above, or the laptop.

Starting one (`POST …/generate` or `…/trip/prepare`) answers `202 {job}` at
once. The job lives in the trip's panel entry (`job`: kind, AI, its id there,
the request, when it started, and later how it ended), so every device sees
it; one runs at a time per trip. `GET /api/plans/:id/job` checks on it — a
few quick requests — and, once it's done, saves the proposals (as pending,
crediting a friend's idea) or the trip page, as a streamed search would. The
laptop's panel asks the site to check (`POST /api/admin/panel/plans/:id/job`,
site API 12), since the site holds the keys that started it. `DELETE …/job`
cancels a running one or clears how the last one ended. The screens check
every few seconds while one runs; the page can be closed meanwhile.

With no AI at all the panel still works: **Añadir a mano** in Revisar takes a
destination (city, country, airport, type) with the flight and stay prices
the organiser saw, and adds it approved, with `organiser` provenance and no
flight times until the price dialog adds them.

A Claude search takes minutes and its proposals arrive together at the end, so
the provider also reports progress as it goes: what Claude says it is doing,
each web search (the query) and each page it reads (the host). The panel relays
these as `{progress}` lines and Generar shows them live, with the elapsed time
and a Detener button.

Whatever the provider, research always yields `claude` provenance (§3; the
kind keeps its first name): it is labelled as written by AI until a flight API
or the organiser confirms it, even when it quotes an airline's price. It
carries `by` ("OpenAI") when the AI isn't Claude, so the site says "Lo
escribió OpenAI". An AI without web search sets `estimate: true` and cites no
sources, which the model allows only then; the site says "Estimado por …".
Sites before API version 11 refuse sourceless research, so the panel asks for
a redeploy before publishing an estimate to one.

### Checking finalists in the browser (local panel only)
"Comprobar vuelos" reads a finalist's flights on Google Flights, for the
organiser to pick one. It is offered for **approved** proposals only: on each
card in Revisar, for all of them at once ("Comprobar vuelos de las aprobadas",
one after another), in El viaje for the decided destination, and as "Mirar en
Google Flights" in the price dialog. Nothing is saved until the organiser
picks and saves in the price dialog, which opens with what was read.
- **The stay is checked by hand.** Airbnb's pages couldn't be read reliably,
  so the price dialog links to Airbnb instead: to the chosen listing with the
  trip's dates and people, or to a search for a whole place for the group.
  The organiser types the total, or reads it from a screenshot.
- **How it reads.** The `claude` command drives a visible browser on the
  organiser's laptop through Playwright MCP (`@playwright/mcp`). It opens the
  Google Flights search for the route and dates and reads the flights into
  the same fields as a screenshot.
- **What gets saved.** What the organiser picks, as `organiser` provenance
  with `seenOn: ["google-flights"]` and the booking page in `sources`; the
  site says "Visto en Google Flights". (Older checks may carry `airbnb` too.)
- **What the run may use.** It gets no built-in tools (`--restricted --tools
  ""`) and no other MCP servers or settings (`--strict-mcp-config`). It has
  only the Playwright tools for reading a page (navigate, snapshot, click,
  type…). Running scripts, files, and cookies or storage by hand are refused
  outright.
- **The browser.** Any Chromium on the laptop: Chrome, Brave, Edge or
  Chromium. The panel finds where each installs itself (macOS, Windows,
  Linux) and starts it by its path (`--executable-path`). Ajustes picks one
  (`WANDERLOT_BROWSER`, which takes a name or a path), and Chrome comes
  first when nothing is set. Each browser gets a profile of its own under
  `data/browser/<browser>` (`WANDERLOT_BROWSER_PROFILE`), apart from the
  organiser's, kept between runs so a cookie choice or a solved CAPTCHA is
  remembered. It opens as a new window, not a tab in the organiser's own
  browser. The organiser sees it and clears any consent page or CAPTCHA, and
  Claude waits for them. One window at a time: further checks queue.
- **When the browser can't open.** If no page ever opened (not installed,
  closed on start), the panel says why ("No encontré Brave en …") instead of
  "no vi el precio". When the page opened but nothing could be read (a
  CAPTCHA, a notice, an empty list), Claude says what got in the way, and
  the dialog shows it. Each run's steps are kept until the next one of its
  kind in `data/browser/ultima-comprobacion-vuelos.ndjson`, to
  see what happened on a site.
- **Reading.** On a long page Claude searches for the prices
  (`browser_find`) rather than reading it all.
- **Terms.** Google's terms don't allow automated access. This
  checks a handful of pages, one at a time, on the organiser's own machine
  and at their request, as they would by hand. It is not a crawler, and it
  never runs in Generar, on the site, or on its own.

### Flights (optional)
`FlightProvider` searches and verifies fares; it is the only way to `api`
provenance.

| provider | status |
|---|---|
| Duffel (default) | not wired up yet: the client is a stub, so the panel reports no flight API and searches with Claude. Real bookable fares need a live account; test mode returns made-up flights. Check its pricing for search-only use before relying on it |
| Amadeus Self-Service | reportedly being decommissioned in 2026 — confirm before use |
| Kiwi (Tequila) | public sign-ups reportedly closed — confirm access |

Without a flight provider, every proposal stays "Lo escribió Claude" and the
panel says so on Generar.

### Photos
Unsplash, Pexels and Wikimedia Commons, per §6.

---

## 9. Site API (v1)

Member routes require the session cookie (§5). Admin routes require
`Authorization: Bearer <ADMIN_TOKEN>`. Passkey steps come in pairs: `options`
returns WebAuthn options and a `flowId`; `verify` takes the `flowId` and the
browser's response. A flow expires after 5 minutes and can be used once.

| method | path | who | notes |
|---|---|---|---|
| `GET` | `/`, `/i/:token`, `/p/*` | anyone | the web UI; it asks the API what to show |
| `GET` | `/api/site` | anyone | `{ groupName, organiserName, locale }`, for the sign-in screens and the site's language (`locale`: version 14) |
| `GET` | `/api/invites/:token` | anyone | `{ member: { name }, status: valid \| used \| expired \| cancelled }`; never consumes it |
| `POST` | `/api/invites/:token/pin` | invitee | `{ pin }`: sets the PIN, uses up the invite, starts a session |
| `POST` | `/api/invites/:token/passkey/options` | invitee | `410` unless valid |
| `POST` | `/api/invites/:token/passkey/verify` | invitee | saves the passkey, uses up the invite, starts a session |
| `POST` | `/api/session/pin` | anyone | `{ name, pin }`; `401` for a wrong name or PIN alike, `429` when locked out |
| `POST` | `/api/session/options` | anyone | passkey sign-in |
| `POST` | `/api/session/verify` | anyone | starts a session |
| `GET` | `/api/session` | member | `{ member }` or `401` |
| `DELETE` | `/api/session` | member | signs this device out |
| `GET` | `/api/plans` | member | the trips they're on, for the "Tus viajes" page at `/`: `{ id, name, status, dateFrom, dateTo, partySize, winnerCity, destinations, voteDeadline, votedByMe, datesOpen?, datesAnsweredByMe?, tripReady? }` |
| `GET` | `/api/plans/:planId` | member | plan + destinations + own ballot + participation + `dates` (the date vote with everyone's answers, or `null`) + `trip` (the trip page, or `null`; site API version 9) + `leave` (days off, or `null` until the dates are decided; version 13) |
| `PUT` | `/api/plans/:planId/dates` | member | `{ answers: { optionId: yes \| maybe \| no }, note? }` for every window; `409` once the dates are chosen |
| `PUT` | `/api/plans/:planId/leave` | member | `{ status: not-asked \| asked \| approved \| denied }` for the trip's current dates; returns the `LeaveView` `{ dateFrom, dateTo, people: [{ id, name, status, at, byOrganiser, forOtherDates }] }`; `409` until the dates are decided. Site API version 13 |
| `PUT` | `/api/plans/:planId/ballot` | member | `{ ranking }`; `409` unless voting |
| `GET` | `/api/plans/:planId/results` | member | `403` until closed |
| `GET` | `/api/plans/:planId/comments?destinationId=&limit=` | member | newest first, each with `likes` and `likedByMe` |
| `POST` | `/api/plans/:planId/comments` | member | `{ destinationId, body, parentId? }` |
| `PUT` | `/api/plans/:planId/comments/:commentId/like` | member | `{ on }` |
| `GET` / `POST` | `/api/plans/:planId/suggestions` | member | ideas for the trip / `{ place, note? }`; `409` once closed or with 5 waiting |
| `GET` | `/api/admin/plans/:planId/suggestions` | panel | the trip's ideas with who suggested them |
| `PUT` | `/api/admin/plans/:planId/suggestions/:id` | panel | `{ status: new \| researched \| dismissed, proposalId? }` |
| `GET` / `PUT` | `/api/admin/settings` | panel | `{ groupName, organiserName, defaultOrigin?, homeTown? }` |
| `PUT` | `/api/admin/plans/:planId` | panel | publish snapshot; `409` if it breaks the freeze |
| `DELETE` | `/api/admin/plans/:planId` | panel | delete the trip with its ballots, comments, likes, ideas and people; `{ deleted }` (false if it wasn't there). Site API version 6 |
| `POST` | `/api/admin/plans/:planId/open-vote` | panel | `{ deadline }`; needs ≥ 2 in-vote destinations |
| `GET` | `/api/admin/plans/:planId/vote` | panel | `{ status, voteDeadline, partySize, voted, tally, ballots, result }`: the live count and every ballot for the organiser; `result` once closed |
| `POST` | `/api/admin/plans/:planId/close` | panel | close early; `409` unless voting with ≥ 1 ballot |
| `PUT` | `/api/admin/plans/:planId/winner` | panel | `{ destinationId }`, only among those tied for first; or `{ destinationId, override: true, note? }`, any destination in the vote once closed (choosing the vote's own winner clears the note). Results carry `winnerId` (where they're going), `voteWinnerId` and `decidedNote`. Site API version 7 |
| `GET` / `PUT` / `DELETE` | `/api/admin/plans/:planId/dates` | panel | the date vote (§4 Dates): `DatesView` `{ status: open \| closed, options: [{ id, dateFrom, dateTo }], deadline, chosenOptionId, responses: [{ memberId, answers: { optionId: yes \| maybe \| no }, note, updatedAt }] }` or `null` / `{ options: [{ dateFrom, dateTo }] (2–5), deadline? }` proposes or changes the windows, keeping answers to the ones that stay, and reopens it / removes it. Site API version 8 |
| `POST` | `/api/admin/plans/:planId/dates/choose` | panel | `{ optionId }`: closes the date vote and sets the snapshot's `dateFrom`, `dateTo` and `nights` |
| `PUT` | `/api/admin/plans/:planId/dates/settled` | panel | `{ dateFrom, dateTo }`: dates fixed without a vote, into the snapshot at once with `datesDecided: true`; `{ settled: false }` undoes it. `{ leave }`. Site API version 13 |
| `GET` | `/api/admin/plans/:planId/leave` | panel | `{ leave }`: days off (§4), or `null` until the dates are decided |
| `PUT` | `/api/admin/plans/:planId/leave/:memberId` | panel | `{ status }`: the organiser marks it for someone on the trip (`byOrganiser`); `404` for someone not on it |
| `GET` | `/api/admin/panel/plans` | panel | the panel's trips (§2): `{ planId: version }` |
| `GET` / `PUT` | `/api/admin/panel/plans/:planId` | panel | `{ entry, version }` / `{ entry, version }` saves if the stored version is still `version` (0: new), `entry: null` deletes; `{ version }` or `409`. Site API version 10 |
| `GET` / `PUT` | `/api/admin/panel/invites[/:memberId]` | panel | unused invite links, unsealed for the panel: `{ memberId: { token, expiresAt } }` / `{ invite }` (null removes) |
| `GET` / `PUT` | `/api/admin/organiser` | panel | `{ enabled, setAt }` / `{ password }` sets the `/admin` password (null turns it off); signs every organiser session out |
| `GET` / `POST` / `DELETE` | `/admin/api/session` | organiser | whether signed in (`404` while `/admin` is off) / `{ password }` starts an organiser session (`401`, `429` when locked) / signs out |
| any | `/admin/api/*` | organiser | the panel's API (below), for the panel the site serves; `401` without an organiser session |
| `GET` | `/admin/*` | anyone | the panel's page; it asks for the password |
| `GET` | `/api/admin/export?plan=` | panel | everything the group made, one trip or all: `{ format: "wanderlot-export", version: 1, exportedAt, settings, members, trips }`, each trip its snapshot, status, winner, note, members, ballots, comments with likes, ideas, date vote and days off. No PIN hashes, passkeys, sessions or invites. Site API version 7 |
| `PUT` | `/api/admin/members` | panel | `[{ id, name }]`: adds or renames members; `409` if a name clashes |
| `GET` / `PUT` | `/api/admin/plans/:planId/members` | panel | who is on the trip: `[memberId]` |
| `GET` | `/api/admin/members` | panel | each member's invite, passkeys and sessions (§5) |
| `POST` | `/api/admin/members/:id/invite` | panel | `{ token, expiresAt }`, returned once; cancels the previous unused invite |
| `DELETE` | `/api/admin/members/:id/sessions` | panel | signs the member out everywhere |
| `POST` | `/api/admin/members/:id/revoke` | panel | deletes PIN, passkeys, sessions and pending invite |

Members belong to the group: one sign-up works for every trip they're put on.
Member routes under `/api/plans/:planId` answer `404` to anyone not on the trip.

### Panel screens
One frame (top bar, trip bar) stays mounted while the screens change below
it, and each screen shows what it loaded on the last visit at once while it
reads it again. Each screen comes in with a short movement (GSAP: it fades
and rises, its cards one after another), and dialogs lift in; none of it for
whoever asks their system for reduced motion. While a dialog is open the page
behind it doesn't scroll. The site moves the same way, and coming back to a
trip there shows it at once while it's read again. Work the AI does for a while — a search, the trip's guide,
reading Google Flights — belongs to the panel rather than to a
screen: it carries on while the organiser moves around, shows in the top bar
("Claude prepara la guía de Praga"), says when it ends from wherever they
are, and its result waits on its screen. An answer that doesn't fit what the
trip page takes is shortened rather than failing, and a failed check is
explained in words, never as a raw validation dump.

### Panel API (local)

The panel's own server, for its UI only. It listens on `127.0.0.1`, answers
only requests whose `Host` is the panel itself, and takes changes only as
JSON from its own origin (so other web pages the organiser opens can't drive
it). Calls that touch the site go through the admin API above. The site
serves the same API at `/admin/api` for the organiser (§5), without research.

| method | path | notes |
|---|---|---|
| `GET` | `/api/status` | research, flights and photo sources available here; whether the site answers, and whether it runs an older version than the panel (`GET /api/admin/version`) |
| `GET` / `PUT` | `/api/settings` | the group's settings, stored on the site |
| `GET` / `POST` | `/api/plans` | list (newest first) / create a draft |
| `GET` / `PUT` | `/api/plans/:planId` | plan, proposals, editorial notes and participants / save the plan; new dates mark checked prices `forOtherDates` |
| `GET` | `/api/trips` | the Viajes page: each trip with its proposal counts, participants and publish status |
| `DELETE` | `/api/plans/:planId` | delete the trip here and on the site; `409` if the site is older than API version 6, touching nothing |
| `PUT` | `/api/plans/:planId/participants` | `[memberId]`: who goes; sent to the site too |
| `POST` | `/api/plans/:planId/generate` | research; streams NDJSON `{progress}` and `{proposal}` lines, then `{done}` or `{error}`; `409` when asked to search with a flight API and none is connected; with scope `named`, researches that one place by name (one proposal); with `suggestionId`, researches that friend's idea by name and credits them |
| `GET` / `PUT` | `/api/plans/:planId/suggestions[/:id]` | the group's ideas / `{ status }`, e.g. dismissed |
| `POST` | `/api/plans/:planId/proposals/:id/prices` | prices checked by hand: `{ flightCents, stayCents?, outbound?, inbound?, stay? }` (one person's flights there and back; the whole stay for the group; the flights' real times, together; the stay's name, description and link) |
| `POST` | `/api/plans/:planId/proposals/:id/extract` | `{ kind: flight \| stay, images: [{ mediaType, data }] }` (1–4 screenshots, base64): what Claude read, for the price dialog; saves nothing. The `claude` command gets only the Read tool, only on a temporary folder holding the images |
| `POST` | `/api/plans/:planId/proposals/:id/browse` | "Comprobar vuelos": Google Flights read in the browser (§8); streams NDJSON `{progress}`, then `{fields}` or `{error}`; saves nothing. `fields.options` holds up to 5 flights (`{ outbound, inbound, flightCents, listedCents, checkedToEnd, bookWith, bookingUrl, note }`), the first filled in, and `problem` says what got in the way. `{ kind: "stay" }` is refused: the stay is checked by hand. Approved proposals only |
| `GET` / `PUT` | `/api/browser` | Ajustes: `{ options: [{ id, name, path }], active }`, the browsers found on this laptop / `{ id }` picks one (kept in `.env`) |
| `POST` | `/api/plans/:planId/proposals/:id/review` | `{ review: pending \| approved \| discarded }` |
| `POST` | `/api/plans/:planId/proposals/clear-unapproved` | deletes every proposal not approved (to review or discarded) with its notes and photos; `{ removed }` |
| `POST` | `/api/plans/:planId/proposals/:id/verify` | re-price on the flight API |
| `PATCH` | `/api/plans/:planId/proposals/:id/editorial` | pros, cons, weather, photos, `inVote` |
| `GET` | `/api/photos?q=` | photo search across configured sources (§6) |
| `POST` | `/api/plans/:planId/publish` | `{ confirm }`; `409` with warnings for unverified prices. Sends what's approved now, replacing what the site had; with nothing approved it empties a trip already published (`409` if never published) |
| `GET` | `/api/plans/:planId/publish-status` | `{ publishedAt, changed }`: whether anything that would go to the site changed since the last publish (Revisar shows "Cambios sin publicar") |
| `POST` | `/api/plans/:planId/open-vote` | `{ deadline }`; returns the group-chat message |
| `GET` | `/api/plans/:planId/vote` | who voted, reminder and result messages, the count once closed |
| `POST` | `/api/plans/:planId/close` | close early |
| `PUT` | `/api/plans/:planId/winner` | `{ destinationId }` to break a tie; `{ destinationId, override: true, note? }` to go somewhere other than the vote's winner (`409` on a site older than API version 7) |
| `GET` / `PUT` / `DELETE` | `/api/plans/:planId/dates` | Fechas: `{ dates, people, reminder, announcement }` / `{ options, deadline? }` proposes or changes the windows (publishing the trip without destinations if it isn't on the site yet) and adds the group-chat `message` / removes the date vote. `409` without people on the trip, or on a site older than API version 8 |
| `POST` | `/api/plans/:planId/dates/choose` | `{ optionId }`: the trip takes those dates here and on the site; checked prices are flagged `forOtherDates` |
| `POST` | `/api/plans/:planId/dates/fix` | `{ dateFrom, dateTo }`: "Ya sabemos las fechas", settled without a vote (refused while one is open); checked prices for other dates are flagged. The trip bar ticks Cuándo once the dates are settled, this way or by choosing (`datesDecided` in the panel's entry) |
| `DELETE` | `/api/plans/:planId/dates/fix` | back to undecided. Both this and fixing send the dates to the site at once (site API version 13; best effort) |
| `GET` | `/api/plans/:planId/leave` | days off: `{ leave, reminder }` (`leave` null until the dates are decided or while the trip isn't on the site; `outdated: true` on a site older than API version 13) |
| `PUT` | `/api/plans/:planId/leave/:memberId` | `{ status }`: marked by the organiser |
| `GET` / `PUT` | `/api/plans/:planId/trip` | El viaje: `{ destination, trip, published }` (the decided destination's proposal, the trip page being prepared, whether the site shows it) / save the organiser's edits (`409` until a destination is decided). Once published, El viaje asks `publish-status` whether anything changed since (prices, dates, the guide) and offers "Publicar cambios" |
| `POST` | `/api/plans/:planId/trip/prepare` | `{ home? }`: research drafts the guide and how to get there; streams NDJSON `{progress}` lines, then `{trip}` or `{error}`. Keeps the stay's details and the Tricount link; saves `home` as the group's `homeTown`. `409` without a decided destination or without Claude |
| `POST` | `/api/plans/:planId/trip/publish` | `{ published }`: publishes the trip with its page, or takes the page down. `409` on a site older than API version 9 |
| `GET` | `/api/export?plan=` | the site's export (above), for Viajes to download; `409` on a site older than API version 7 |
| `GET` / `PUT` | `/api/members` | people and their access / add or rename |
| `POST` | `/api/members/:id/invite` | a fresh one-time invite link |
| `DELETE` | `/api/members/:id/sessions` | sign them out everywhere |
| `POST` | `/api/members/:id/revoke` | remove access |

On the site, a plan in `draft` has been published for browsing and comments
but its vote hasn't opened.

---

## 10. Out of scope for v1 / still open

What's planned next is in [ROADMAP.md](ROADMAP.md): a date vote, the trip
page, getting to the airport, export, the panel hosted on the site with other
AI providers (or none), and later languages and currencies.

- **Local commands other than `claude`** (`codex`, `opencode`): each needs
  checking first (ROADMAP 3.3).
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

Storage sits behind one interface, written once in SQL over two drivers:
**D1** on Cloudflare and **`node:sqlite`** for tests, local development, and
anyone running the Node server themselves. Both apply the same migrations
(`apps/site/migrations/`). The Worker handles `/api/*` and `/admin/*`;
Cloudflare serves the built UI and falls back to it for page addresses. The
site's build also builds the panel for `/admin` into `dist/web/admin`, which
the Worker hands out through its `ASSETS` binding.

Considered and not the default:
- **Vercel Hobby + Neon Postgres.** Free, but Hobby is for non-commercial
  personal use only and lets Vercel use deployed content to train AI models,
  a poor fit for a group's private comments; and it means two accounts and a
  Postgres version of the storage layer.
- **Supabase.** Free projects pause after a week without database activity,
  and a group site sits idle for weeks between trips.

### What a hoster does
1. **Get the code and a Cloudflare account**: clone the repo, `npm install`, and
   `npx wrangler login` once.
2. **Run `npm run setup`**. It offers to deploy the site to Cloudflare
   (`npm run deploy:site`: creates the D1 database the first time, applies
   migrations, deploys the Worker, and generates and stores `ADMIN_TOKEN`),
   checks the panel can reach it, looks for the `claude` command, asks for any
   optional keys (Anthropic, Duffel, Unsplash, Pexels), and writes `.env`.
3. **Decide the final address before inviting anyone** (§5): the free
   `*.workers.dev` one, or a custom domain added in Cloudflare's dashboard.
   With a custom domain, set the Worker variable `ORIGIN` to it.
4. **Run the panel**: `npm run panel`, then open `http://127.0.0.1:5151`.
   "Personas" adds everyone and sends each a one-time invite (§5).
5. **Research, approve, publish, open the vote**, and paste the panel's message
   into the group chat (§7).

`npm run deploy:site` is safe to re-run after pulling new code: it applies new
migrations and redeploys. A "Deploy to Cloudflare" button can come later; with
this repo's workspaces the script is the reliable path.

Self-hosting without Cloudflare: `apps/site/src/server.ts` runs the same site on
Node with `node:sqlite` (`WANDERLOT_ORIGIN`, `WANDERLOT_ADMIN_TOKEN`,
`WANDERLOT_DB`).

### Secrets
| secret | lives in | used for |
|---|---|---|
| `ADMIN_TOKEN` | Worker secret + panel `.env` (as `WANDERLOT_ADMIN_TOKEN`) | panel → site publishing and invites |
| `ANTHROPIC_API_KEY` | panel `.env`, optional; Worker secret if shared | `anthropic-api` research |
| `OPENAI_API_KEY` (+ `OPENAI_MODEL`) | panel `.env`, optional; Worker secret if shared | `openai-api` research |
| `AI_BASE_URL`, `AI_API_KEY`, `AI_MODEL` (+ `AI_NAME`) | panel `.env`, optional; Worker secrets if shared | `compatible-api` research |
| `DUFFEL_API_KEY` | panel `.env`, optional | flight search and verification |
| `UNSPLASH_ACCESS_KEY`, `PEXELS_API_KEY` | panel `.env`, optional | photo search |

The site holds no provider keys unless the organiser shares the AI keys with
the panel at `/admin` (`npm run setup`, then `npm run deploy:site`). Photos
are picked in the panel and published as plain URLs with their credits.

---

## 12. Languages

Spanish (`es`) and English (`en`). Spanish is the default, so a group that
never chooses sees nothing change.

- **The group's language** is the organiser's choice: `GroupSettings.locale`,
  set in the panel's Ajustes and returned by `GET /api/site`. The site starts
  in it for everyone.
- **Each person** can switch the site for themselves from the account menu.
  The choice stays on that device (`localStorage` `wanderlot:locale`) and
  wins over the group's.
- **Copy** lives next to the code that shows it, as `copy({ es, en })` from
  `@wanderlot/core`; TypeScript checks that English has every string Spanish
  has. Components read it with `useCopy()` (`@wanderlot/ui`); dates, prices
  and other display helpers take the language too, and write "€1,720" and
  "Sat 7 Nov" in English.
- **The API** answers the friends' errors in the language the site is
  showing: the site sends it in the `x-wanderlot-locale` header, and Spanish
  is used without one. Errors meant for code ("expected {pin}") stay in
  English.
- **What the AI writes** is in the group's language: research (places,
  pros and cons, things to do and see, the weather line), the trip guide, and
  the stay's description read from a screenshot. The instructions stay in
  Spanish and end with the language to write in, place names included.
  Nothing is translated afterwards: what was already written stays in the
  language it was written in, and a person who switches the site to another
  language still reads it in the group's.
- **The messages for the group chat** (§7) are in the group's language.
- **Not yet in English:** the panel itself (ROADMAP 4).

---

## 13. Licence

MIT. Photos keep their own licences (§6); the site shows each credit.
