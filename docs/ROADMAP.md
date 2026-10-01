# Wanderlot roadmap

What comes next, after the first real trip: a group used the site to choose
between destinations, voted (Budapest won, Prague came second), then decided on
Prague, and later moved the dates from the week of 16 November to 3–7
November. Prices were close enough, but the organiser re-checked every
finalist by hand on Google Flights and Airbnb.

What this roadmap covers:
- **Fixes:** things that got in the way on that trip.
- **Features:** planned by user flow.
- **The panel from anywhere:** hosting the panel, and other AI providers.
- **Later:** big changes that wait.

**Done:** the fixes (§1), Cuándo (2.1), El viaje (2.2) with Cómo llegar
phase 1 (2.3) and the Tricount link (2.4), the export (2.5), the panel on the
site (3.1), one store (3.2), other AIs (3.3, all but other local commands)
checking the finalists in the browser (3.4) and days off (2.6). Everything
else is still a plan.

**Legend**

- 🎨 **Design first.** A new page or a big change to an existing one. Draw the
  screens in Claude Design before any code, so they follow the design system
  and so we can see how big the change is.
- **S / M / L:** rough size. S is a day or less, M a few days, L a week or more.
- ⚙️ **Site update.** Changes the site's API (`SITE_API_VERSION`). The organiser
  runs `npm run deploy:site`, and until then the panel says the site is out of
  date.

**Rules for every item.** Some groups already use the app, so every change must
keep their data and habits working:

- Database migrations only add things (new tables, new columns with defaults).
  Nothing is renamed or dropped.
- New features are optional per trip. A trip that doesn't use one looks and
  works exactly as it does today.
- The site shows a new section only when there's something in it.
- Friends never have to do anything new to keep using what they already use:
  sign in, vote, comment.

---

## 1. Fixes

All done, in one site deploy with the export (site API 7, migration 0006).

### 1.1 Choose a destination other than the vote's winner · S · ⚙️

**Problem.** The vote picked Budapest; the group agreed on Prague. Today the
organiser can only choose the winner among destinations that tied for first
(`PUT /api/admin/plans/:id/winner` refuses anything else), so the site keeps
announcing Budapest.

**Plan.**
- **Panel, Votación, once the vote is closed:** add "Ir a otro destino", which
  lists the other destinations in the vote. Picking one asks to confirm and can
  take an optional note, for example "Lo hablamos y preferimos Praga".
- **Site:** the result stays honest. The vote's count is untouched and still
  visible ("Ganó la votación: Budapest"), and the decision is shown on top
  ("Vais a Praga", with the note).
- **Data:**
  - `winner_destination_id` becomes "where they're going".
  - A new nullable `decided_note` column carries the note.
  - The tally is always recomputed from the ballots, so the vote's own winner
    needs no column.
- **Endpoint:** the winner endpoint takes `{ destinationId, override: true,
  note? }`. Without `override` it keeps today's tie-only rule.

The panel change is small (a button and a dialog) and the site change is one
banner, so no 🎨.

**Done.** "Volver a …" in the panel goes back to the vote's winner and clears
the note.

### 1.2 Paste a screenshot instead of saving it · S

In the price dialog, Ctrl/Cmd+V pastes an image from the clipboard straight
into "Leer captura". A "Pegar captura" button next to "Leer captura" does the
same where there's no keyboard.
- A pasted image goes into the section last worked in. With neither, the
  dialog asks "¿De qué es la captura que has pegado?".
- Same size and type checks as uploads.

**Done.** "Pegar captura" shows only where the browser can read the clipboard.

### 1.3 Remove the 6-digit PIN option · S

Once the organiser has reset their own PIN with a new invite (the only 6-digit
PIN in use), remove:
- "Mi PIN tiene 6 números";
- the 6-digit field length;
- their tests.

"Cambiar mi PIN" stays.

**Done.**

### 1.4 Changing a trip's dates flags its checked prices · S

**Problem.** The trip moved to 3–7 November, but prices checked for the week of
the 16th still showed as "Comprobado a mano".

