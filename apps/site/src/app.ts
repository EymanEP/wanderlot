// The published site's API (SPEC §9). Members authenticate with their private
// link (SPEC §5); the panel authenticates with the admin token.
import { Hono, type Context } from "hono";
import { getCookie, setCookie } from "hono/cookie";
import { timingSafeEqual } from "node:crypto";
import { z } from "zod";
import {
  Snapshot,
  effectiveStatus,
  freezeViolation,
  tally,
  validateRanking,
  type Member,
} from "@wanderlot/core";
import type { SiteDb } from "./db.ts";

const COOKIE = "wl_member";
const RECENT_COMMENTS = 3;

export interface SiteOptions {
  db: SiteDb;
  adminToken: string;
  now?: () => Date;
}

type Env = { Variables: { member: Member } };

export function createApp({ db, adminToken, now = () => new Date() }: SiteOptions) {
  const app = new Hono<Env>();

  // Reads the plan and closes the vote if the sixth ballot is in or the
  // deadline has passed (SPEC §4: no scheduler, checked on every read).
  function settle(planId: string) {
    const plan = db.getPlan(planId);
    if (!plan) return undefined;
    const ballots = db.ballots(planId);
    const status = effectiveStatus(
      {
        status: plan.status,
        voteDeadline: plan.voteDeadline,
        partySize: plan.snapshot.plan.partySize,
        ballotsCast: ballots.length,
      },
      now(),
    );
    if (status === "closed" && plan.status === "voting") {
      const result = tallyPlan(plan.snapshot.destinations, ballots.map((b) => b.ranking));
      db.setStatus(planId, "closed", { winnerDestinationId: result.winnerId });
      return { ...db.getPlan(planId)!, ballots };
    }
    return { ...plan, ballots };
  }

  // --- admin (panel) -------------------------------------------------------

  const admin = new Hono<Env>();
  admin.use(async (c, next) => {
    const auth = c.req.header("authorization") ?? "";
    const given = Buffer.from(auth.replace(/^Bearer /, ""));
    const expected = Buffer.from(adminToken);
    if (given.length !== expected.length || !timingSafeEqual(given, expected)) {
      return c.json({ error: "unauthorized" }, 401);
    }
    await next();
  });

  admin.put("/plans/:planId", async (c) => {
    const parsed = Snapshot.safeParse(await c.req.json().catch(() => null));
    if (!parsed.success) return c.json({ error: "invalid snapshot", issues: parsed.error.issues }, 400);
    const snapshot = parsed.data;
    if (snapshot.plan.id !== c.req.param("planId")) return c.json({ error: "plan id mismatch" }, 400);

    const existing = db.getPlan(snapshot.plan.id);
    if (existing && db.ballots(snapshot.plan.id).length > 0) {
      const violation = freezeViolation(existing.snapshot.destinations, snapshot.destinations);
      if (violation) return c.json({ error: violation }, 409);
    }
    db.upsertSnapshot(snapshot);
    return c.json({ ok: true });
  });

  admin.post("/plans/:planId/open-vote", async (c) => {
    const planId = c.req.param("planId");
    const plan = db.getPlan(planId);
    if (!plan) return c.json({ error: "not found" }, 404);
    if (plan.status !== "draft") return c.json({ error: `plan is ${plan.status}` }, 409);
    const body = z.object({ deadline: z.iso.datetime({ offset: true }) }).safeParse(await c.req.json().catch(() => null));
    if (!body.success) return c.json({ error: "deadline required" }, 400);
    if (Date.parse(body.data.deadline) <= now().getTime()) return c.json({ error: "deadline is in the past" }, 400);
    if (plan.snapshot.destinations.filter((d) => d.inVote).length < 2) {
      return c.json({ error: "la votación necesita al menos 2 destinos" }, 409);
    }
    db.setStatus(planId, "voting", { voteDeadline: body.data.deadline });
    return c.json({ ok: true });
  });

  // Issues (or reissues, revoking the old one) each member's private link token.
  admin.post("/members", async (c) => {
    const body = z
      .array(z.object({ id: z.string().regex(/^[a-z0-9][a-z0-9-]{0,63}$/), name: z.string().min(1) }))
      .safeParse(await c.req.json().catch(() => null));
    if (!body.success) return c.json({ error: "expected [{id, name}]" }, 400);
    return c.json(body.data.map((m) => ({ ...m, token: db.issueToken(m.id, m.name) })));
  });

  app.route("/api/admin", admin);

  // --- member links --------------------------------------------------------

  app.get("/p/:planId", (c) => {
    const token = c.req.query("k");
    if (token) {
      if (!db.memberByToken(token)) return c.text("Enlace no válido", 403);
      setCookie(c, COOKIE, token, {
        httpOnly: true,
        sameSite: "Lax",
        secure: new URL(c.req.url).protocol === "https:",
        path: "/",
        maxAge: 60 * 60 * 24 * 365,
      });
      return c.redirect(`/p/${c.req.param("planId")}`);
    }
    if (!memberFrom(c)) return c.text("Pide tu enlace al organizador", 403);
    // Placeholder until the site UI lands; the API below is the real surface.
    return c.html(`<!doctype html><meta charset="utf-8"><title>Wanderlot</title><p>Wanderlot · ${escapeHtml(c.req.param("planId"))}</p>`);
  });

  function memberFrom(c: Context<Env>): Member | undefined {
    const token = getCookie(c, COOKIE);
    return token ? db.memberByToken(token) : undefined;
  }

  // --- member API ----------------------------------------------------------

  const api = new Hono<Env>();
  api.use(async (c, next) => {
    const member = memberFrom(c);
    // Without a valid link you see nothing, not even whether a plan exists.
    if (!member) return c.json({ error: "unauthorized" }, 401);
    c.set("member", member);
    await next();
  });

  api.get("/plans/:planId", (c) => {
    const plan = settle(c.req.param("planId"));
    if (!plan) return c.json({ error: "not found" }, 404);
    const me = c.get("member");
    const voted = new Set(plan.ballots.map((b) => b.memberId));
    return c.json({
      plan: {
        ...plan.snapshot.plan,
        status: plan.status,
        voteDeadline: plan.voteDeadline,
        winnerDestinationId: plan.winnerDestinationId,
      },
      destinations: plan.snapshot.destinations,
      publishedAt: plan.snapshot.publishedAt,
      me,
      myRanking: plan.ballots.find((b) => b.memberId === me.id)?.ranking ?? null,
      // Who has voted is always visible; what they voted is not (SPEC §4).
      participation: db.members().map((m) => ({ ...m, voted: voted.has(m.id) })),
    });
  });

  api.put("/plans/:planId/ballot", async (c) => {
    const planId = c.req.param("planId");
    const plan = settle(planId);
    if (!plan) return c.json({ error: "not found" }, 404);
    if (plan.status !== "voting") return c.json({ error: `la votación está ${plan.status === "closed" ? "cerrada" : "sin abrir"}` }, 409);
    const body = z.object({ ranking: z.array(z.string()) }).safeParse(await c.req.json().catch(() => null));
    if (!body.success) return c.json({ error: "expected {ranking}" }, 400);
    const inVote = plan.snapshot.destinations.filter((d) => d.inVote).map((d) => d.id);
    const problem = validateRanking(body.data.ranking, inVote);
    if (problem) return c.json({ error: problem }, 400);
    db.putBallot(planId, c.get("member").id, body.data.ranking, now().toISOString());
    const after = settle(planId)!;
    return c.json({ ok: true, status: after.status });
  });

  api.get("/plans/:planId/results", (c) => {
    const plan = settle(c.req.param("planId"));
    if (!plan) return c.json({ error: "not found" }, 404);
    if (plan.status !== "closed") return c.json({ error: "el recuento se ve al cerrar la votación" }, 403);
    const result = tallyPlan(plan.snapshot.destinations, plan.ballots.map((b) => b.ranking));
    const names = new Map(db.members().map((m) => [m.id, m.name]));
    return c.json({
      ...result,
      winnerId: plan.winnerDestinationId ?? result.winnerId,
      ballots: plan.ballots.map((b) => ({ memberId: b.memberId, name: names.get(b.memberId), ranking: b.ranking })),
    });
  });

  api.get("/plans/:planId/comments", (c) => {
    const planId = c.req.param("planId");
    if (!db.getPlan(planId)) return c.json({ error: "not found" }, 404);
    const destinationId = c.req.query("destinationId");
    return c.json(destinationId ? db.commentsFor(planId, destinationId) : db.recentComments(planId, RECENT_COMMENTS));
  });

  api.post("/plans/:planId/comments", async (c) => {
    const planId = c.req.param("planId");
    const plan = db.getPlan(planId);
    if (!plan) return c.json({ error: "not found" }, 404);
    const body = z
      .object({ destinationId: z.string(), body: z.string().trim().min(1).max(4000), parentId: z.string().optional() })
      .safeParse(await c.req.json().catch(() => null));
    if (!body.success) return c.json({ error: "expected {destinationId, body, parentId?}" }, 400);
    const { destinationId, parentId } = body.data;
    if (!plan.snapshot.destinations.some((d) => d.id === destinationId)) {
      return c.json({ error: "unknown destination" }, 400);
    }
    if (parentId) {
      const parent = db.getComment(parentId);
      // Threads are one level deep, and a reply stays on its parent's destination.
      if (!parent || parent.planId !== planId || parent.destinationId !== destinationId || parent.parentId) {
        return c.json({ error: "invalid parent" }, 400);
      }
    }
    const comment = db.addComment({
      planId,
      destinationId,
      memberId: c.get("member").id,
      body: body.data.body,
      createdAt: now().toISOString(),
      ...(parentId ? { parentId } : {}),
    });
    return c.json(comment, 201);
  });

  app.route("/api", api);
  return app;
}

function tallyPlan(destinations: Snapshot["destinations"], rankings: string[][]) {
  return tally(
    destinations.filter((d) => d.inVote).map((d) => ({ id: d.id, totalPerPersonCents: d.totalPerPersonCents })),
    rankings,
  );
}

function escapeHtml(s: string) {
  return s.replace(/[&<>"']/g, (ch) => `&#${ch.charCodeAt(0)};`);
}
