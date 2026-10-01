// The local panel's API: Generar, Revisar y aprobar, Comparativa, publish.
// Served on 127.0.0.1 only (see server.ts).
import { Hono, type Context } from "hono";
import { stream } from "hono/streaming";
import { z } from "zod";
import { LeaveStatus, googleFlightsUrl, Category, DateWindows, FlightLeg, GroupSettings, Photo, Place, Plan, SITE_API_VERSION, TripPage, baseStay, addDaysIso, answeredAll, applyCheckedPrices, markForOtherDates, nightsOf, slugify, type DatesView, type LeaveView, type Proposal, type VoteState } from "@wanderlot/core";
import { extractedFields } from "./providers/extract.ts";
import { browsedFields, type Browsed, type BrowseRequest } from "./providers/browse.ts";
import { GuideEstimate, GuideOutput, toTripPage } from "./providers/guide.ts";
import { AI_IDS, AiChoice, type AiId, type AiView } from "./providers/ai.ts";
import type { BackgroundTask, FlightProvider, ResearchProgress, ResearchProvider, ResearchResult, SearchRequest } from "./providers/types.ts";
import type { GuideRequest } from "./providers/guide.ts";
import { EstimateOutput, ResearchOutput, toResults, type Researcher } from "./providers/research.ts";
import { searchAll, type PhotoSource } from "./providers/photos.ts";
import { localOnly } from "./guard.ts";
import type { BrowserChoice } from "./browsers.ts";

import { SiteError, buildSnapshot, publishWarnings, shellSnapshot, snapshotFingerprint, type MemberStatus, type SiteClient } from "./publish.ts";
import { StoreConflict, type PanelJob, type PanelStore, type PlanEntry } from "./store.ts";
import { datesChosenMessage, datesOpenedMessage, datesReminderMessage, leaveReminderMessage, inviteUrl, voteClosedMessage, voteOpenedMessage, voteReminderMessage, type PendingInvite } from "./announce.ts";

// What this computer can do, found at startup (SPEC §8).
export interface PanelStatus {
  // The AI in use (ROADMAP 3.3), and what it can do.
  research: AiId | "none";
  ai?: { name: string; search: boolean; images: boolean; background: boolean };
  flights: "duffel" | "none";
  photos: ("wikimedia" | "unsplash" | "pexels")[];
  // The panel served by the site at /admin (ROADMAP 3.1). Its AI reads
  // screenshots, and searches in the background (3.3).
  hosted?: boolean;
  // "Comprobar vuelos" works here (ROADMAP 3.4), in which browser, or what
  // it lacks: the claude command, the Playwright package (npm install), or a
  // Chromium browser (Chrome, Brave, Edge).
  browse?: boolean;
  browser?: string;
  browseMissing?: "claude" | "install" | "browser";
  // Where trips are kept: the site's database, or (with a site too old for
  // that) the laptop's data/panel.json.
  store?: "site" | "file";
}

export interface PanelOptions {
  store: PanelStore;
  status?: PanelStatus;
  flights: FlightProvider;
  // The AI, fixed (tests), or chosen among those set up (ROADMAP 3.3).
  research?: ResearchProvider;
  // "Mirar en Google Flights / Airbnb" for the finalists: the `claude`
  // command driving a browser on this laptop (ROADMAP 3.4).
  browse?: ResearchProvider["browse"];
  // The browsers it can open, and the one in use (Ajustes).
  browsers?: BrowserChoice;
  ai?: AiChoice;
  photos?: PhotoSource[];
  site: SiteClient;
  // Host:port values the panel answers to (see guard.ts); unset in tests.
  hosts?: string[];
  siteUrl: string;
  now?: () => Date;
}

const CheckedLeg = FlightLeg.omit({ priceCents: true });
const PricesBody = z.object({
  flightCents: z.number().int().min(0).max(10_000_000),
  stayCents: z.number().int().min(0).max(100_000_000).optional(),
  // Read from a screenshot and reviewed: the flights' real times, together.
  outbound: CheckedLeg.optional(),
  inbound: CheckedLeg.optional(),
  stay: z
    .object({
      name: z.string().trim().min(1).max(120),
      description: z.string().trim().max(200).optional(),
      url: z.url({ protocol: /^https$/ }).optional(),
    })
    .optional(),
  // Read off these sites in the browser ("Mirar en…"), and the pages.
  seenOn: z.array(z.enum(["google-flights", "airbnb"])).max(2).optional(),
  sources: z.array(z.object({ label: z.string().trim().min(1).max(60), url: z.url({ protocol: /^https$/ }) })).max(4).optional(),
});

// Screenshots for "Leer captura": up to 4 images, each under ~5 MB.
const ExtractBody = z.object({
  kind: z.enum(["flight", "stay"]),
  images: z
    .array(z.object({ mediaType: z.enum(["image/png", "image/jpeg", "image/webp", "image/gif"]), data: z.string().min(1).max(7_000_000) }))
    .min(1)
    .max(4),
});

const GenerateBody = z.object({
  source: z.enum(["api", "claude"]),
  scope: z.discriminatedUnion("kind", [
    z.object({ kind: z.literal("anywhere") }),
    z.object({ kind: z.literal("europe") }),
    z.object({ kind: z.literal("place"), iata: z.string().regex(/^[A-Z]{3}$/) }),
    z.object({ kind: z.literal("named"), name: z.string().trim().min(1).max(80) }),
  ]),
  // Research a friend's suggestion (scope "named"): credited and marked done.
  suggestionId: z.string().min(1).max(80).optional(),
  stops: z.enum(["direct", "one", "any"]),
  estimateStays: z.boolean(),
  suggestThings: z.boolean(),
  nearbyAirports: z.boolean().default(false),
  count: z.number().int().min(1).max(24).default(12),
});

const EditorialBody = z
  .object({
    pros: z.array(z.string()),
    cons: z.array(z.string()),
    weather: z.string(),
    photos: z.array(Photo),
    inVote: z.boolean(),
  })
  .partial();

const NewPlan = z.object({
  name: z.string().trim().min(1).max(60),
  origin: z.string().regex(/^[A-Z]{3}$/),
  dateFrom: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  nights: z.number().int().min(1).max(30),
  flexDays: z.union([z.literal(0), z.literal(1), z.literal(2)]),
  partySize: z.number().int().min(1).max(30),
  maxPriceCents: z.number().int().positive().nullable(),
  participants: z.array(z.string().min(1)).max(100).default([]),
});

// "Añadir a mano" (ROADMAP 3.3): a destination the organiser found
// themselves, with the prices they saw. No AI needed.
const ManualBody = PricesBody.extend({
  place: Place,
  category: Category,
});

// Adds research's results to a trip, as pending: a new search never replaces
// a proposal the organiser may already have approved, so each gets an unused
// id. Research's notes seed Comparativa; the organiser's edits win.
function withResearched(entry: PlanEntry, results: ResearchResult[], suggestedBy?: string): { entry: PlanEntry; added: Proposal[] } {
  let proposals = entry.proposals;
  let editorial = entry.editorial;
  const added: Proposal[] = [];
  for (const { proposal: p, notes } of results) {
    const taken = new Set(proposals.map((x) => x.id));
    const base = p.id.replace(/-\d+$/, "") || "propuesta";
    let id = base;
    for (let n = 2; taken.has(id); n++) id = `${base}-${n}`;
    const proposal: Proposal = { ...p, id, review: "pending", ...(suggestedBy ? { suggestedBy } : {}) };
    if (notes) {
      const prev = editorial[id] ?? {};
      editorial = {
        ...editorial,
        [id]: { pros: notes.pros, cons: notes.cons, weather: notes.weather, ...prev, photoQueries: notes.photoSubjects.length ? notes.photoSubjects : (prev.photoQueries ?? []) },
      };
    }
    proposals = [...proposals, proposal];
    added.push(proposal);
  }
  return { entry: { ...entry, proposals, editorial }, added };
}

