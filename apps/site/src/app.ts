// The published site's API (SPEC §9). Members sign in with passkeys after a
// one-time invite (SPEC §5); the panel authenticates with the admin token.
// Runs on Node and on Cloudflare Workers: only Web APIs, and storage behind
// SiteStore.
import { Hono, type Context } from "hono";
import { deleteCookie, getCookie, setCookie } from "hono/cookie";
import { z } from "zod";
import {
  generateAuthenticationOptions,
  generateRegistrationOptions,
  verifyAuthenticationResponse,
  verifyRegistrationResponse,
  type AuthenticationResponseJSON,
  type RegistrationResponseJSON,
} from "@simplewebauthn/server";
import { Snapshot, effectiveStatus, freezeViolation, tally, validateRanking, type Member } from "@wanderlot/core";
import { base64url, fromBase64url, randomToken, safeEqual, sha256 } from "./crypto.ts";
import type { Invite, SiteStore } from "./store.ts";

const SESSION_COOKIE = "wl_session";
const RECENT_COMMENTS = 3;
const DAY = 86_400_000;
export const INVITE_TTL_MS = 7 * DAY;
export const SESSION_TTL_MS = 180 * DAY;
const FLOW_TTL_MS = 5 * 60_000;

export interface RelyingParty {
  name: string; // shown in the passkey prompt: "Wanderlot"
  origin: string; // "https://wanderlot-grupo51.workers.dev"
}

export interface SiteOptions {
  store: SiteStore;
  adminToken: string;
  rp: RelyingParty;
  now?: () => Date;
  // The built web UI's index.html. Every page route serves it; the UI asks
  // the API what to show.
  indexHtml?: string;
}

type Env = { Variables: { member: Member } };

export type InviteStatus = "valid" | "used" | "expired" | "cancelled";

export function inviteStatus(i: Invite, now: Date): InviteStatus {
  if (i.usedAt) return "used";
  if (i.cancelledAt) return "cancelled";
  if (Date.parse(i.expiresAt) <= now.getTime()) return "expired";
  return "valid";
}

// "Safari en iPhone": enough for the organiser to tell sign-ins apart.
export function deviceLabel(ua: string | undefined): string | null {
  if (!ua) return null;
  const device = /iPhone/.test(ua) ? "iPhone" : /iPad/.test(ua) ? "iPad" : /Android/.test(ua) ? "Android" : /Mac OS X/.test(ua) ? "Mac" : /Windows/.test(ua) ? "Windows" : /Linux/.test(ua) ? "Linux" : null;
  const browser = /Edg\//.test(ua) ? "Edge" : /Firefox\//.test(ua) ? "Firefox" : /Chrome\//.test(ua) ? "Chrome" : /Safari\//.test(ua) ? "Safari" : null;
  if (browser && device) return `${browser} en ${device}`;
  return browser ?? device;
}

const FlowBody = z.object({ flowId: z.string().min(1), response: z.looseObject({ id: z.string() }) });

