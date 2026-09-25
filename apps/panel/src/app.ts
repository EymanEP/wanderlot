// The local panel's API: Generar, Revisar y aprobar, Comparativa, publish.
// Served on 127.0.0.1 only (see server.ts).
import { Hono } from "hono";
import { stream } from "hono/streaming";
import { z } from "zod";
import { Photo, Plan, type Proposal } from "@wanderlot/core";
import type { FlightProvider, ResearchProvider, SearchRequest } from "./providers/types.ts";
import { buildSnapshot, publishWarnings, type SiteClient } from "./publish.ts";
import type { PanelStore } from "./store.ts";
import { inviteUrl, voteOpenedMessage } from "./announce.ts";

export interface PanelOptions {
  store: PanelStore;
  flights: FlightProvider;
  research: ResearchProvider;
  site: SiteClient;
  siteUrl: string;
  now?: () => Date;
}

const GenerateBody = z.object({
  source: z.enum(["api", "claude"]),
  scope: z.discriminatedUnion("kind", [
    z.object({ kind: z.literal("anywhere") }),
    z.object({ kind: z.literal("europe") }),
    z.object({ kind: z.literal("place"), iata: z.string().regex(/^[A-Z]{3}$/) }),
  ]),
  stops: z.enum(["direct", "one", "any"]),
  estimateStays: z.boolean(),
  suggestThings: z.boolean(),
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

export function createPanel({ store, flights, research, site, siteUrl, now = () => new Date() }: PanelOptions) {
  const app = new Hono();

  const entryOr404 = (planId: string) => store.get(planId);

  app.get("/api/plans", (c) => c.json(store.list()));

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

  // Generar: streams proposals as NDJSON as they resolve; each is stored as pending.
  app.post("/api/plans/:planId/generate", async (c) => {
    const entry = entryOr404(c.req.param("planId"));
    if (!entry) return c.json({ error: "not found" }, 404);
    const body = GenerateBody.safeParse(await c.req.json());
    if (!body.success) return c.json({ error: "invalid request", issues: body.error.issues }, 400);
    const { plan } = entry;
    const req: SearchRequest = {
      ...body.data,
      planId: plan.id,
      origin: plan.origin,
      dateFrom: plan.dateFrom,
      nights: plan.nights,
      flexDays: plan.flexDays,
      partySize: plan.partySize,
      maxPriceCents: plan.maxPriceCents,
    };
    const source = body.data.source === "api" ? flights.search(req, c.req.raw.signal) : research.research(req, c.req.raw.signal);

    c.header("content-type", "application/x-ndjson");
    return stream(c, async (s) => {
      try {
        for await (const p of source) {
          const proposal: Proposal = { ...p, review: "pending" };
          store.update(plan.id, (e) => ({
            entry: { ...e!, proposals: [...e!.proposals.filter((x) => x.id !== proposal.id), proposal] },
            result: null,
          }));
          await s.writeln(JSON.stringify({ proposal }));
        }
        await s.writeln(JSON.stringify({ done: true }));
      } catch (err) {
        await s.writeln(JSON.stringify({ error: (err as Error).message }));
      }
    });
  });

  // Revisar y aprobar.
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
    const found = await flights.verify({
      origin: proposal.outbound.from,
      destination: proposal.place.iata,
      outboundDate: proposal.outbound.departAt.slice(0, 10),
      inboundDate: proposal.inbound.departAt.slice(0, 10),
      partySize: store.get(planId)!.plan.partySize,
    });
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

  // Comparativa: pros/cons, weather, photos, the inVote checkbox.
  app.patch("/api/plans/:planId/proposals/:id/editorial", async (c) => {
    const { planId, id } = c.req.param();
    const body = EditorialBody.safeParse(await c.req.json());
    if (!body.success) return c.json({ error: "invalid editorial", issues: body.error.issues }, 400);
    if (!store.get(planId)?.proposals.some((p) => p.id === id)) return c.json({ error: "not found" }, 404);
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
    if (snapshot.destinations.length === 0) return c.json({ error: "no hay propuestas aprobadas" }, 409);
    await site.publish(snapshot);
    return c.json({ ok: true, published: snapshot.destinations.length, warnings });
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
  app.post("/api/plans/:planId/open-vote", async (c) => {
    const entry = entryOr404(c.req.param("planId"));
    if (!entry) return c.json({ error: "not found" }, 404);
    const body = z
      .object({ deadline: z.iso.datetime({ offset: true }) })
      .safeParse(await c.req.json());
    if (!body.success) return c.json({ error: "expected {deadline}" }, 400);
    const members = await site.members();
    if (members.length === 0) return c.json({ error: "añade a la gente en Personas antes de abrir la votación" }, 409);
    const stale = publishWarnings(entry, now()).filter(
      (w) => w.reason === "stale" && entry.editorial[w.destinationId]?.inVote !== false,
    );
    if (stale.length) return c.json({ error: "hay precios verificados caducados: vuelve a verificarlos", stale }, 409);

    await site.publish(buildSnapshot(entry, now()));
    await site.openVote(entry.plan.id, body.data.deadline);
    store.update(entry.plan.id, (e) => ({
      entry: { ...e!, plan: { ...e!.plan, status: "voting", voteDeadline: body.data.deadline } },
      result: null,
    }));

    // Whoever hasn't joined gets a working invite: their unused one, or a fresh one.
    const pending = [];
    for (const m of members.filter((x) => x.passkeys.length === 0)) {
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