**Plan.**
- When a trip's dates change (Editar in Viajes, or Generar), every price
  checked by hand or by an API is marked "de otras fechas": it shows as stale
  until re-checked.
- Flight times read from a screenshot are hidden again, since those flights
  were for other days.
- Stays keep their name and link.

**Done.** Checking the price again clears the flag.

### 1.5 A "Ver en Google Flights" link on each proposal · S

The organiser checks prices on Google Flights anyway. Each proposal gets a
Google Flights search link with the route and the trip's dates filled in, round
trip, one person, in euros (prices are per person). Two clicks, then paste the
screenshot (1.2).

**Done.** In each card in Revisar ("buscar en Google Flights") and in the price
dialog.

### 1.6 Docs match what's built · S

- The README's "State" section still says every price shows as written by
  Claude.
- SPEC §10 lists plan creation as out of scope.

Both are fixed alongside this roadmap.

**Done.**

---

## 2. Features, by user flow

The work splits into three flows. Today there is one: **Dónde**. The other two
sit before and after it, and each can be used on its own:

1. **Cuándo (when).** Agree on dates, so everyone can ask for days off.
2. **Dónde (where).** What exists today: research, check, publish, vote,
   decide. Fix 1.1 completes it.
3. **El viaje (the trip).** Once the destination is decided: real prices, how
   to get there, a guide without spoilers, all on one page for the group.

**Order:**
- Cuándo is usually first, but it's optional: a trip can start with dates the
  organiser already knows, as it does today.
- Dónde can also run before Cuándo, as happened here: destination first,
  dates moved later.
- El viaje only opens once a destination is decided.

### 2.1 Cuándo: a vote on dates · L · 🎨 · ⚙️

**Why.** On the first trip the dates changed after the destination was chosen.
People need to know early so they can ask for days off.

**Flow.**
1. **Organiser, in the panel:** "Proponer fechas" on a trip, in Viajes or when
   creating it. They pick 2–5 date windows on the calendar they already use,
   for example 3–7 Nov, 12–16 Nov and 20–24 Nov, and an optional deadline.
2. **Friends, on the site:** a new "Fechas" tab, first in the trip's menu while
   the dates are open. For each window they answer **Sí**, **Si hace falta**
   or **No**, with an optional note ("tengo que pedirlo antes del 15"). It's
   quick, like a Doodle, and it isn't ranked like the destination vote.
3. **Everyone:** sees who can go when, in a table of people by windows. The
   organiser sees it in the panel too.
4. **Organiser:** "Elegir estas fechas" sets the trip's dates, closes the date
   vote, and the tab shows the chosen dates. Prices checked for other dates
   are flagged (fix 1.4).

**Compatibility.**
- A trip without a date vote has no "Fechas" tab.
- New tables: `date_options` and `date_answers`. Existing tables are untouched.

**Screens to design.**
- Site: the "Fechas" tab, with answering and the who-can-when table, on phone
  and desktop.
- Panel: proposing windows and following the answers.

**Done** (site API 8, migration 0007), built from the existing design system
instead of new designs:
- Panel: a **Fechas** page (and a "Fechas" button on each trip in Viajes).
  Windows are picked on the same calendar as a new trip; the answers show as a
  people-by-windows table with the best windows marked, "Elegir" per window,
  and messages for proposing, reminding and announcing.
- Site: the **Fechas** tab, laid out like Votación: your answer per window on
  the left, "Quién puede cuándo" on the right (below on phones). Tus viajes
  shows "Te falta decir fechas" and "Fechas por decidir".
- Tables: `date_polls` and `date_answers` (one row per person, with their
  answers as JSON), rather than `date_options`.
- A trip that isn't published yet goes up without destinations when dates are
  proposed, so the group can answer first.

### 2.2 El viaje: the trip page · L · 🎨 · ⚙️

**Why.** After deciding, the group needs one place with the plan: where
they're going, the flights, the stay, and what to look for there.

**What it shows** (the site's trip page becomes this once a destination is
decided; the vote result stays one tap away):
- **Destination and dates**, and who's going.
- **Flights and stay**, with the prices checked by hand:
  - the flight times read from screenshots (as now);
  - the stay's name, link, address and check-in time, if the organiser adds
    them.