export function createApp({ store, adminToken, rp, now = () => new Date(), indexHtml }: SiteOptions) {
  const app = new Hono<Env>();
  const rpID = new URL(rp.origin).hostname;
  const secure = new URL(rp.origin).protocol === "https:";
  const iso = (ms = 0) => new Date(now().getTime() + ms).toISOString();

  // --- sessions ------------------------------------------------------------

  async function startSession(c: Context<Env>, memberId: string, passkeyId: string | null) {
    const token = randomToken();
    await store.createSession(await sha256(token), {
      memberId,
      passkeyId,
      createdAt: iso(),
      lastSeenAt: iso(),
      expiresAt: iso(SESSION_TTL_MS),
      userAgent: c.req.header("user-agent") ?? null,
    });
    setCookie(c, SESSION_COOKIE, token, { httpOnly: true, secure, sameSite: "Lax", path: "/", maxAge: SESSION_TTL_MS / 1000 });
  }

  async function currentMember(c: Context<Env>): Promise<Member | undefined> {
    const token = getCookie(c, SESSION_COOKIE);
    if (!token) return undefined;
    const hash = await sha256(token);
    const session = await store.session(hash);
    if (!session) return undefined;
    if (Date.parse(session.expiresAt) <= now().getTime()) {
      await store.deleteSession(hash);
      return undefined;
    }
    // Sliding expiry, written at most once a day to spare the database.
    if (now().getTime() - Date.parse(session.lastSeenAt) > DAY) await store.touchSession(hash, iso(), iso(SESSION_TTL_MS));
    return store.member(session.memberId);
  }

  // Reads the plan and closes the vote if everyone has voted or the deadline
  // has passed (SPEC §4: no scheduler, checked on every read).
  async function settle(planId: string) {
    const plan = await store.getPlan(planId);
    if (!plan) return undefined;
    const ballots = await store.ballots(planId);
    const status = effectiveStatus(
      { status: plan.status, voteDeadline: plan.voteDeadline, partySize: plan.snapshot.plan.partySize, ballotsCast: ballots.length },
      now(),
    );
    if (status === "closed" && plan.status === "voting") {
      const result = tallyPlan(plan.snapshot.destinations, ballots.map((b) => b.ranking));
      await store.setStatus(planId, "closed", { winnerDestinationId: result.winnerId });
      return { ...(await store.getPlan(planId))!, ballots };
    }
    return { ...plan, ballots };
  }

  // --- pages -----------------------------------------------------------------

  const page = (c: Context<Env>) =>
    indexHtml ? c.html(indexHtml) : c.text("La web no está compilada: npm run build -w @wanderlot/site", 503);
  app.get("/", page);
  app.get("/entrar", page);
  app.get("/i/:token", page); // never consumes the invite: link previews are harmless
  app.get("/p/*", page);

  // --- invites (public) --------------------------------------------------------

  async function findInvite(token: string) {
    const invite = await store.inviteByTokenHash(await sha256(token));
    if (!invite) return undefined;
    const member = await store.member(invite.memberId);
    return member ? { invite, member } : undefined;
  }

  app.get("/api/invites/:token", async (c) => {
    const found = await findInvite(c.req.param("token"));
    if (!found) return c.json({ error: "Esta invitación no existe" }, 404);
    return c.json({ member: { name: found.member.name }, status: inviteStatus(found.invite, now()) });
  });

  app.post("/api/invites/:token/passkey/options", async (c) => {
    const found = await findInvite(c.req.param("token"));
    if (!found) return c.json({ error: "Esta invitación no existe" }, 404);
    const status = inviteStatus(found.invite, now());
    if (status !== "valid") return c.json({ error: `invite ${status}`, status }, 410);
    const existing = await store.passkeysFor(found.member.id);
    const options = await generateRegistrationOptions({
      rpName: rp.name,
      rpID,
      userID: new TextEncoder().encode(found.member.id),
      userName: found.member.name,
      userDisplayName: found.member.name,
      attestationType: "none",
      excludeCredentials: existing.map((p) => ({ id: p.id, transports: p.transports })),
      // Discoverable, so signing in later needs no name.
      authenticatorSelection: { residentKey: "required", userVerification: "preferred" },
    });
    const flowId = randomToken(16);
    await store.putFlow(flowId, { challenge: options.challenge, purpose: "register", inviteId: found.invite.id, expiresAt: iso(FLOW_TTL_MS) }, iso());
    return c.json({ flowId, options });
  });

  app.post("/api/invites/:token/passkey/verify", async (c) => {
    const body = FlowBody.safeParse(await c.req.json().catch(() => null));
    if (!body.success) return c.json({ error: "expected {flowId, response}" }, 400);
    const found = await findInvite(c.req.param("token"));
    if (!found) return c.json({ error: "Esta invitación no existe" }, 404);
    const flow = await store.takeFlow(body.data.flowId);
    if (!flow || flow.purpose !== "register" || flow.inviteId !== found.invite.id || Date.parse(flow.expiresAt) <= now().getTime()) {
      return c.json({ error: "El intento caducó; vuelve a empezar" }, 400);
    }
    let verification;
    try {
      verification = await verifyRegistrationResponse({
        response: body.data.response as unknown as RegistrationResponseJSON,
        expectedChallenge: flow.challenge,
        expectedOrigin: rp.origin,
        expectedRPID: rpID,
        requireUserVerification: false,
      });
    } catch (e) {
      return c.json({ error: `No se pudo verificar la passkey: ${(e as Error).message}` }, 400);
    }
    if (!verification.verified) return c.json({ error: "No se pudo verificar la passkey" }, 400);

    // Only now is the invite spent, and only once even if two tabs race.
    if (!(await store.useInvite(found.invite.id, iso()))) {
      return c.json({ error: "Esta invitación ya se usó", status: "used" }, 410);
    }
    const cred = verification.registrationInfo.credential;
    await store.addPasskey({
      id: cred.id,
      memberId: found.member.id,
      publicKey: base64url(cred.publicKey),
      counter: cred.counter,
      transports: cred.transports ?? [],
      device: deviceLabel(c.req.header("user-agent")),
      createdAt: iso(),
      lastUsedAt: iso(),
    });
    await startSession(c, found.member.id, cred.id);
    return c.json({ member: found.member });
  });

  // --- sign in / out -------------------------------------------------------

  app.post("/api/session/options", async (c) => {
    const options = await generateAuthenticationOptions({ rpID, userVerification: "preferred" });
    const flowId = randomToken(16);
    await store.putFlow(flowId, { challenge: options.challenge, purpose: "login", inviteId: null, expiresAt: iso(FLOW_TTL_MS) }, iso());
    return c.json({ flowId, options });
  });

  app.post("/api/session/verify", async (c) => {
    const body = FlowBody.safeParse(await c.req.json().catch(() => null));
    if (!body.success) return c.json({ error: "expected {flowId, response}" }, 400);
    const flow = await store.takeFlow(body.data.flowId);
    if (!flow || flow.purpose !== "login" || Date.parse(flow.expiresAt) <= now().getTime()) {
      return c.json({ error: "El intento caducó; vuelve a empezar" }, 400);
    }
    const passkey = await store.passkey(body.data.response.id);
    if (!passkey) return c.json({ error: "Esta passkey ya no vale aquí. Pide una invitación nueva." }, 401);
    let verification;
    try {
      verification = await verifyAuthenticationResponse({
        response: body.data.response as unknown as AuthenticationResponseJSON,
        expectedChallenge: flow.challenge,
        expectedOrigin: rp.origin,
        expectedRPID: rpID,
        credential: { id: passkey.id, publicKey: fromBase64url(passkey.publicKey), counter: passkey.counter, transports: passkey.transports as never },
        requireUserVerification: false,
      });
    } catch (e) {
      return c.json({ error: `No se pudo comprobar la passkey: ${(e as Error).message}` }, 401);
    }
    if (!verification.verified) return c.json({ error: "No se pudo comprobar la passkey" }, 401);
    await store.recordPasskeyUse(passkey.id, verification.authenticationInfo.newCounter, iso());
    await startSession(c, passkey.memberId, passkey.id);
    return c.json({ member: await store.member(passkey.memberId) });
  });

  app.get("/api/session", async (c) => {
    const member = await currentMember(c);
    return member ? c.json({ member }) : c.json({ error: "unauthorized" }, 401);
  });

  app.delete("/api/session", async (c) => {
    const token = getCookie(c, SESSION_COOKIE);
    if (token) await store.deleteSession(await sha256(token));
    deleteCookie(c, SESSION_COOKIE, { path: "/", secure });
    return c.json({ ok: true });
  });

  // --- admin (panel) -------------------------------------------------------

  const admin = new Hono<Env>();
  admin.use(async (c, next) => {
    const given = (c.req.header("authorization") ?? "").replace(/^Bearer /, "");
    if (!safeEqual(given, adminToken)) return c.json({ error: "unauthorized" }, 401);
    await next();
  });

  admin.put("/plans/:planId", async (c) => {
    const parsed = Snapshot.safeParse(await c.req.json().catch(() => null));
    if (!parsed.success) return c.json({ error: "invalid snapshot", issues: parsed.error.issues }, 400);
    const snapshot = parsed.data;
    if (snapshot.plan.id !== c.req.param("planId")) return c.json({ error: "plan id mismatch" }, 400);
    const existing = await store.getPlan(snapshot.plan.id);
    if (existing && (await store.ballots(snapshot.plan.id)).length > 0) {
      const violation = freezeViolation(existing.snapshot.destinations, snapshot.destinations);
      if (violation) return c.json({ error: violation }, 409);
    }
    await store.upsertSnapshot(snapshot);
    return c.json({ ok: true });
  });

  admin.post("/plans/:planId/open-vote", async (c) => {
    const planId = c.req.param("planId");
    const plan = await store.getPlan(planId);
    if (!plan) return c.json({ error: "not found" }, 404);
    if (plan.status !== "draft") return c.json({ error: `plan is ${plan.status}` }, 409);
    const body = z.object({ deadline: z.iso.datetime({ offset: true }) }).safeParse(await c.req.json().catch(() => null));
    if (!body.success) return c.json({ error: "deadline required" }, 400);
    if (Date.parse(body.data.deadline) <= now().getTime()) return c.json({ error: "deadline is in the past" }, 400);
    if (plan.snapshot.destinations.filter((d) => d.inVote).length < 2) {
      return c.json({ error: "la votación necesita al menos 2 destinos" }, 409);
    }
    await store.setStatus(planId, "voting", { voteDeadline: body.data.deadline });
    return c.json({ ok: true });
  });

  admin.put("/members", async (c) => {
    const body = z
      .array(z.object({ id: z.string().regex(/^[a-z0-9][a-z0-9-]{0,63}$/), name: z.string().trim().min(1).max(60) }))
      .safeParse(await c.req.json().catch(() => null));
    if (!body.success) return c.json({ error: "expected [{id, name}]" }, 400);
    await store.upsertMembers(body.data);
    return c.json({ ok: true });
  });

  // Everyone's state, for the panel's "Personas" screen. No secrets.
  admin.get("/members", async (c) => {
    const at = now();
    const members = await store.members();
    return c.json(
      await Promise.all(
        members.map(async (m) => {
          const invite = await store.latestInvite(m.id);
          const passkeys = await store.passkeysFor(m.id);
          const sessions = (await store.sessionsFor(m.id)).filter((s) => Date.parse(s.expiresAt) > at.getTime());
          return {
            ...m,
            invite: invite
              ? { status: inviteStatus(invite, at), createdAt: invite.createdAt, expiresAt: invite.expiresAt, usedAt: invite.usedAt }
              : null,
            passkeys: passkeys.map((p) => ({ device: p.device, createdAt: p.createdAt, lastUsedAt: p.lastUsedAt })),
            sessions: sessions.map((s) => ({ device: deviceLabel(s.userAgent ?? undefined), createdAt: s.createdAt, lastSeenAt: s.lastSeenAt })),
          };
        }),
      ),
    );
  });

  // A fresh one-time invite. The token is returned once and stored hashed.
  admin.post("/members/:id/invite", async (c) => {
    const member = await store.member(c.req.param("id"));
    if (!member) return c.json({ error: "not found" }, 404);
    await store.cancelPendingInvites(member.id, iso());
    const token = randomToken();
    const expiresAt = iso(INVITE_TTL_MS);
    await store.createInvite({ id: randomToken(12), memberId: member.id, tokenHash: await sha256(token), createdAt: iso(), expiresAt });
    return c.json({ token, expiresAt });
  });

  admin.delete("/members/:id/sessions", async (c) => {
    const member = await store.member(c.req.param("id"));
    if (!member) return c.json({ error: "not found" }, 404);
    await store.deleteSessionsFor(member.id);
    return c.json({ ok: true });
  });

  admin.post("/members/:id/revoke", async (c) => {
    const member = await store.member(c.req.param("id"));
    if (!member) return c.json({ error: "not found" }, 404);
    await store.deleteSessionsFor(member.id);
    await store.deletePasskeysFor(member.id);
    await store.cancelPendingInvites(member.id, iso());
    return c.json({ ok: true });
  });

  app.route("/api/admin", admin);

  // --- member API ----------------------------------------------------------

  const api = new Hono<Env>();
  api.use(async (c, next) => {
    const member = await currentMember(c);
    // Without a session you see nothing, not even whether a plan exists.
    if (!member) return c.json({ error: "unauthorized" }, 401);
    c.set("member", member);
    await next();
  });

  api.get("/:planId", async (c) => {
    const plan = await settle(c.req.param("planId"));
    if (!plan) return c.json({ error: "not found" }, 404);
    const me = c.get("member");
    const voted = new Set(plan.ballots.map((b) => b.memberId));
    return c.json({
      plan: { ...plan.snapshot.plan, status: plan.status, voteDeadline: plan.voteDeadline, winnerDestinationId: plan.winnerDestinationId },
      destinations: plan.snapshot.destinations,
      publishedAt: plan.snapshot.publishedAt,
      me,
      myRanking: plan.ballots.find((b) => b.memberId === me.id)?.ranking ?? null,
      // Who has voted is always visible; what they voted is not (SPEC §4).
      participation: (await store.members()).map((m) => ({ ...m, voted: voted.has(m.id) })),
    });
  });

  api.put("/:planId/ballot", async (c) => {
    const planId = c.req.param("planId");
    const plan = await settle(planId);
    if (!plan) return c.json({ error: "not found" }, 404);
    if (plan.status !== "voting") return c.json({ error: `la votación está ${plan.status === "closed" ? "cerrada" : "sin abrir"}` }, 409);
    const body = z.object({ ranking: z.array(z.string()) }).safeParse(await c.req.json().catch(() => null));
    if (!body.success) return c.json({ error: "expected {ranking}" }, 400);
    const inVote = plan.snapshot.destinations.filter((d) => d.inVote).map((d) => d.id);
    const problem = validateRanking(body.data.ranking, inVote);
    if (problem) return c.json({ error: problem }, 400);
    await store.putBallot(planId, c.get("member").id, body.data.ranking, iso());
    const after = (await settle(planId))!;
    return c.json({ ok: true, status: after.status });
  });

  api.get("/:planId/results", async (c) => {
    const plan = await settle(c.req.param("planId"));
    if (!plan) return c.json({ error: "not found" }, 404);
    if (plan.status !== "closed") return c.json({ error: "el recuento se ve al cerrar la votación" }, 403);
    const result = tallyPlan(plan.snapshot.destinations, plan.ballots.map((b) => b.ranking));
    const names = new Map((await store.members()).map((m) => [m.id, m.name]));
    return c.json({
      ...result,
      winnerId: plan.winnerDestinationId ?? result.winnerId,
      ballots: plan.ballots.map((b) => ({ memberId: b.memberId, name: names.get(b.memberId), ranking: b.ranking })),
    });
  });

  api.get("/:planId/comments", async (c) => {
    const planId = c.req.param("planId");
    if (!(await store.getPlan(planId))) return c.json({ error: "not found" }, 404);
    const destinationId = c.req.query("destinationId");
    return c.json(destinationId ? await store.commentsFor(planId, destinationId) : await store.recentComments(planId, RECENT_COMMENTS));
  });

  api.post("/:planId/comments", async (c) => {
    const planId = c.req.param("planId");
    const plan = await store.getPlan(planId);
    if (!plan) return c.json({ error: "not found" }, 404);
    const body = z
      .object({ destinationId: z.string(), body: z.string().trim().min(1).max(4000), parentId: z.string().optional() })
      .safeParse(await c.req.json().catch(() => null));
    if (!body.success) return c.json({ error: "expected {destinationId, body, parentId?}" }, 400);
    const { destinationId, parentId } = body.data;
    if (!plan.snapshot.destinations.some((d) => d.id === destinationId)) return c.json({ error: "unknown destination" }, 400);
    if (parentId) {
      const parent = await store.getComment(parentId);
      // Threads are one level deep, and a reply stays on its parent's destination.
      if (!parent || parent.planId !== planId || parent.destinationId !== destinationId || parent.parentId) {
        return c.json({ error: "invalid parent" }, 400);
      }
    }
    const comment = {
      id: crypto.randomUUID(),
      planId,
      destinationId,
      memberId: c.get("member").id,
      body: body.data.body,
      createdAt: iso(),
      ...(parentId ? { parentId } : {}),
    };
    await store.addComment(comment);
    return c.json(comment, 201);
  });

  app.route("/api/plans", api);
  return app;
}

function tallyPlan(destinations: Snapshot["destinations"], rankings: string[][]) {
  return tally(
    destinations.filter((d) => d.inVote).map((d) => ({ id: d.id, totalPerPersonCents: d.totalPerPersonCents })),
    rankings,
  );
}
