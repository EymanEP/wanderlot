// The local panel's API: Generar, Revisar y aprobar, Comparativa, publish.
// Served on 127.0.0.1 only (see server.ts).
import { Hono } from "hono";
import { stream } from "hono/streaming";
import { z } from "zod";
import { GroupSettings, Photo, Plan, SITE_API_VERSION, addDaysIso, applyCheckedPrices, slugify, type Proposal, type VoteState } from "@wanderlot/core";
import type { FlightProvider, ResearchProgress, ResearchProvider, ResearchResult, SearchRequest } from "./providers/types.ts";
import { searchAll, type PhotoSource } from "./providers/photos.ts";
import { localOnly } from "./guard.ts";

import { SiteError, buildSnapshot, publishWarnings, snapshotFingerprint, type SiteClient } from "./publish.ts";
import type { PanelStore } from "./store.ts";
import { inviteUrl, voteClosedMessage, voteOpenedMessage, voteReminderMessage } from "./announce.ts";

// What this computer can do, found at startup (SPEC §8).
export interface PanelStatus {
  research: "claude-cli" | "anthropic-api" | "none";
  flights: "duffel" | "none";
  photos: ("wikimedia" | "unsplash" | "pexels")[];
}

export interface PanelOptions {
  store: PanelStore;
  status?: PanelStatus;
  flights: FlightProvider;
  research: ResearchProvider;
  photos?: PhotoSource[];
  site: SiteClient;
  // Host:port values the panel answers to (see guard.ts); unset in tests.
  hosts?: string[];
  siteUrl: string;
  now?: () => Date;
}

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

async function* fromFlights(it: AsyncIterable<Omit<Proposal, "review">>): AsyncIterable<ResearchResult> {
  for await (const proposal of it) yield { proposal };
}

export function createPanel({
  store,
  flights,
  research,
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
    return c.json({ error: err.message }, 500);
  });

  const entryOr404 = (planId: string) => store.get(planId);

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
    return c.json({ ...status, site: { url: siteUrl, reachable, outdated, ...(error ? { error } : {}) } });
  });

  app.get("/api/settings", async (c) => c.json(await site.settings()));

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
    store.update(plan.id, (e) => ({ entry: { proposals: [], editorial: {}, ...e, plan }, result: null }));
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
    // Research's steps, relayed as they happen for Generar's live view.
    const progress: ResearchProgress[] = [];
    let relay: ((p: ResearchProgress) => void) | undefined;
    const onProgress = (p: ResearchProgress) => (relay ? relay(p) : progress.push(p));
    let source: AsyncIterable<ResearchResult>;
    try {
      source =
        body.data.source === "api" ? fromFlights(flights.search(req, c.req.raw.signal)) : research.research(req, c.req.raw.signal, onProgress);
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
        for await (const { proposal: p, notes } of source) {
          // A new search adds to the list and never replaces a proposal the
          // organiser may already have approved: each gets an unused id.
          const taken = new Set(store.get(plan.id)!.proposals.map((x) => x.id));
          const base = p.id.replace(/-\d+$/, "") || "propuesta";
          let id = base;
          for (let n = 2; taken.has(id); n++) id = `${base}-${n}`;
          const proposal: Proposal = { ...p, id, review: "pending", ...(idea ? { suggestedBy: idea.member.name } : {}) };
          if (idea && !researched) researched = id;
          store.update(plan.id, (e) => {
            // Research's notes seed Comparativa; the organiser's edits win.
            const prev = e!.editorial[proposal.id] ?? {};
            const editorial = notes
              ? {
                  ...e!.editorial,
                  [proposal.id]: {
                    pros: notes.pros,
                    cons: notes.cons,
                    weather: notes.weather,
                    ...prev,
                    photoQueries: notes.photoSubjects.length ? notes.photoSubjects : (prev.photoQueries ?? []),
                  },
                }
              : e!.editorial;
            return {
              entry: { ...e!, editorial, proposals: [...e!.proposals.filter((x) => x.id !== proposal.id), proposal] },
              result: null,
            };
          });
          await write({ proposal });
        }
        // Mark the idea done, pointing at what came of it. Best effort: the
        // proposals are saved either way.
        if (idea && researched) await site.setSuggestion(plan.id, idea.id, "researched", researched).catch(() => {});
        await write({ done: true });
      } catch (err) {
        await write({ error: (err as Error).message });
      }
    });
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

  // The organiser checked the real prices (the airline, the booking site) and
  // types them in as those sites show them: one person's flights there and
  // back, and the whole stay for the group. Counts as checked from now, like an API
  // check, and goes stale the same way (SPEC §3).
  app.post("/api/plans/:planId/proposals/:id/prices", async (c) => {
    const { planId, id } = c.req.param();
    const body = z
      .object({
        flightCents: z.number().int().min(0).max(10_000_000),
        stayCents: z.number().int().min(0).max(100_000_000).optional(),
      })
      .safeParse(await c.req.json().catch(() => null));
    if (!body.success) return c.json({ error: "expected {flightCents, stayCents?}: one person's flights there and back, and the whole stay, in cents" }, 400);
    const entry = store.get(planId);
    const proposal = entry?.proposals.find((p) => p.id === id);
    if (!entry || !proposal) return c.json({ error: "not found" }, 404);
    const updated: Proposal = {
      ...applyCheckedPrices(proposal, body.data, entry.plan.nights),
      provenance: {
        kind: "organiser",
        checkedAt: now().toISOString(),
        sources: proposal.provenance.kind === "api" ? [] : proposal.provenance.sources,
      },
    };
    store.update(planId, (e) => ({ entry: { ...e!, proposals: e!.proposals.map((p) => (p.id === id ? updated : p)) }, result: null }));
    return c.json(updated);
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
        ? voteClosedMessage(entry.plan, state.result.winnerId ? (cities[state.result.winnerId] ?? state.result.winnerId) : null, siteUrl)
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
    const body = z.object({ destinationId: z.string().min(1) }).safeParse(await c.req.json().catch(() => null));
    if (!body.success) return c.json({ error: "expected {destinationId}" }, 400);
    return c.json(await voteView(planId, await site.pickWinner(planId, body.data.destinationId)));
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

    // Whoever on the trip hasn't joined gets a working invite: their unused
    // one, or a fresh one.
    const pending = [];
    for (const m of members.filter((x) => x.passkeys.length === 0 && !x.pin)) {
      let local = m.invite?.status === "valid" ? store.invite(m.id) : undefined;
      if (!local) {
        local = await site.invite(m.id);
        store.setInvite(m.id, local);
      }
      pending.push({ name: m.name, url: inviteUrl(siteUrl, local.token) });
    }
    return c.json({ message: voteOpenedMessage(entry.plan, body.data.deadline, siteUrl, pending) });
  });

  return app;
}