- **Cómo llegar:** from home to the airport, and from the airport to the stay
  (2.3).
- **The guide**, written by Claude and reviewed by the organiser. It's a
  starting push, not an itinerary:
  - **Qué hacer:** a list, each item with an approximate price.
  - **Qué comer**, and where it's typical to try it.
  - **Sitios que ver.**
  - **Antes de ir:** the country in a few lines (currency and cash, plugs,
    tipping, a few phrases, safety, transport passes, what to watch out for).
  - The tone doesn't spoil the trip: what to look for, not every detail. No
    times, no day-by-day plan.
- **Money:** each person's share of flights and stay (already worked out), and
  a link to the group's **Tricount** if there is one (see 2.4).

**Organiser flow, in the panel.**
1. **Decide** the destination (1.1).
2. **Check the prices.** If the flights or stay weren't checked by hand, the
   panel asks for it first: open the price dialog, read or paste the
   screenshots. The guide's own prices are Claude's estimates and are labelled
   as such.
3. **"Preparar el viaje"** runs Claude's research for the guide (and for 2.3).
   The organiser edits the text, removes what doesn't fit, and adds the
   address, check-in time and Tricount link.
4. **Publish.** The site shows the trip page to the trip's people.

**Compatibility.**
- The page only exists for trips with a decided destination and a published
  guide. Other trips are as today.
- The guide is a new optional part of the published snapshot. Older snapshots
  simply don't have it.

**Screens to design.**
- Site: the trip page on phone and desktop.
- Panel: the "Preparar el viaje" editor.

**Done** (site API 9; no migration: the trip page travels inside the
snapshot), built from the existing design system:
- Panel: an **El viaje** page (and "Preparar el viaje" from Votación once the
  destination is decided). A checklist (destination, checked prices with the
  price dialog, guide, published), "Preparar con Claude" with its steps live,
  an editor for every section, and "Publicar el viaje" / "Retirar del sitio".
- Site: an **El viaje** tab, first once published, laid out like a
  destination page: flights and stay with the checked prices, the stay's
  address and times, Cómo llegar, Qué hacer, Qué comer, Sitios que ver,
  Antes de ir, who's going, and the guide labelled as Claude's with its
  sources. Destinos and Tus viajes point to it.
- Research: `guide` on both providers (the `claude` command and the API),
  same tools and rules as research.

### 2.3 Cómo llegar: to the airport and from it · L · 🎨 (part of 2.2's screens) · ⚙️ (for phase 2)

**Why.** The group lives in Logroño. Flying from Bilbao or Madrid means a car,
bus or train first, and that time and money matter. At the other end, someone
has to work out how to get from the airport to the stay.

**Setting.** "Salimos desde" in the group's settings: the home town (Logroño),
separate from the departure airport. Each group sets its own; nothing is
specific to Logroño.

**What research returns, per option:**
- **Car:** kilometres and time, fuel per person for a given number of cars
  (using an average consumption and the current fuel price), tolls, and
  parking at the airport for the trip's days, with where to park.
- **Bus and train:** operator, typical departures on the trip's days, time and
  price per person, and where it stops relative to the terminal.
- **At the destination, airport to stay:** metro, bus, train, taxi or shuttle,
  with time and price, and which is best for a group with luggage.
- **Sources** cited, as with research today. Timetables and fuel prices change,
  so they're labelled as estimates to confirm.

**Two phases.**
- **Phase 1, in El viaje (2.2):** "Cómo llegar" is researched for the chosen
  destination only and appears on the trip page. This covers the real need
  with no changes to Dónde.
- **Phase 2, in Dónde:** the cost of getting to each departure airport goes
  into the comparison. "Madrid is 40 € cheaper to fly from but 35 € more to
  reach" changes which option wins. This touches research, Comparativa and the
  per-person total the group votes on, so it waits until phase 1 has been used
  on a real trip.