// What the guide is asked about the decided destination.
function guideRequest(entry: PlanEntry, destination: Proposal, home: string): GuideRequest {
  const stay = baseStay(destination.stays);
  const { plan } = entry;
  return {
    city: destination.place.city,
    country: destination.place.country,
    iata: destination.place.iata,
    origin: destination.outbound.from,
    home,
    dateFrom: plan.dateFrom,
    dateTo: plan.dateTo,
    nights: plan.nights,
    partySize: plan.partySize,
    ...(stay ? { stay: { name: stay.name, ...(stay.description ? { description: stay.description } : {}), ...(stay.url ? { url: stay.url } : {}) } } : {}),
  };
}

// What went wrong, in words: a schema check that failed says so plainly
// instead of dumping its issues on the organiser.
export function humanError(err: unknown): string {
  if (err instanceof z.ZodError) return "La respuesta de la IA no venía como se esperaba. Vuelve a probar; si se repite, hazlo a mano.";
  return err instanceof Error ? err.message : String(err);
}

async function* fromFlights(it: AsyncIterable<Omit<Proposal, "review">>): AsyncIterable<ResearchResult> {
  for await (const proposal of it) yield { proposal };
}

export function createPanel({
  store,
  flights,
  research,
  ai: aiChoice,
  browse,
  browsers,
  photos = [],
  hosts,
  site,
  siteUrl,
  now = () => new Date(),
  status = { research: "none", flights: "none", photos: ["wikimedia"] },
}: PanelOptions) {
  const app = new Hono();
  if (hosts) app.use("*", localOnly(hosts));
  // The panel is local, so the organiser may see what went wrong. A refusal
  // from the site keeps its status and its (Spanish) reason.
  app.onError((err, c) => {
    if (err instanceof SiteError && err.status >= 400 && err.status < 500) return c.json({ error: err.reason }, err.status as 409);
    return c.json({ error: humanError(err) }, 500);
  });

  const entryOr404 = (planId: string) => store.get(planId);

  // The AI in use now: the one chosen in Ajustes, or the one given.
  const currentAi = (): ResearchProvider | null => (aiChoice ? aiChoice.provider() : (research ?? null));
  const browsing = (): Partial<PanelStatus> => (browse ? { browse: true, ...(browsers?.chosen ? { browser: browsers.chosen.name } : {}) } : {});
  const statusNow = (): PanelStatus => {
    if (!aiChoice) return { ...status, ...browsing() };
    const a = aiChoice.active?.option;
    const { ai: _was, ...rest } = status;
    // As the screens say it: "Preparar con Claude", "OpenAI está buscando".
    const name = a?.id === "claude-cli" || a?.id === "anthropic-api" ? "Claude" : a?.name;
    return { ...rest, ...browsing(), research: a?.id ?? "none", ...(a && name ? { ai: { name, search: a.search, images: a.images, background: a.background } } : {}) };
  };
  // The panel at /admin searches in the background, which needs an AI that
  // can (ROADMAP 3.3).
  const hostedSearch = () =>
    statusNow().research === "none"
      ? "Para buscar desde el panel del sitio hace falta una clave de Claude (API de Anthropic) u OpenAI en el sitio: mira en Ajustes, o busca desde el panel de tu ordenador."
      : `${statusNow().ai?.name ?? "Esta IA"} no puede buscar en segundo plano, que es como busca el panel del sitio: usa Claude (API de Anthropic) u OpenAI, o busca desde el panel de tu ordenador.`;

  // The trip page from the guide research wrote; keeps the organiser's stay
  // details and Tricount. Remembers where the group lives, best effort.
  const saveGuide = async (planId: string, destinationId: string, home: string, raw: unknown, who: Researcher): Promise<TripPage> => {
    const out = (who.estimate ? GuideEstimate : GuideOutput).parse(raw);
    const previous = store.get(planId)!.trip;
    const trip = TripPage.parse(toTripPage(destinationId, home, out, now(), previous?.destinationId === destinationId ? previous : undefined, who.by));
    store.update(planId, (e) => ({ entry: { ...e!, trip }, result: null }));
    if (home) {
      const settings = await site.settings().catch(() => null);
      if (settings && settings.homeTown !== home) await site.putSettings({ ...settings, homeTown: home }).catch(() => {});
    }
    return trip;
  };

  // Hands a search or guide to the AI to run in the background: answers at
  // once (202) with the job, which GET …/job then follows.
  const startJob = async (c: Context, planId: string, task: BackgroundTask, extra: Pick<PanelJob, "idea" | "destinationId"> = {}) => {
    const ai = currentAi();
    const active = aiChoice?.active?.option;
    if (!ai?.background || !active) return c.json({ error: hostedSearch() }, 409);
    if (store.get(planId)!.job?.status === "running") return c.json({ error: "Ya hay una búsqueda en marcha en este viaje: espera a que termine o cancélala." }, 409);
    const externalId = await ai.background.start(task);
    const job: PanelJob = { kind: task.kind, ai: active.id, aiName: statusNow().ai?.name ?? active.name, externalId, task, startedAt: now().toISOString(), status: "running", ...extra };
    store.update(planId, (e) => ({ entry: { ...e!, job }, result: null }));
    return c.json({ job }, 202);
  };

  // Asks the AI how a running job is doing and, once it's done, saves what
  // it found. A failed check leaves the job running, to try again.
  const advanceJob = async (planId: string) => {
    const job = store.get(planId)?.job;
    const ai = currentAi();
    if (!job || job.status !== "running" || !ai?.background) return;
    const check = await ai.background.check(job.externalId, job.task).catch(() => null);
    if (!check) return;
    const finish = (patch: Partial<PanelJob>) =>
      store.update(planId, (e) => ({ entry: { ...e!, job: { ...job, ...patch, finishedAt: now().toISOString() } }, result: null }));
    if (check.state === "running") {
      if (check.id) store.update(planId, (e) => ({ entry: { ...e!, job: { ...job, externalId: check.id! } }, result: null }));
      return;
    }
    if (check.state === "failed") return void finish({ status: "failed", error: check.error });
    const who = ai.who ?? {};
    if (job.task.kind === "research") {
      const out = (who.estimate ? EstimateOutput : ResearchOutput).safeParse(check.raw);
      if (!out.success) return void finish({ status: "failed", error: `${job.aiName} respondió con datos que no encajan; vuelve a probar` });
      const results = toResults(job.task.req, out.data, who);
      const added = store.update(planId, (e) => {
        const r = withResearched(e!, results, job.idea?.by);
        return { entry: { ...r.entry, job: { ...job, status: "done" as const, added: r.added.length, finishedAt: now().toISOString() } }, result: r.added };
      });
      if (job.idea && added[0]) await site.setSuggestion(planId, job.idea.id, "researched", added[0].id).catch(() => {});
      return;
    }
    if (!job.destinationId || decided(planId)?.id !== job.destinationId) return void finish({ status: "failed", error: "El destino del viaje cambió mientras se preparaba la guía" });
    try {
      await saveGuide(planId, job.destinationId, job.task.req.home, check.raw, who);
      finish({ status: "done" });
    } catch {
      finish({ status: "failed", error: `${job.aiName} respondió con datos que no encajan; vuelve a probar` });
    }
  };

  // Every request starts from what's saved now, so this device sees what
  // another one changed, and ends once its own changes are saved.
  app.use("/api/*", async (c, next) => {
    try {
      await store.refresh();
    } catch (e) {
      // Status still answers: it's how the UI learns the site is down.
      if (c.req.path !== "/api/status" && !c.req.path.endsWith("/api/status")) throw new Error(`No se pudieron leer los viajes del sitio: ${(e as Error).message}`);
    }
    await next();
    try {
      await store.flush();
    } catch (e) {
      if (e instanceof StoreConflict) c.res = c.json({ error: e.message }, 409);
      else throw e;
    }
  });

  // What's configured here, and whether the site answers as admin.
  app.get("/api/status", async (c) => {
    let reachable = true;
    let error: string | undefined;
    let outdated = false;
    try {
      await site.settings();
      // A site deployed from older code lacks routes this panel uses.
      outdated = (await site.version()) < SITE_API_VERSION;
    } catch (e) {
      reachable = false;
      error = (e as Error).message;
    }
    return c.json({ ...statusNow(), site: { url: siteUrl, reachable, outdated, ...(error ? { error } : {}) } });
  });

  // Ajustes: the AIs set up here, and which one is in use (ROADMAP 3.3).
  app.get("/api/ai", (c) => {
    const s = statusNow();
    const view: AiView = aiChoice?.view() ?? { options: [], active: s.research === "none" ? null : s.research, canChoose: false };
    return c.json(view);
  });

  app.put("/api/ai", async (c) => {
    const body = z.object({ id: z.enum(AI_IDS) }).safeParse(await c.req.json().catch(() => null));
    if (!body.success) return c.json({ error: "expected {id}" }, 400);
    if (!aiChoice) return c.json({ error: "Aquí no se puede cambiar la IA" }, 409);
    try {
      aiChoice.choose(body.data.id);
    } catch (e) {
      return c.json({ error: (e as Error).message }, 409);
    }
    return c.json(aiChoice.view());
  });

  // Ajustes: the browsers "Comprobar vuelos" can open here, and which one.
  app.get("/api/browser", (c) => c.json(browsers?.view() ?? { options: [], active: null }));

  app.put("/api/browser", async (c) => {
    const body = z.object({ id: z.string().min(1).max(20) }).safeParse(await c.req.json().catch(() => null));
    if (!body.success) return c.json({ error: "expected {id}" }, 400);
    if (!browsers) return c.json({ error: "Aquí no se puede elegir navegador" }, 409);
    try {
      browsers.choose(body.data.id);
    } catch (e) {
      return c.json({ error: (e as Error).message }, 409);
    }
    return c.json(browsers.view());
  });

  app.get("/api/settings", async (c) => c.json(await site.settings()));

  // The panel on the site (ROADMAP 3.1): whether it's on, and its password.
  app.get("/api/organiser", async (c) => c.json({ ...(await site.organiser()), url: new URL("/admin/", siteUrl).toString() }));

  app.put("/api/organiser", async (c) => {
    const body = z.object({ password: z.string().min(10, "Usa al menos 10 caracteres").max(200).nullable() }).safeParse(await c.req.json().catch(() => null));
    if (!body.success) return c.json({ error: body.error.issues[0]?.message ?? "expected {password}" }, 400);
    if ((await site.version()) < 10) {
      return c.json({ error: "Tu sitio tiene una versión anterior al panel y no sabe servir el panel. Actualízalo con npm run deploy:site y vuelve a probar." }, 409);
    }
    return c.json({ ...(await site.setOrganiserPassword(body.data.password)), url: new URL("/admin/", siteUrl).toString() });
  });

  app.put("/api/settings", async (c) => {
    const body = GroupSettings.safeParse(await c.req.json().catch(() => null));
    if (!body.success) return c.json({ error: "invalid settings", issues: body.error.issues }, 400);
    return c.json(await site.putSettings(body.data));
  });

  // Newest first.
  app.get("/api/plans", (c) => c.json([...store.list()].reverse()));

  // The trips page: each trip with how far along it is.
  app.get("/api/trips", (c) =>
    c.json(
      [...store.list()].reverse().map((plan) => {
        const entry = store.get(plan.id)!;
        const count = (r: Proposal["review"]) => entry.proposals.filter((p) => p.review === r).length;
        return {
          plan,
          proposals: entry.proposals.length,
          approved: count("approved"),
          pending: count("pending"),
          participants: entry.participants?.length ?? 0,
          publishedAt: entry.published?.at ?? null,
          changed: entry.published ? entry.published.fingerprint !== snapshotFingerprint(entry) : count("approved") > 0,
        };
      }),
    ),
  );

  // Deleting a trip removes it here and on the site, with its votes and
  // comments there. An older site can't delete, so nothing is touched.
  app.delete("/api/plans/:planId", async (c) => {
    const planId = c.req.param("planId");
    if (!store.get(planId)) return c.json({ error: "not found" }, 404);
    if ((await site.version()) < 6) {
      return c.json({ error: "Tu sitio tiene una versión anterior al panel y no sabe borrar viajes. Actualízalo con npm run deploy:site y vuelve a probar." }, 409);
    }
    await site.deletePlan(planId);
    store.remove(planId);
    return c.json({ ok: true });
  });

  // What the group made on the site (votes, comments, ideas), as JSON to keep.
  // Research and drafts stay in the panel's own store.
  app.get("/api/export", async (c) => {
    if ((await site.version()) < 7) {
      return c.json({ error: "Tu sitio tiene una versión anterior al panel y no sabe exportar. Actualízalo con npm run deploy:site y vuelve a probar." }, 409);
    }
    const planId = c.req.query("plan");
    return c.json(await site.exportData(planId || undefined));
  });

  // A new trip window, as a draft (SPEC §1).
  app.post("/api/plans", async (c) => {
    const body = NewPlan.safeParse(await c.req.json().catch(() => null));
    if (!body.success) return c.json({ error: "invalid plan", issues: body.error.issues }, 400);
    const base = slugify(body.data.name) || "plan";
    let id = base;
    for (let n = 2; store.get(id); n++) id = `${base}-${n}`;
    const { participants, ...fields } = body.data;
    const plan: Plan = { ...fields, id, dateTo: addDaysIso(fields.dateFrom, fields.nights), status: "draft" };
    store.update(id, () => ({ entry: { plan, proposals: [], editorial: {}, participants }, result: null }));
    // Best effort: publishing and opening the vote send it again anyway.
    if (participants.length) await site.setPlanMembers(id, participants).catch(() => {});
    return c.json(plan, 201);
  });

  app.get("/api/plans/:planId", (c) => {
    const entry = entryOr404(c.req.param("planId"));
    return entry ? c.json(entry) : c.json({ error: "not found" }, 404);
  });

  app.put("/api/plans/:planId", async (c) => {
    const parsed = Plan.safeParse({ ...(await c.req.json()), id: c.req.param("planId") });
    if (!parsed.success) return c.json({ error: "invalid plan", issues: parsed.error.issues }, 400);
    const plan = parsed.data;
    store.update(plan.id, (e) => {
      // New dates: prices checked for the old ones no longer hold (ROADMAP 1.4).
      const moved = e && (e.plan.dateFrom !== plan.dateFrom || e.plan.dateTo !== plan.dateTo);
      const proposals = moved ? e.proposals.map(markForOtherDates) : (e?.proposals ?? []);
      return { entry: { editorial: {}, ...e, proposals, plan }, result: null };
    });
    return c.json(plan);
  });

  // Who goes: saved here and on the site, which shows the trip only to them.
  app.put("/api/plans/:planId/participants", async (c) => {
    const planId = c.req.param("planId");
    if (!store.get(planId)) return c.json({ error: "not found" }, 404);
    const body = z.array(z.string().min(1)).max(100).safeParse(await c.req.json().catch(() => null));
    if (!body.success) return c.json({ error: "expected [memberId]" }, 400);
    const participants = [...new Set(body.data)];
    await site.setPlanMembers(planId, participants);
    store.update(planId, (e) => ({
      entry: { ...e!, participants, plan: { ...e!.plan, partySize: Math.max(1, participants.length) } },
      result: null,
    }));
    return c.json(store.get(planId));
  });

  // Generar: streams proposals as NDJSON as they resolve; each is stored as pending.
  app.post("/api/plans/:planId/generate", async (c) => {
    const entry = entryOr404(c.req.param("planId"));
    if (!entry) return c.json({ error: "not found" }, 404);
    const body = GenerateBody.safeParse(await c.req.json());
    if (!body.success) return c.json({ error: "invalid request", issues: body.error.issues }, 400);
    const { plan } = entry;
    // A friend's idea: research exactly that place, crediting them.
    const { suggestionId, ...options } = body.data;
    const idea = suggestionId ? (await site.suggestions(plan.id)).find((x) => x.id === suggestionId) : undefined;
    if (suggestionId && !idea) return c.json({ error: "esa idea ya no está" }, 404);
    const req: SearchRequest = {
      ...options,
      ...(idea
        ? { scope: { kind: "named" as const, name: idea.place, by: idea.member.name, ...(idea.note ? { note: idea.note } : {}) } }
        : options.scope.kind === "named"
          ? {}
          : // What's already on the list, so a new search looks elsewhere.
            { exclude: [...new Set(entry.proposals.map((p) => `${p.place.city} (${p.place.iata})`))] }),
      planId: plan.id,
      origin: plan.origin,
      dateFrom: plan.dateFrom,
      nights: plan.nights,
      flexDays: plan.flexDays,
      partySize: plan.partySize,
      maxPriceCents: plan.maxPriceCents,
    };
    if (body.data.source === "api" && status.flights === "none") {
      return c.json({ error: "No hay ninguna API de vuelos conectada. Busca con Claude, o añade la clave con npm run setup." }, 409);
    }
    const ai = currentAi();
    if (body.data.source === "claude") {
      // On the site, handed to the AI to run in the background.
      if (status.hosted) return startJob(c, plan.id, { kind: "research", req }, idea ? { idea: { id: idea.id, by: idea.member.name } } : {});
      if (!ai) return c.json({ error: "No hay ninguna IA configurada: mira en Ajustes cómo añadir una." }, 409);
    }
    // Research's steps, relayed as they happen for Generar's live view.
    const progress: ResearchProgress[] = [];
    let relay: ((p: ResearchProgress) => void) | undefined;
    const onProgress = (p: ResearchProgress) => (relay ? relay(p) : progress.push(p));
    let source: AsyncIterable<ResearchResult>;
    try {
      source =
        body.data.source === "api" ? fromFlights(flights.search(req, c.req.raw.signal)) : ai!.research(req, c.req.raw.signal, onProgress);
    } catch (e) {
      // e.g. no flight provider configured
      return c.json({ error: (e as Error).message }, 409);
    }

    let researched: string | undefined;
    c.header("content-type", "application/x-ndjson");
    return stream(c, async (s) => {
      // Writes queue up in order; progress can arrive between proposals.
      let writing = Promise.resolve();
      const write = (line: unknown) => (writing = writing.then(async () => void (await s.writeln(JSON.stringify(line)))));
      relay = (p) => void write({ progress: p });
      for (const p of progress.splice(0)) relay(p);
      try {
        for await (const result of source) {
          const [proposal] = store.update(plan.id, (e) => {
            const r = withResearched(e!, [result], idea?.member.name);
            return { entry: r.entry, result: r.added };
          });
          if (idea && !researched) researched = proposal!.id;
          await write({ proposal });
        }
        // Mark the idea done, pointing at what came of it. Best effort: the
        // proposals are saved either way.
        if (idea && researched) await site.setSuggestion(plan.id, idea.id, "researched", researched).catch(() => {});
        await write({ done: true });
      } catch (err) {
        await write({ error: humanError(err) });
      }
    });
  });

  // A search or guide running in the background (ROADMAP 3.3): checked on
  // each call, and saved once done. The laptop asks the site, which holds
  // the AI keys that started it.
  app.get("/api/plans/:planId/job", async (c) => {
    const planId = c.req.param("planId");
    const entry = store.get(planId);
    if (!entry) return c.json({ error: "not found" }, 404);
    if (entry.job?.status === "running") {
      if (currentAi()?.background && aiChoice?.active?.option.id === entry.job.ai) await advanceJob(planId);
      else if (!status.hosted && (await site.version().catch(() => 0)) >= 12) {
        // Best effort: shown as still running until the site answers.
        await site.checkJob(planId).catch(() => {});
        await store.refresh().catch(() => {});
      }
    }
    return c.json({ job: store.get(planId)!.job ?? null });
  });

  // Cancels a running job, or clears how the last one ended.
  app.delete("/api/plans/:planId/job", async (c) => {
    const planId = c.req.param("planId");
    const job = store.get(planId)?.job;
    if (!job) return c.json({ job: null });
    if (job.status === "running") await currentAi()?.background?.cancel(job.externalId);
    store.update(planId, (e) => {
      const { job: _gone, ...rest } = e!;
      return { entry: rest, result: null };
    });
    return c.json({ job: null });
  });

  // Ideas friends sent from the site for this trip.
  app.get("/api/plans/:planId/suggestions", async (c) => {
    try {
      return c.json(await site.suggestions(c.req.param("planId")));
    } catch (e) {
      // A site from before ideas existed: none to show (status says why).
      if (e instanceof SiteError && e.status === 404) return c.json([]);
      throw e;
    }
  });

  app.put("/api/plans/:planId/suggestions/:id", async (c) => {
    const { planId, id } = c.req.param();
    const body = z.object({ status: z.enum(["new", "researched", "dismissed"]) }).safeParse(await c.req.json().catch(() => null));
    if (!body.success) return c.json({ error: "expected {status}" }, 400);
    return c.json(await site.setSuggestion(planId, id, body.data.status));
  });

  // Revisar y aprobar.
  // Clear out everything not approved (to review or discarded), with its
  // photos and notes, to start the next search clean. Approved ones stay.
  app.post("/api/plans/:planId/proposals/clear-unapproved", async (c) => {
    const planId = c.req.param("planId");
    if (!store.get(planId)) return c.json({ error: "not found" }, 404);
    const removed = store.update(planId, (e) => {
      const gone = new Set(e!.proposals.filter((p) => p.review !== "approved").map((p) => p.id));
      const editorial = Object.fromEntries(Object.entries(e!.editorial).filter(([id]) => !gone.has(id)));
      return { entry: { ...e!, proposals: e!.proposals.filter((p) => !gone.has(p.id)), editorial }, result: gone.size };
    });
    return c.json({ removed });
  });

  app.post("/api/plans/:planId/proposals/:id/review", async (c) => {
    const { planId, id } = c.req.param();
    const body = z.object({ review: z.enum(["pending", "approved", "discarded"]) }).safeParse(await c.req.json());
    if (!body.success) return c.json({ error: "expected {review}" }, 400);
    const found = store.get(planId)?.proposals.some((p) => p.id === id);
    if (!found) return c.json({ error: "not found" }, 404);
    store.update(planId, (e) => ({
      entry: { ...e!, proposals: e!.proposals.map((p) => (p.id === id ? { ...p, review: body.data.review } : p)) },
      result: null,
    }));
    return c.json({ ok: true });
  });

  // "Verificar con la API": re-price the same route and dates on the flight provider.
  app.post("/api/plans/:planId/proposals/:id/verify", async (c) => {
    const { planId, id } = c.req.param();
    const proposal = store.get(planId)?.proposals.find((p) => p.id === id);
    if (!proposal) return c.json({ error: "not found" }, 404);
    let found;
    try {
      found = await flights.verify({
        origin: proposal.outbound.from,
        destination: proposal.place.iata,
        outboundDate: proposal.outbound.departAt.slice(0, 10),
        inboundDate: proposal.inbound.departAt.slice(0, 10),
        partySize: store.get(planId)!.plan.partySize,
      });
    } catch (e) {
      return c.json({ verified: false, reason: (e as Error).message });
    }
    if (!found) return c.json({ verified: false, reason: `${flights.name} no encuentra ese itinerario` });
    const verified: Proposal = {
      ...proposal,
      ...found,
      provenance: { kind: "api", provider: flights.name, checkedAt: now().toISOString() },
    };
    store.update(planId, (e) => ({
      entry: { ...e!, proposals: e!.proposals.map((p) => (p.id === id ? verified : p)) },
      result: null,
    }));
    return c.json({ verified: true, proposal: verified });
  });

  // The photo picker: every configured source at once (SPEC §6).
  app.get("/api/photos", async (c) => {
    const q = (c.req.query("q") ?? "").trim().slice(0, 100);
    if (!q) return c.json({ error: "expected ?q=" }, 400);
    const count = Math.min(Math.max(Number(c.req.query("count")) || 12, 1), 30);
    return c.json(await searchAll(photos, q, count, c.req.raw.signal));
  });

  // Saves prices checked by hand or read in the browser: checked from now,
  // and where they were seen (SPEC §3).
  const savePrices = (planId: string, proposal: Proposal, data: z.infer<typeof PricesBody>): Proposal => {
    const prev = proposal.provenance;
    // Times checked now, or on an earlier check that this one keeps.
    const flightDetails = data.outbound !== undefined || (prev.kind !== "claude" && !prev.forOtherDates && (prev.kind === "api" || prev.flightDetails === true));
    // Where it was seen: now, or on an earlier check still for these dates.
    const kept = prev.kind === "organiser" && !prev.forOtherDates ? (prev.seenOn ?? []) : [];
    const seenOn = [...new Set([...kept, ...(data.seenOn ?? [])])];
    const sources = [...(prev.kind === "api" ? [] : prev.sources), ...(data.sources ?? [])].filter((s, i, all) => all.findIndex((x) => x.url === s.url) === i).slice(-10);
    const updated: Proposal = {
      ...applyCheckedPrices(proposal, data, store.get(planId)!.plan.nights),
      provenance: {
        kind: "organiser",
        checkedAt: now().toISOString(),
        sources,
        ...(flightDetails ? { flightDetails: true } : {}),
        ...(seenOn.length ? { seenOn } : {}),
      },
    };
    store.update(planId, (e) => ({ entry: { ...e!, proposals: e!.proposals.map((p) => (p.id === proposal.id ? updated : p)) }, result: null }));
    return updated;
  };

  // The organiser checked the real prices (the airline, the booking site) and
  // types them in as those sites show them: one person's flights there and
  // back, and the whole stay for the group. Counts as checked from now, like an API
  // check, and goes stale the same way (SPEC §3).
  app.post("/api/plans/:planId/proposals/:id/prices", async (c) => {
    const { planId, id } = c.req.param();
    const body = PricesBody.safeParse(await c.req.json().catch(() => null));
    if (!body.success) return c.json({ error: "expected {flightCents, stayCents?, outbound?, inbound?, stay?}: one person's flights there and back, and the whole stay, in cents" }, 400);
    if (!body.data.outbound !== !body.data.inbound) return c.json({ error: "outbound and inbound go together" }, 400);
    const entry = store.get(planId);
    const proposal = entry?.proposals.find((p) => p.id === id);
    if (!entry || !proposal) return c.json({ error: "not found" }, 404);
    return c.json(savePrices(planId, proposal, body.data));
  });

  // "Añadir a mano" (ROADMAP 3.3): a destination the organiser found and
  // priced themselves goes straight in as approved, checked by hand. Without
  // flight times, the site shows the price alone (flightDetailsKnown).
  app.post("/api/plans/:planId/proposals", async (c) => {
    const planId = c.req.param("planId");
    const entry = store.get(planId);
    if (!entry) return c.json({ error: "not found" }, 404);
    const body = ManualBody.safeParse(await c.req.json().catch(() => null));
    if (!body.success) return c.json({ error: body.error.issues[0]?.message ?? "propuesta no válida", issues: body.error.issues }, 400);
    if (!body.data.outbound !== !body.data.inbound) return c.json({ error: "outbound and inbound go together" }, 400);
    const { place, category, ...prices } = body.data;
    const { plan } = entry;
    const taken = new Set(entry.proposals.map((p) => p.id));
    const base = slugify(place.city) || place.iata.toLowerCase();
    let id = base;
    for (let n = 2; taken.has(id); n++) id = `${base}-${n}`;
    // Placeholders until real times are known: the trip's dates, never shown.
    const leg = (from: string, to: string, day: string) => ({ from, to, departAt: `${day}T12:00:00Z`, arriveAt: `${day}T12:00:00Z`, carrier: "Por confirmar", flightNumber: "—", stops: 0, priceCents: 0 });
    const blank: Proposal = {
      id,
      planId,
      place,
      category,
      outbound: leg(plan.origin, place.iata, plan.dateFrom),
      inbound: leg(place.iata, plan.origin, plan.dateTo),
      stays: [],
      todo: [],
      see: [],
      provenance: { kind: "organiser", checkedAt: now().toISOString(), sources: [], ...(prices.outbound ? { flightDetails: true } : {}) },
      review: "approved",
    };
    const proposal = applyCheckedPrices(blank, prices, plan.nights);
    store.update(planId, (e) => ({
      entry: { ...e!, proposals: [...e!.proposals, proposal], editorial: { ...e!.editorial, [id]: { photoQueries: [place.city] } } },
      result: null,
    }));
    return c.json(proposal, 201);
  });

  // "Leer captura": Claude reads a screenshot of the flights or the stay and
  // the price dialog fills in what it found, for the organiser to review.
  // Nothing is saved here.
  app.post("/api/plans/:planId/proposals/:id/extract", async (c) => {
    const { planId, id } = c.req.param();
    const body = ExtractBody.safeParse(await c.req.json().catch(() => null));
    if (!body.success) return c.json({ error: "Sube entre 1 y 4 capturas en PNG, JPG, WebP o GIF, de menos de 5 MB cada una" }, 400);
    const entry = store.get(planId);
    const proposal = entry?.proposals.find((p) => p.id === id);
    if (!entry || !proposal) return c.json({ error: "not found" }, 404);
    const ai = currentAi();
    if (!ai || statusNow().research === "none") return c.json({ error: "Para leer capturas hace falta una IA: mira en Ajustes cómo añadir una." }, 409);
    const { plan } = entry;
    const raw = await ai.extract(
      {
        kind: body.data.kind,
        images: body.data.images,
        context: { origin: plan.origin, city: proposal.place.city, iata: proposal.place.iata, dateFrom: plan.dateFrom, dateTo: plan.dateTo, nights: plan.nights, partySize: plan.partySize },
      },
      c.req.raw.signal,
    );
    try {
      return c.json(extractedFields(body.data.kind, raw));
    } catch {
      return c.json({ error: "No he sabido leer esa captura. Prueba con otra más clara." }, 422);
    }
  });

  // "Comprobar vuelos" (ROADMAP 3.4): Claude reads the real page in a
  // browser window on this laptop, for a finalist only.
  let browserTurn: Promise<void> = Promise.resolve();
  const browseCheck = (planId: string, id: string): { entry: PlanEntry; proposal: Proposal } | { error: string; status: 404 | 409 } => {
    const entry = store.get(planId);
    const proposal = entry?.proposals.find((p) => p.id === id);
    if (!entry || !proposal) return { error: "not found", status: 404 };
    if (!browse) return { error: "Comprobar vuelos en el navegador necesita el comando claude en este ordenador.", status: 409 };
    if (proposal.review !== "approved") return { error: "Comprueba en el navegador solo las propuestas que vais a usar: apruébala primero.", status: 409 };
    return { entry, proposal };
  };
  const readFlights = async (entry: PlanEntry, proposal: Proposal, signal: AbortSignal, onProgress: (p: ResearchProgress) => void): Promise<Browsed> => {
    const { plan } = entry;
    const context = { origin: plan.origin, city: proposal.place.city, iata: proposal.place.iata, dateFrom: plan.dateFrom, dateTo: plan.dateTo, nights: plan.nights, partySize: plan.partySize };
    const req: BrowseRequest = { url: googleFlightsUrl(proposal.outbound.from, proposal.place.iata, plan.dateFrom, plan.dateTo), context };
    // One window at a time: the browser's profile can't be opened twice.
    const turn = browserTurn.then(() => browse!(req, signal, onProgress));
    browserTurn = turn.then(
      () => {},
      () => {},
    );
    const raw = await turn;
    try {
      return browsedFields(raw, req.url);
    } catch {
      throw new Error("No he sabido leer Google Flights. Prueba otra vez, o pon el precio a mano.");
    }
  };
  const ndjson = (c: Context, work: (write: (line: unknown) => Promise<void>) => Promise<void>) => {
    c.header("content-type", "application/x-ndjson");
    return stream(c, async (s) => {
      let writing = Promise.resolve();
      const write = (line: unknown) => (writing = writing.then(async () => void (await s.writeln(JSON.stringify(line)))));
      try {
        await work(write);
      } catch (err) {
        await write({ error: humanError(err) });
      }
    });
  };

  // "Comprobar vuelos": the best round trips on Google Flights, priced as
  // on the booking page, for the price dialog to pick one. Streams
  // {progress} lines, then {fields} or {error}. Nothing is saved here. The
  // stay is checked by hand on Airbnb.
  app.post("/api/plans/:planId/proposals/:id/browse", async (c) => {
    const { planId, id } = c.req.param();
    const body = z.object({ kind: z.literal("flight").default("flight") }).safeParse((await c.req.json().catch(() => null)) ?? {});
    if (!body.success) return c.json({ error: "El alojamiento se mira a mano en Airbnb: aquí solo se comprueban los vuelos." }, 400);
    const found = browseCheck(planId, id);
    if ("error" in found) return c.json({ error: found.error }, found.status);
    return ndjson(c, async (write) => {
      const fields = await readFlights(found.entry, found.proposal, c.req.raw.signal, (p) => void write({ progress: p }));
      await write({ fields });
    });
  });

  // Comparativa: pros/cons, weather, photos, the inVote checkbox.
  app.patch("/api/plans/:planId/proposals/:id/editorial", async (c) => {
    const { planId, id } = c.req.param();
    const body = EditorialBody.safeParse(await c.req.json());
    if (!body.success) return c.json({ error: "invalid editorial", issues: body.error.issues }, 400);
    if (!store.get(planId)?.proposals.some((p) => p.id === id)) return c.json({ error: "not found" }, 404);
    // Newly kept photos count as downloads where the source asks for it.
    const before = new Set((store.get(planId)!.editorial[id]?.photos ?? []).map((p) => p.url));
    for (const photo of body.data.photos ?? []) {
      if (before.has(photo.url)) continue;
      photos.find((s) => s.name === photo.source)?.picked?.(photo).catch(() => {});
    }
    store.update(planId, (e) => ({
      entry: { ...e!, editorial: { ...e!.editorial, [id]: { ...e!.editorial[id], ...body.data } } },
      result: null,
    }));
    return c.json({ ok: true });
  });

  // Publish the approved set. Unverified or stale ones need {confirm: true}.
  app.post("/api/plans/:planId/publish", async (c) => {
    const entry = entryOr404(c.req.param("planId"));
    if (!entry) return c.json({ error: "not found" }, 404);
    const { confirm } = z.object({ confirm: z.boolean().default(false) }).parse(await c.req.json().catch(() => ({})));
    const warnings = publishWarnings(entry, now());
    if (warnings.length && !confirm) return c.json({ needsConfirmation: true, warnings }, 409);
    const snapshot = buildSnapshot(entry, now());
    // Estimates cite no sources, which a site before version 11 refuses.
    if (snapshot.destinations.some((d) => d.provenance.kind === "claude" && d.provenance.estimate) && (await site.version()) < 11) {
      return c.json({ error: "Tu sitio tiene una versión anterior al panel y no sabe mostrar precios estimados. Actualízalo con npm run deploy:site y vuelve a probar." }, 409);
    }
    // Nothing approved empties a trip that's on the site; one never published
    // has nothing to send.
    if (snapshot.destinations.length === 0 && !entry.published) return c.json({ error: "no hay propuestas aprobadas" }, 409);
    await site.publish(snapshot);
    await site.setPlanMembers(entry.plan.id, entry.participants ?? []);
    const published = { at: snapshot.publishedAt, fingerprint: snapshotFingerprint(entry) };
    store.update(entry.plan.id, (e) => ({ entry: { ...e!, published }, result: null }));
    return c.json({ ok: true, published: snapshot.destinations.length, warnings });
  });

  // Whether the site shows what the panel would publish now.
  app.get("/api/plans/:planId/publish-status", (c) => {
    const entry = entryOr404(c.req.param("planId"));
    if (!entry) return c.json({ error: "not found" }, 404);
    return c.json({
      publishedAt: entry.published?.at ?? null,
      changed: entry.published ? entry.published.fingerprint !== snapshotFingerprint(entry) : entry.proposals.some((p) => p.review === "approved"),
    });
  });

  // --- Personas (SPEC §5) -------------------------------------------------

  // Everyone's state from the site, plus the invite link while it's unused.
  app.get("/api/members", async (c) => {
    const members = await site.members();
    return c.json(
      members.map((m) => {
        const local = store.invite(m.id);
        const url = m.invite?.status === "valid" && local ? inviteUrl(siteUrl, local.token) : null;
        return { ...m, inviteUrl: url };
      }),
    );
  });

  app.put("/api/members", async (c) => {
    const body = z.array(z.object({ id: z.string(), name: z.string() })).safeParse(await c.req.json());
    if (!body.success) return c.json({ error: "expected [{id, name}]" }, 400);
    await site.putMembers(body.data);
    return c.json({ ok: true });
  });

  // A fresh one-time invite; cancels the person's previous unused one.
  app.post("/api/members/:id/invite", async (c) => {
    const id = c.req.param("id");
    const invite = await site.invite(id);
    store.setInvite(id, invite);
    return c.json({ url: inviteUrl(siteUrl, invite.token), expiresAt: invite.expiresAt });
  });

  app.delete("/api/members/:id/sessions", async (c) => {
    await site.closeSessions(c.req.param("id"));
    return c.json({ ok: true });
  });

  app.post("/api/members/:id/revoke", async (c) => {
    const id = c.req.param("id");
    await site.revoke(id);
    store.setInvite(id, null);
    return c.json({ ok: true });
  });

  // Opens the vote on the site and returns the message for the group chat.
  // Verified in-vote prices must be fresh first (SPEC §3).
  // Following the vote (SPEC §4, §7): who's in, a reminder for who isn't,
  // and once closed the count and the message announcing where you're going.
  async function voteView(planId: string, state: VoteState) {
    const entry = store.get(planId)!;
    // Keep the local copy of the plan in step with the site.
    const winner = state.result?.winnerId ?? undefined;
    if (entry.plan.status !== state.status || entry.plan.winnerDestinationId !== winner) {
      store.update(planId, (e) => ({
        entry: { ...e!, plan: { ...e!.plan, status: state.status, ...(winner ? { winnerDestinationId: winner } : {}) } },
        result: null,
      }));
    }
    const going = new Set(entry.participants ?? []);
    const members = (await site.members()).filter((m) => going.has(m.id));
    const people = members.map((m) => ({ id: m.id, name: m.name, voted: state.voted.includes(m.id) }));
    const cities = Object.fromEntries(entry.proposals.map((p) => [p.id, p.place.city]));
    const missing = people.filter((p) => !p.voted).map((p) => p.name);
    const reminder = state.status === "voting" && state.voteDeadline && missing.length ? voteReminderMessage(entry.plan, state.voteDeadline, siteUrl, missing) : null;
    // A tie waits for the organiser's pick before anything is announced.
    const announcement =
      state.result && (state.result.winnerId || state.result.tiedForFirst.length === 0)
        ? voteClosedMessage(
            entry.plan,
            state.result.winnerId ? (cities[state.result.winnerId] ?? state.result.winnerId) : null,
            siteUrl,
            state.result.voteWinnerId ? (cities[state.result.voteWinnerId] ?? state.result.voteWinnerId) : null,
          )
        : null;
    return { ...state, people, cities, reminder, announcement };
  }

  app.get("/api/plans/:planId/vote", async (c) => {
    const planId = c.req.param("planId");
    if (!store.get(planId)) return c.json({ error: "not found" }, 404);
    if (store.get(planId)!.plan.status === "draft") return c.json({ error: "la votación no está abierta" }, 409);
    return c.json(await voteView(planId, await site.vote(planId)));
  });

  app.post("/api/plans/:planId/close", async (c) => {
    const planId = c.req.param("planId");
    if (!store.get(planId)) return c.json({ error: "not found" }, 404);
    return c.json(await voteView(planId, await site.closeVote(planId)));
  });

  app.put("/api/plans/:planId/winner", async (c) => {
    const planId = c.req.param("planId");
    if (!store.get(planId)) return c.json({ error: "not found" }, 404);
    const body = z
      .object({ destinationId: z.string().min(1), override: z.boolean().optional(), note: z.string().trim().max(300).optional() })
      .safeParse(await c.req.json().catch(() => null));
    if (!body.success) return c.json({ error: "expected {destinationId, override?, note?}" }, 400);
    const { destinationId, ...opts } = body.data;
    // Going somewhere other than the vote's winner needs a site that knows how.
    if (opts.override && (await site.version()) < 7) {
      return c.json({ error: "Tu sitio tiene una versión anterior al panel y no sabe cambiar de destino. Actualízalo con npm run deploy:site y vuelve a probar." }, 409);
    }
    return c.json(await voteView(planId, await site.pickWinner(planId, destinationId, opts)));
  });

  app.post("/api/plans/:planId/open-vote", async (c) => {
    const entry = entryOr404(c.req.param("planId"));
    if (!entry) return c.json({ error: "not found" }, 404);
    const body = z
      .object({ deadline: z.iso.datetime({ offset: true }) })
      .safeParse(await c.req.json());
    if (!body.success) return c.json({ error: "expected {deadline}" }, 400);
    const going = new Set(entry.participants ?? []);
    const members = (await site.members()).filter((m) => going.has(m.id));
    if (members.length === 0) return c.json({ error: "elige quién va al viaje (en Personas) antes de abrir la votación" }, 409);
    const stale = publishWarnings(entry, now()).filter(
      (w) => w.reason === "stale" && entry.editorial[w.destinationId]?.inVote !== false,
    );
    if (stale.length) return c.json({ error: "hay precios verificados caducados: vuelve a verificarlos", stale }, 409);

    await site.publish(buildSnapshot(entry, now()));
    await site.setPlanMembers(entry.plan.id, [...going]);
    await site.openVote(entry.plan.id, body.data.deadline);
    store.update(entry.plan.id, (e) => ({
      entry: { ...e!, plan: { ...e!.plan, status: "voting", voteDeadline: body.data.deadline } },
      result: null,
    }));

    return c.json({ message: voteOpenedMessage(entry.plan, body.data.deadline, siteUrl, await pendingInvites(members)) });
  });

  // Whoever on the trip hasn't joined gets a working invite: their unused
  // one, or a fresh one.
  async function pendingInvites(members: MemberStatus[]): Promise<PendingInvite[]> {
    const pending = [];
    for (const m of members.filter((x) => x.passkeys.length === 0 && !x.pin)) {
      let local = m.invite?.status === "valid" ? store.invite(m.id) : undefined;
      if (!local) {
        local = await site.invite(m.id);
        store.setInvite(m.id, local);
      }
      pending.push({ name: m.name, url: inviteUrl(siteUrl, local.token) });
    }
    return pending;
  }

  // --- El viaje (ROADMAP 2.2–2.4) ---------------------------------------------

  // The decided destination's proposal, if there is one.
  const decided = (planId: string) => {
    const entry = store.get(planId);
    const id = entry?.plan.winnerDestinationId;
    return id ? entry.proposals.find((p) => p.id === id) : undefined;
  };

  const tripView = (planId: string) => {
    const entry = store.get(planId)!;
    const destination = decided(planId) ?? null;
    const trip = entry.trip && entry.trip.destinationId === destination?.id ? entry.trip : null;
    return { destination, trip, published: !!entry.tripPublished && !!trip };
  };

  app.get("/api/plans/:planId/trip", async (c) => {
    const planId = c.req.param("planId");
    const entry = store.get(planId);
    if (!entry) return c.json({ error: "not found" }, 404);
    // A vote that closed on its own (deadline, last ballot) since the panel
    // last looked: learn the winner from the site. Best effort.
    if (entry.plan.status !== "draft" && !entry.plan.winnerDestinationId) {
      await site.vote(planId).then((state) => voteView(planId, state), () => {});
    }
    return c.json(tripView(planId));
  });

  // "Preparar el viaje": research drafts the guide and how to get there.
  // Streams NDJSON {progress} lines, then {trip} or {error}.
  app.post("/api/plans/:planId/trip/prepare", async (c) => {
    const planId = c.req.param("planId");
    const entry = store.get(planId);
    if (!entry) return c.json({ error: "not found" }, 404);
    const destination = decided(planId);
    if (!destination) return c.json({ error: "primero decide el destino en Votación" }, 409);
    const body = z.object({ home: z.string().trim().max(60).default("") }).safeParse(await c.req.json().catch(() => ({})));
    if (!body.success) return c.json({ error: "expected {home?}" }, 400);
    const { home } = body.data;
    const req = guideRequest(entry, destination, home);
    // On the site, handed to the AI to run in the background.
    if (status.hosted) return startJob(c, planId, { kind: "guide", req }, { destinationId: destination.id });
    const ai = currentAi();
    if (!ai?.guide) return c.json({ error: "Preparar el viaje necesita una IA: mira en Ajustes cómo añadir una." }, 409);
    const guide = ai.guide.bind(ai);
    const who = ai.who ?? {};

    c.header("content-type", "application/x-ndjson");
    return stream(c, async (s) => {
      let writing = Promise.resolve();
      const write = (line: unknown) => (writing = writing.then(async () => void (await s.writeln(JSON.stringify(line)))));
      try {
        const raw = await guide(req, c.req.raw.signal, (p) => void write({ progress: p }));
        await write({ trip: await saveGuide(planId, destination.id, home, raw, who) });
      } catch (err) {
        await write({ error: humanError(err) });
      }
    });
  });

  // The organiser's edits: text, prices, the stay's details, Tricount.
  app.put("/api/plans/:planId/trip", async (c) => {
    const planId = c.req.param("planId");
    if (!store.get(planId)) return c.json({ error: "not found" }, 404);
    const destination = decided(planId);
    if (!destination) return c.json({ error: "primero decide el destino en Votación" }, 409);
    const parsed = TripPage.safeParse({ ...(await c.req.json().catch(() => ({}))), destinationId: destination.id });
    if (!parsed.success) return c.json({ error: parsed.error.issues[0]?.message ?? "página del viaje no válida", issues: parsed.error.issues }, 400);
    store.update(planId, (e) => ({ entry: { ...e!, trip: parsed.data }, result: null }));
    return c.json(tripView(planId));
  });

  // Publishes the trip page (or takes it down) with the rest of the trip.
  app.post("/api/plans/:planId/trip/publish", async (c) => {
    const planId = c.req.param("planId");
    const entry = store.get(planId);
    if (!entry) return c.json({ error: "not found" }, 404);
    const { published } = z.object({ published: z.boolean().default(true) }).parse(await c.req.json().catch(() => ({})));
    const view = tripView(planId);
    if (published && !view.trip) return c.json({ error: "prepara la página del viaje antes de publicarla" }, 409);
    if (published && view.destination?.review !== "approved") return c.json({ error: "el destino elegido no está aprobado en Revisar" }, 409);
    if ((await site.version()) < 9) {
      return c.json({ error: "Tu sitio tiene una versión anterior al panel y no sabe mostrar la página del viaje. Actualízalo con npm run deploy:site y vuelve a probar." }, 409);
    }
    store.update(planId, (e) => ({ entry: { ...e!, tripPublished: published }, result: null }));
    const next = store.get(planId)!;
    const snapshot = buildSnapshot(next, now());
    await site.publish(snapshot);
    await site.setPlanMembers(planId, next.participants ?? []);
    store.update(planId, (e) => ({ entry: { ...e!, published: { at: snapshot.publishedAt, fingerprint: snapshotFingerprint(e!) } }, result: null }));
    return c.json(tripView(planId));
  });

  // --- Fechas (ROADMAP 2.1) -------------------------------------------------

  // Dates fixed (or unfixed) here show on the site at once, without
  // publishing the rest: the group can ask for the days off. Best effort: a
  // trip not on the site yet, or a site too old, gets them on the next publish.
  const settleOnSite = async (planId: string, window: { dateFrom: string; dateTo: string } | null) => {
    try {
      if ((await site.version()) >= 13) await site.settleDates(planId, window);
    } catch (e) {
      if (!(e instanceof SiteError && e.status === 404)) throw e;
    }
  };

  const OLD_SITE_DATES =
    "Tu sitio tiene una versión anterior al panel y no sabe votar fechas. Actualízalo con npm run deploy:site y vuelve a probar.";

  // The date vote as Fechas shows it: the site's view, the trip's people, and
  // the messages for the group chat.
  async function datesPage(planId: string, dates: DatesView | null) {
    const entry = store.get(planId)!;
    const going = new Set(entry.participants ?? []);
    const people = (await site.members()).filter((m) => going.has(m.id)).map((m) => ({ id: m.id, name: m.name }));
    const missing = dates ? people.filter((p) => !answeredAll(dates, p.id)).map((p) => p.name) : [];
    const chosen = dates?.options.find((o) => o.id === dates.chosenOptionId);
    return {
      dates,
      people,
      reminder: dates?.status === "open" && missing.length ? datesReminderMessage(entry.plan, siteUrl, missing) : null,
      announcement: chosen ? datesChosenMessage(entry.plan, chosen, siteUrl) : null,
    };
  }

  app.get("/api/plans/:planId/dates", async (c) => {
    const planId = c.req.param("planId");
    if (!store.get(planId)) return c.json({ error: "not found" }, 404);
    if ((await site.version()) < 8) return c.json({ error: OLD_SITE_DATES }, 409);
    let dates: DatesView | null = null;
    try {
      dates = await site.dates(planId);
    } catch (e) {
      // Not on the site yet: no date vote either.
      if (!(e instanceof SiteError && e.status === 404)) throw e;
    }
    // A vote that chose dates before the panel kept track: settled.
    if (dates?.chosenOptionId && !store.get(planId)!.datesDecided) store.update(planId, (e) => ({ entry: { ...e!, datesDecided: true }, result: null }));
    return c.json(await datesPage(planId, dates));
  });

  // Proposes the windows (or changes them) and returns the message for the
  // group. A trip that isn't on the site yet goes up without destinations.
  app.put("/api/plans/:planId/dates", async (c) => {
    const entry = entryOr404(c.req.param("planId"));
    if (!entry) return c.json({ error: "not found" }, 404);
    const body = z
      .object({ options: DateWindows, deadline: z.iso.datetime({ offset: true }).nullable().optional() })
      .safeParse(await c.req.json().catch(() => null));
    if (!body.success) return c.json({ error: body.error.issues[0]?.message ?? "expected {options, deadline?}" }, 400);
    const going = new Set(entry.participants ?? []);
    const members = (await site.members()).filter((m) => going.has(m.id));
    if (members.length === 0) return c.json({ error: "elige quién va al viaje (en Personas) antes de proponer fechas" }, 409);
    if ((await site.version()) < 8) return c.json({ error: OLD_SITE_DATES }, 409);
    const windows = body.data.options.map(({ dateFrom, dateTo }) => ({ dateFrom, dateTo }));
    const deadline = body.data.deadline ?? null;
    let dates: DatesView;
    try {
      dates = await site.putDates(entry.plan.id, windows, deadline);
    } catch (e) {
      if (!(e instanceof SiteError && e.status === 404)) throw e;
      await site.publish(shellSnapshot(entry, now()));
      dates = await site.putDates(entry.plan.id, windows, deadline);
    }
    await site.setPlanMembers(entry.plan.id, [...going]);
    const message = datesOpenedMessage(entry.plan, dates.options, deadline, siteUrl, await pendingInvites(members));
    return c.json({ ...(await datesPage(entry.plan.id, dates)), message });
  });

  // "Elegir estas fechas": the trip takes them, here and on the site, and
  // prices checked for other dates are flagged (ROADMAP 1.4).
  app.post("/api/plans/:planId/dates/choose", async (c) => {
    const planId = c.req.param("planId");
    if (!store.get(planId)) return c.json({ error: "not found" }, 404);
    const body = z.object({ optionId: z.string().min(1) }).safeParse(await c.req.json().catch(() => null));
    if (!body.success) return c.json({ error: "expected {optionId}" }, 400);
    const dates = await site.chooseDates(planId, body.data.optionId);
    const option = dates.options.find((o) => o.id === dates.chosenOptionId)!;
    store.update(planId, (e) => {
      const moved = e!.plan.dateFrom !== option.dateFrom || e!.plan.dateTo !== option.dateTo;
      const plan = { ...e!.plan, dateFrom: option.dateFrom, dateTo: option.dateTo, nights: nightsOf(option) };
      return { entry: { ...e!, plan, datesDecided: true, proposals: moved ? e!.proposals.map(markForOtherDates) : e!.proposals }, result: null };
    });
    return c.json({ ...(await datesPage(planId, dates)), plan: store.get(planId)!.plan });
  });

  // "Ya sabemos las fechas": the organiser settles the dates without a vote.
  // Prices checked for other dates are flagged, as when a vote chooses.
  app.post("/api/plans/:planId/dates/fix", async (c) => {
    const planId = c.req.param("planId");
    if (!store.get(planId)) return c.json({ error: "not found" }, 404);
    const day = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
    const body = z
      .object({ dateFrom: day, dateTo: day })
      .refine((d) => d.dateTo > d.dateFrom, "la vuelta tiene que ser después de la ida")
      .safeParse(await c.req.json().catch(() => null));
    if (!body.success) return c.json({ error: body.error.issues[0]?.message ?? "expected {dateFrom, dateTo}" }, 400);
    const open = await site.dates(planId).catch(() => null);
    if (open?.status === "open") return c.json({ error: "Hay una votación de fechas abierta: elige una de sus opciones o quítala primero." }, 409);
    const { dateFrom, dateTo } = body.data;
    store.update(planId, (e) => {
      const moved = e!.plan.dateFrom !== dateFrom || e!.plan.dateTo !== dateTo;
      const plan = { ...e!.plan, dateFrom, dateTo, nights: nightsOf({ dateFrom, dateTo }) };
      return { entry: { ...e!, plan, datesDecided: true, proposals: moved ? e!.proposals.map(markForOtherDates) : e!.proposals }, result: null };
    });
    await settleOnSite(planId, { dateFrom, dateTo });
    return c.json(store.get(planId));
  });

  // Back to undecided, to talk about them again.
  app.delete("/api/plans/:planId/dates/fix", async (c) => {
    const planId = c.req.param("planId");
    if (!store.get(planId)) return c.json({ error: "not found" }, 404);
    store.update(planId, (e) => ({ entry: { ...e!, datesDecided: false }, result: null }));
    await settleOnSite(planId, null);
    return c.json(store.get(planId));
  });

  // --- Days off -------------------------------------------------------------

  // The group says on the site whether they've got the days off; the
  // organiser follows it here and can mark it for someone. With the message
  // for the group chat while anyone's missing.
  const leavePage = async (planId: string, leave: LeaveView | null) => {
    const entry = store.get(planId)!;
    const missing = leave?.people.filter((p) => p.status !== "approved" && p.status !== "denied").map((p) => p.name) ?? [];
    return { leave, reminder: leave && missing.length ? leaveReminderMessage(entry.plan, leave, siteUrl, missing) : null };
  };

  app.get("/api/plans/:planId/leave", async (c) => {
    const planId = c.req.param("planId");
    if (!store.get(planId)) return c.json({ error: "not found" }, 404);
    if ((await site.version()) < 13) return c.json({ ...(await leavePage(planId, null)), outdated: true });
    const leave = await site.leave(planId).catch((e) => {
      // Not on the site yet: nobody to ask.
      if (e instanceof SiteError && e.status === 404) return null;
      throw e;
    });
    return c.json(await leavePage(planId, leave));
  });

  app.put("/api/plans/:planId/leave/:memberId", async (c) => {
    const { planId, memberId } = c.req.param();
    if (!store.get(planId)) return c.json({ error: "not found" }, 404);
    const body = z.object({ status: LeaveStatus }).safeParse(await c.req.json().catch(() => null));
    if (!body.success) return c.json({ error: "expected {status}" }, 400);
    return c.json(await leavePage(planId, await site.setLeave(planId, memberId, body.data.status)));
  });

  app.delete("/api/plans/:planId/dates", async (c) => {
    const planId = c.req.param("planId");
    if (!store.get(planId)) return c.json({ error: "not found" }, 404);
    await site.deleteDates(planId);
    return c.json(await datesPage(planId, null));
  });

  return app;
}