**Phase 1 done**, as part of El viaje: "Salís desde" is asked when preparing
and kept as the group's `homeTown` setting for next time.

### 2.4 Money: link Tricount, don't rebuild it · S

**Why not build it.** The group already splits costs in Tricount without
problems. Rebuilding expense tracking is a lot of work for something that
already works.

**Instead:**
- An optional "Enlace del Tricount" on the trip, shown on the trip page (2.2).
- The per-person shares Wanderlot already knows (flight, stay) are listed
  there, ready to enter in Tricount.

**Done:** "Lo que pone cada uno" at the top of the trip page, with "Abrir el
Tricount".

### 2.5 Export the group's data · S–M

**Where things live.** The shared data is in the site's database on
Cloudflare:
- members and who's on each trip;
- published trips and their destinations;
- ballots, results, comments, likes and ideas.

The panel keeps a local file (`data/panel.json` on the organiser's computer)
with:
- proposals that were never published;
- Comparativa notes and photo searches;
- invite links;
- what was last published.

**Plan.**
- **"Exportar" in the panel's Viajes page** downloads one JSON file with what's
  on the site, for one trip or all of them:
  - settings and members;
  - published trips with their destinations and photos;
  - ballots and results;
  - comments with likes;
  - ideas;
  - who's on each trip.
- **What it leaves out:** PIN hashes, passkeys, sessions and invite tokens, and
  the panel's unpublished research.
- **Site:** `GET /api/admin/export` behind the admin token. ⚙️
- **Later, if wanted:** importing a file into a new site, and a backup of the
  panel's file.

**Done.** "Exportar" on each published trip and "Exportar todo" in Viajes.

---

### 2.6 Días libres: everyone has the days off before booking · M · ⚙️

**Why.** Everyone in the group works somewhere different. Once the dates are
decided, each person has to ask for the days off, and nobody should book
anything until they all have them. On the first trip this was tracked in the
group chat.

**Done.**
- Once the dates are decided (chosen in a date vote, or fixed in the panel),
  the site shows a "Días libres" card on the trip, in Fechas and in El viaje.
  Each person marks: not asked yet, asked, approved or not given. Everyone
  sees where the rest are.
- The panel shows the same in Fechas. The organiser can mark it for someone,
  and gets a message for the chat naming whoever hasn't confirmed. El viaje
  has a step for it before the prices.
- An answer is for the dates it was given for: change the dates and everyone
  is asked again.
- Fixing the dates in the panel now sends them to the site at once, without
  publishing the rest. Site API version 13.

---

## 3. The panel from anywhere, with any AI (or none)

**Why.** Today the panel only runs on the organiser's laptop:
- it accepts requests to `127.0.0.1` only;
- it keeps its data in `data/panel.json`;
- its AI is the `claude` command or an Anthropic API key.

The organiser wants to manage the group from their phone: add or remove
people, make invite links, rename a trip, change photos. That should work
without any AI, and research should work with other assistants: Codex,
OpenCode (its Zen plan) or any provider with an API key.

This is a platform change, so it goes in three phases. Each one is useful on
its own.

### 3.1 Manage from the phone: the panel on the site, without AI · L · 🎨 · ⚙️

**What.** The panel's management pages, served by the site under `/admin`:
- **Viajes:** rename, change dates, delete, export.
- **Personas:** add, remove, invite links, close sessions.
- **Votación:** open, remind, close, decide.
- **Photos** of published destinations: Wikimedia needs no key; Unsplash and
  Pexels need their keys as Worker secrets.

Pages that need AI (Generar, reading screenshots, the guide) show why they're
off and what would turn them on.

**Signing in.**
- The organiser signs in to the site as usual. Their member account carries an
  organiser role, set once from the local panel or with `npm run setup`.
- Admin actions then use their session instead of the admin token, which never
  reaches a browser.
- A 4-digit PIN is too weak to guard the whole group, so the organiser signs
  in to `/admin` with a passkey (Face ID or a fingerprint) or a longer
  password, and admin sessions expire sooner.

**The catch: one source of truth.** The local panel keeps its own copy of
every trip in `data/panel.json` and publishes it over the site. If the phone
changes a photo and the laptop publishes later, the laptop's copy wins and the
change is lost. So 3.1 needs 3.2, or at least a rule that the local panel
first reads back what's on the site.

**Screens to design.**
- The admin sign-in.
- The panel's pages at phone width, where they don't fit today.
- The "AI is off" states.

**Done** (site API 10, migration 0008), with the existing design system:
- The site serves the panel at `/admin`: every page, on the same data as the
  laptop. Generar, reading screenshots and "Preparar con Claude" say to use
  the laptop.
- Signing in is a password (10+ characters) set from the laptop's Personas,
  "Panel en el móvil", with the PIN's lockouts and an organiser session only
  `/admin` gets. A passkey for the organiser can come later.
- Photos search Wikimedia; Unsplash and Pexels stay on the laptop for now.

### 3.2 One store: the panel's data moves to the site · L · ⚙️

**What moves.** Everything the panel keeps in `data/panel.json` moves to the
site's database, in new tables:
- proposals, including unpublished ones;
- Comparativa notes and photo searches;
- the last publish;
- invite links.

**The local panel changes role.** It becomes the same panel, pointed at the
site, and adds only what needs the laptop: running `claude`, `codex` or
`opencode`. Research started from the laptop saves its proposals on the site,
so the phone sees them straight away.

**Compatibility.**
- On first start, the new local panel imports the existing
  `data/panel.json` into the site and keeps the file as a backup.
- Nothing already published changes.
- A group that never hosts the panel keeps working as today, with its data on
  the site.

**Also:**
- Unpublished research is never visible to friends; it sits behind the
  organiser role.
- The export (2.5) gains an option to include it.

**Done**, with 3.1:
- One JSON entry per trip in `panel_plans`, versioned: a save that raced
  another device is refused and the page asks to reload.
- Invite links are sealed with a key from the admin token.
- The local panel moves `data/panel.json` to the site on first start and keeps
  it as `panel.json.moved-to-site`; with an older site it keeps using the file.
- Not yet: the export's option to include unpublished research.

### 3.3 Bring your own AI · M

**The idea.** Research, screenshot reading and the guide go through one
`ResearchProvider` interface today, with two implementations (the `claude`
command and the Anthropic API). Add more, chosen in a new panel settings page
(🎨, small):

- **Local commands,** for the local panel only: `claude` (today), plus
  `codex` and `opencode` through their non-interactive modes. Before building
  each, check that it can:
  - search the web;
  - return JSON matching a schema;
  - read an image file.
- **API keys,** for the local or hosted panel:
  - Anthropic (today);
  - OpenAI;
  - any OpenAI-compatible endpoint, set by base URL, key and model name. That
    covers OpenRouter and similar gateways, and possibly OpenCode Zen's key;
    that needs checking against its docs.

**Where the keys live.**
- The hosted panel keeps them as Worker secrets, set with `wrangler secret`
  or `npm run setup`, never in the browser.
- The local panel keeps them in `.env`, as now.

**What each feature needs, and what happens without it.**

| Feature | Needs | Without it |
|---|---|---|
| Generar | web search and structured output | Off. Proposals can still be added by hand (a small form: place, flights, stay, prices), useful with no AI at all |
| Reading screenshots | image input | The price dialog works as before, typing the prices |
| The trip guide (2.2) | web search helps, but a model can write it from what it knows | Off, or written from the model's knowledge and labelled so |

Where a provider has no web search, research falls back to what the model
knows, and every price is marked as an estimate. That's weaker than today, and
the panel says so when the provider is chosen.

**Limits to check** before promising research on the hosted panel:
- A Worker can call these APIs, but research runs for minutes.
- It may need to run in the background (a Queue or a Durable Object) and
  report progress, instead of streaming over one long request.

**First part done** (site API 11; no migration), with the existing design
system:
- **Ajustes**, a new page in the panel's top bar: the AIs set up, what each
  can do (web search, screenshots), which one is in use, and for the others
  where their keys go. The laptop's choice is kept in `.env`.
- **OpenAI** (Responses API with web search, streamed) and **any
  OpenAI-compatible endpoint** (chat completions, no web search), in plain
  `fetch` so they also run on the Worker. The compatible one's research and
  guide are estimates: no sources, "Estimado por …" on the site.
- Research names its AI: "Lo escribió OpenAI" on the site, and the panel's
  screens say which AI is working.
- **Añadir a mano** in Revisar: city, country, airport, type, and the flight
  and stay prices seen. It goes in approved and "Comprobado a mano", with no
  flight times until the price dialog adds them.
- **The panel at `/admin` reads screenshots** with a key shared from the
  laptop (`npm run setup` asks; `npm run deploy:site` stores it as Worker
  secrets).

**Second part done** (site API 12; no migration): **the panel at `/admin`
searches and prepares the guide** in the background, on the AI's own
servers: a Message Batch with Claude's API, background mode with OpenAI's.
Starting one returns at once; the job is kept with the trip, so the phone
can be closed and the laptop sees it too, and each check is a few quick
requests, within a Worker's limits on the free plan. What it finds is saved
as a streamed search would save it. OpenAI-compatible endpoints can't run in
the background, so there they still search from the laptop.

- Not yet: `codex` and `opencode` as local commands (each needs checking
  first).

---

### 3.4 Check the finalists in the browser · M

**Why.** Research's prices are estimates, and checking the finalists by hand
means opening Google Flights and Airbnb, taking screenshots and reading them
in. The browser can do the opening and reading, with the organiser watching.

**Done:** "Comprobar vuelos" on approved proposals: on each card in
Revisar, for all of them at once, and in El viaje. The `claude` command drives
a visible window of the organiser's browser (Chrome, Brave, Edge or Chromium,
found on the laptop and picked in Ajustes) through Playwright MCP. It brings
back the 5 best round trips from Google Flights, each followed to the booking
page for its real price, to pick one. The site shows "Visto en Google
Flights". Airbnb was tried too but couldn't be read reliably, so the stay is
checked by hand: the price dialog links to the Airbnb search (or the chosen
listing) with the trip's dates and people. A browser that can't open says
why instead of "no vi el precio". See SPEC §8 for what the
run may do. Not on the site's panel (there's no browser there), and never for
a whole search: Google doesn't allow automated access, so this stays a few
pages checked at the organiser's request.

---

## 4. Later

Not planned in detail yet. They wait until the flows above are in use.

- **Other languages, English first.**
  - Every UI string is Spanish today, in the components, the site and the
    panel.
  - Needs a message catalogue per language and a language setting for the
    group, with Spanish as the default so nothing changes for current groups.
  - Research prompts and the guide must also be written in the group's
    language.
- **Currency and locale.**
  - Prices are euros everywhere (cents, `euros()` formatting).
  - A group setting for its currency, with number and date formats to match.
  - Research and screenshot reading must convert or refuse other currencies
    consistently.
  - Existing data stays in euros.
- **Already out of scope in SPEC §10:**
  - email or push notifications;
  - booking inside the app;
  - several groups per deployment.

---

## Suggested order

1. ~~**Fixes 1.1–1.6.** Small, and they close the gaps the first trip hit. 1.1
   and the export (2.5) change the site, so they go out in one deploy.~~ Done.
2. ~~**Cuándo (2.1).** The next trip needs dates agreed early. Design first.~~
   Done, with the existing design system.
3. ~~**El viaje (2.2) with Cómo llegar phase 1 (2.3) and the Tricount link
   (2.4).** One design for the trip page, built together.~~ Done, with the
   existing design system.
4. **The panel from anywhere.**
   - ~~**3.2 (one store) before 3.1 (hosted management).** Otherwise phone and
     laptop overwrite each other.~~ Done, together.
   - ~~**3.3 (other AIs).**~~ Done: Ajustes, OpenAI and compatible
     endpoints, adding by hand, and searching from `/admin` in the
     background. Left: `codex` and `opencode` as local commands.
5. **Cómo llegar phase 2 (2.3)**, after a real trip with phase 1.
6. **Later:** languages and currency.
