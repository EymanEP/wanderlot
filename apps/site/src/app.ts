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
import {
  DEFAULT_SETTINGS,
  SITE_API_VERSION,
  GroupSettings,
  Snapshot,
  effectiveStatus,
  freezeViolation,
  tally,
  validateRanking,
  type CommentView,
  type Member,
  type SuggestionView,
  type VoteState,
  type PlanSummary,
} from "@wanderlot/core";
import { base64url, fromBase64url, pinHasher, randomToken, safeEqual, sha256 } from "./crypto.ts";
import type { Invite, SiteStore } from "./store.ts";
import { SECURITY_HEADERS } from "./headers.ts";

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
  // Throttles the unauthenticated routes that write (passkey options) or test
  // a PIN: true to let a request through. Keyed by client address.
  limit?: (key: string) => Promise<boolean>;
  // Keys the PIN hashes (crypto.ts). Defaults to the admin token; changing it
  // makes everyone set a new PIN from a new invite.
  pinSecret?: string;
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

// "Ana María " and "ana maria" are the same person signing in.
export function nameKey(name: string): string {
  return name.normalize("NFD").replace(/\p{M}/gu, "").trim().replace(/\s+/g, " ").toLowerCase();
}

// Four digits, and not one anyone would try first.
export const PIN_LENGTH = 4;
// The most common 4-digit PINs not caught by the rules below.
const COMMON_PINS = new Set(["1004", "2000", "2001", "6969", "1010", "1313", "1122", "2580", "0852", "1990", "2020", "1984", "0007"]);

export function pinProblem(pin: string): string | null {
  if (!new RegExp(`^\\d{${PIN_LENGTH}}$`).test(pin)) return `El PIN son ${PIN_LENGTH} números`;
  const d = [...pin].map(Number);
  const steps = d.slice(1).map((x, i) => x - d[i]!);
  if (steps.every((x) => x === 0)) return "Ese PIN es demasiado fácil: evita repetir el mismo número";
  if (steps.every((x) => x === 1) || steps.every((x) => x === -1)) return "Ese PIN es demasiado fácil: evita 1234 y parecidos";
  if (/^(\d\d)\1$/.test(pin) || COMMON_PINS.has(pin)) return "Ese PIN es demasiado fácil: elige otro";
  return null;
}

export const PIN_MAX_TRIES = 5;
// Four digits are only 10,000 PINs, so lockouts grow: 15 min, 1 h, 4 h, then
// a day each time, until the right PIN (or a new invite) resets them.
export const PIN_LOCKS_MS = [15 * 60_000, 60 * 60_000, 4 * 60 * 60_000, 24 * 60 * 60_000];
export const pinLockMs = (lockouts: number) => PIN_LOCKS_MS[Math.min(lockouts, PIN_LOCKS_MS.length - 1)]!;

// "15 min", "4 h", "1 día"
function waitLabel(ms: number): string {
  const minutes = Math.ceil(ms / 60_000);
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.ceil(minutes / 60);
  return hours < 24 ? `${hours} h` : "1 día";
}
// Unresearched ideas one person can have waiting on a trip.
export const MAX_OPEN_SUGGESTIONS = 5;

const FlowBody = z.object({ flowId: z.string().min(1), response: z.looseObject({ id: z.string() }) });

export function createApp({ store, adminToken, rp, now = () => new Date(), indexHtml, limit, pinSecret }: SiteOptions) {
  const app = new Hono<Env>();
  const hashPin = pinHasher(pinSecret || adminToken);

  app.use("*", async (c, next) => {
    // Changes must come from the site's own pages. Browsers always send
    // Origin on cross-site writes; SameSite=Lax alone would trust sibling
    // subdomains of a custom domain.
    if (c.req.method !== "GET" && c.req.method !== "HEAD" && c.req.path.startsWith("/api/") && !c.req.path.startsWith("/api/admin/")) {
      const origin = c.req.header("origin");
      if (origin !== undefined && origin !== rp.origin) return c.json({ error: "forbidden origin" }, 403);
    }
    await next();
    for (const [k, v] of Object.entries(SECURITY_HEADERS)) c.header(k, v);
  });

  // Too many passkey attempts from one address: each one writes a row.
  // Cloudflare sets cf-connecting-ip; elsewhere every client shares a bucket
  // (x-forwarded-for could be forged to dodge the limit).
  const throttled = async (c: Context<Env>) => {
    if (!limit) return false;
    const key = c.req.header("cf-connecting-ip") ?? "all";
    return !(await limit(key));
  };
  const tooMany = (c: Context<Env>) => c.json({ error: "Demasiados intentos; espera un minuto" }, 429);
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

  async function suggestionViews(planId: string): Promise<SuggestionView[]> {
    const names = new Map((await store.members()).map((m) => [m.id, m.name]));
    return (await store.suggestions(planId)).map((s) => ({
      id: s.id,
      place: s.place,
      note: s.note,
      createdAt: s.createdAt,
      status: s.status,
      member: { id: s.memberId, name: names.get(s.memberId) ?? "Alguien" },
      proposalId: s.proposalId,
    }));
  }

  // Reads the plan and closes the vote if everyone has voted or the deadline
  // has passed (SPEC §4: no scheduler, checked on every read).
  async function settle(planId: string) {
    const plan = await store.getPlan(planId);
    if (!plan) return undefined;
    const participants = await store.planMembers(planId);
    // Only the trip's people vote; a ballot from someone taken off the trip
    // no longer counts.
    const ballots = (await store.ballots(planId)).filter((b) => participants.includes(b.memberId));
    // The vote closes when everyone on the trip has voted (SPEC §4).
    const partySize = participants.length || plan.snapshot.plan.partySize;
    const status = effectiveStatus({ status: plan.status, voteDeadline: plan.voteDeadline, partySize, ballotsCast: ballots.length }, now());
    if (status === "closed" && plan.status === "voting") {
      const result = tallyPlan(plan.snapshot.destinations, ballots.map((b) => b.ranking));
      await store.setStatus(planId, "closed", { winnerDestinationId: result.winnerId });
      return { ...(await store.getPlan(planId))!, ballots, participants, partySize };
    }
    return { ...plan, ballots, participants, partySize };
  }

  // --- pages -----------------------------------------------------------------

  const page = (c: Context<Env>) =>
    indexHtml ? c.html(indexHtml) : c.text("The web UI isn't built yet: npm run build -w @wanderlot/site", 503);
  app.get("/", page);
  app.get("/entrar", page);
  app.get("/i/:token", page); // never consumes the invite: link previews are harmless
  app.get("/p/*", page);

  // --- the group (public): what the sign-in screen may say (SPEC §5) ---------

  app.get("/api/site", async (c) => {
    const s = { ...DEFAULT_SETTINGS, ...(await store.settings()) };
    return c.json({ groupName: s.groupName, organiserName: s.organiserName });
  });

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

  // Accept the invite by choosing a PIN: works on any device, no passkey
  // needed. Uses up the invite like a passkey would.
  app.post("/api/invites/:token/pin", async (c) => {
    if (await throttled(c)) return tooMany(c);
    const body = z.object({ pin: z.string() }).safeParse(await c.req.json().catch(() => null));
    if (!body.success) return c.json({ error: "expected {pin}" }, 400);
    const problem = pinProblem(body.data.pin);
    if (problem) return c.json({ error: problem }, 400);
    const found = await findInvite(c.req.param("token"));
    if (!found) return c.json({ error: "Esta invitación no existe" }, 404);
    const status = inviteStatus(found.invite, now());
    if (status !== "valid") return c.json({ error: `invite ${status}`, status }, 410);
    if (!(await store.useInvite(found.invite.id, iso()))) return c.json({ error: "Esta invitación ya se usó", status: "used" }, 410);
    const salt = randomToken(16);
    await store.setPin(found.member.id, await (await hashPin)(found.member.id, salt, body.data.pin), salt, iso());
    await startSession(c, found.member.id, null);
    return c.json({ member: found.member });
  });

  app.post("/api/invites/:token/passkey/options", async (c) => {
    if (await throttled(c)) return tooMany(c);
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
      console.warn("passkey registration failed:", (e as Error).message);
      return c.json({ error: "No se pudo verificar la passkey" }, 400);
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

  // Sign in with your name and PIN, from any device. Wrong answers count
  // against the person: PIN_MAX_TRIES in a row lock them out for a while.
  const WRONG = "Nombre o PIN incorrectos";
  app.post("/api/session/pin", async (c) => {
    if (await throttled(c)) return tooMany(c);
    const body = z.object({ name: z.string().max(80), pin: z.string().max(12) }).safeParse(await c.req.json().catch(() => null));
    if (!body.success) return c.json({ error: "expected {name, pin}" }, 400);
    const key = nameKey(body.data.name);
    const member = (await store.members()).find((m) => nameKey(m.name) === key || m.id === key);
    const stored = member && (await store.pin(member.id));
    const hash = await (await hashPin)(member?.id ?? "-", stored?.salt ?? "-", body.data.pin);
    if (!member || !stored) return c.json({ error: WRONG }, 401);
    if (stored.lockedUntil && Date.parse(stored.lockedUntil) > now().getTime()) {
      const left = Date.parse(stored.lockedUntil) - now().getTime();
      return c.json({ error: `Demasiados intentos. Prueba otra vez en ${waitLabel(left)} o pide una invitación nueva.` }, 429);
    }
    if (!safeEqual(hash, stored.hash)) {
      const failed = stored.failed + 1;
      if (failed >= PIN_MAX_TRIES) {
        const lock = pinLockMs(stored.lockouts);
        await store.recordPinFailure(member.id, 0, iso(lock), stored.lockouts + 1);
        return c.json({ error: `Demasiados intentos. Prueba otra vez en ${waitLabel(lock)} o pide una invitación nueva.` }, 429);
      }
      await store.recordPinFailure(member.id, failed, null, stored.lockouts);
      return c.json({ error: WRONG }, 401);
    }
    if (stored.failed > 0 || stored.lockedUntil || stored.lockouts > 0) await store.recordPinFailure(member.id, 0, null, 0);
    await startSession(c, member.id, null);
    return c.json({ member });
  });

  // Choose a new PIN while signed in: how PINs from before the switch to 4
  // digits move over (SPEC §5), and a way to change one anytime.
  app.put("/api/session/pin", async (c) => {
    const member = await currentMember(c);
    if (!member) return c.json({ error: "unauthorized" }, 401);
    const body = z.object({ pin: z.string() }).safeParse(await c.req.json().catch(() => null));
    if (!body.success) return c.json({ error: "expected {pin}" }, 400);
    const problem = pinProblem(body.data.pin);
    if (problem) return c.json({ error: problem }, 400);
    const salt = randomToken(16);
    await store.setPin(member.id, await (await hashPin)(member.id, salt, body.data.pin), salt, iso());
    return c.json({ ok: true });
  });

  app.post("/api/session/options", async (c) => {
    if (await throttled(c)) return tooMany(c);
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
      console.warn("passkey sign-in failed:", (e as Error).message);
      return c.json({ error: "No se pudo comprobar la passkey" }, 401);
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

  // The vote as the organiser follows it: who has voted, what each ballot
  // says and the running count, live (friends see the count only once it
  // closes). Winner is the organiser's pick when first place was tied.
  async function voteState(planId: string): Promise<VoteState | undefined> {
    const plan = await settle(planId);
    if (!plan) return undefined;
    const tally = tallyPlan(plan.snapshot.destinations, plan.ballots.map((b) => b.ranking));
    return {
      status: plan.status,
      voteDeadline: plan.voteDeadline ?? null,
      partySize: plan.partySize,
      voted: plan.ballots.map((b) => b.memberId),
      tally,
      ballots: [...plan.ballots]
        .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
        .map((b) => ({ memberId: b.memberId, ranking: b.ranking, updatedAt: b.updatedAt })),
      result: plan.status === "closed" ? { ...tally, winnerId: plan.winnerDestinationId ?? tally.winnerId } : null,
    };
  }

  admin.get("/plans/:planId/vote", async (c) => {
    const state = await voteState(c.req.param("planId"));
    return state ? c.json(state) : c.json({ error: "not found" }, 404);
  });

  // Close before the deadline, e.g. when everyone who's coming has voted.
  admin.post("/plans/:planId/close", async (c) => {
    const planId = c.req.param("planId");
    const plan = await settle(planId);
    if (!plan) return c.json({ error: "not found" }, 404);
    if (plan.status !== "voting") return c.json({ error: `plan is ${plan.status}` }, 409);
    if (plan.ballots.length === 0) return c.json({ error: "nadie ha votado todavía" }, 409);
    const result = tallyPlan(plan.snapshot.destinations, plan.ballots.map((b) => b.ranking));
    await store.setStatus(planId, "closed", { winnerDestinationId: result.winnerId });
    return c.json(await voteState(planId));
  });

  // A tie for first after every rule: the organiser decides (SPEC §4).
  admin.put("/plans/:planId/winner", async (c) => {
    const planId = c.req.param("planId");
    const body = z.object({ destinationId: z.string().min(1) }).safeParse(await c.req.json().catch(() => null));
    if (!body.success) return c.json({ error: "expected {destinationId}" }, 400);
    const state = await voteState(planId);
    if (!state) return c.json({ error: "not found" }, 404);
    if (!state.result) return c.json({ error: "la votación sigue abierta" }, 409);
    if (!state.result.tiedForFirst.includes(body.data.destinationId)) return c.json({ error: "solo se elige entre los empatados" }, 409);
    await store.setStatus(planId, "closed", { winnerDestinationId: body.data.destinationId });
    return c.json(await voteState(planId));
  });

  // Destinations friends suggested, for the panel to research or dismiss.
  admin.get("/plans/:planId/suggestions", async (c) => c.json(await suggestionViews(c.req.param("planId"))));

  admin.put("/plans/:planId/suggestions/:id", async (c) => {
    const { planId, id } = c.req.param();
    const body = z
      .object({ status: z.enum(["new", "researched", "dismissed"]), proposalId: z.string().min(1).max(80).optional() })
      .safeParse(await c.req.json().catch(() => null));
    if (!body.success) return c.json({ error: "expected {status, proposalId?}" }, 400);
    if (!(await store.suggestions(planId)).some((s) => s.id === id)) return c.json({ error: "not found" }, 404);
    await store.setSuggestionStatus(id, body.data.status, body.data.proposalId ?? null);
    return c.json(await suggestionViews(planId));
  });

  // Who is on this trip (SPEC §5): only they see it, vote and comment.
  admin.put("/plans/:planId/members", async (c) => {
    const body = z.array(z.string().min(1)).max(100).safeParse(await c.req.json().catch(() => null));
    if (!body.success) return c.json({ error: "expected [memberId]" }, 400);
    const known = new Set((await store.members()).map((m) => m.id));
    const unknown = body.data.find((id) => !known.has(id));
    if (unknown) return c.json({ error: `unknown member ${unknown}` }, 400);
    await store.setPlanMembers(c.req.param("planId"), [...new Set(body.data)]);
    return c.json({ ok: true });
  });

  admin.get("/plans/:planId/members", async (c) => c.json(await store.planMembers(c.req.param("planId"))));

  admin.get("/version", (c) => c.json({ api: SITE_API_VERSION }));

  admin.get("/settings", async (c) => c.json({ ...DEFAULT_SETTINGS, ...(await store.settings()) }));

  admin.put("/settings", async (c) => {
    const body = GroupSettings.safeParse(await c.req.json().catch(() => null));
    if (!body.success) return c.json({ error: "invalid settings", issues: body.error.issues }, 400);
    await store.putSettings(body.data);
    return c.json(body.data);
  });

  admin.put("/members", async (c) => {
    const body = z
      .array(z.object({ id: z.string().regex(/^[a-z0-9][a-z0-9-]{0,63}$/), name: z.string().trim().min(1).max(60) }))
      .safeParse(await c.req.json().catch(() => null));
    if (!body.success) return c.json({ error: "expected [{id, name}]" }, 400);
    // People sign in with their name, so no two may look the same.
    const names = new Map((await store.members()).map((m) => [nameKey(m.name), m.id]));
    for (const m of body.data) {
      const taken = names.get(nameKey(m.name));
      if (taken && taken !== m.id) return c.json({ error: `ya hay alguien que se llama ${m.name}` }, 409);
      names.set(nameKey(m.name), m.id);
    }
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
          const pin = await store.pin(m.id);
          const sessions = (await store.sessionsFor(m.id)).filter((s) => Date.parse(s.expiresAt) > at.getTime());
          return {
            ...m,
            invite: invite
              ? { status: inviteStatus(invite, at), createdAt: invite.createdAt, expiresAt: invite.expiresAt, usedAt: invite.usedAt }
              : null,
            passkeys: passkeys.map((p) => ({ device: p.device, createdAt: p.createdAt, lastUsedAt: p.lastUsedAt })),
            pin: pin ? { setAt: pin.setAt, locked: !!pin.lockedUntil && Date.parse(pin.lockedUntil) > at.getTime() } : null,
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
    await store.deletePin(member.id);
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

  // Every published plan, newest first, for the plan switcher and footer.
  api.get("/", async (c) => {
    const list: PlanSummary[] = [];
    const mine = new Set(await store.planIdsFor(c.get("member").id));
    for (const p of (await store.plans()).filter((x) => mine.has(x.id))) {
      const settled = (await settle(p.id))!;
      const winner = settled.snapshot.destinations.find((d) => d.id === settled.winnerDestinationId);
      const { plan } = settled.snapshot;
      list.push({ id: p.id, name: plan.name, status: settled.status, dateFrom: plan.dateFrom, dateTo: plan.dateTo, partySize: settled.partySize, winnerCity: winner?.place.city ?? null });
    }
    return c.json(list);
  });

  // A trip you're not on doesn't exist, as far as you can tell.
  const onTrip = async (c: Context<Env>, next: () => Promise<void>) => {
    const members = await store.planMembers(c.req.param("planId")!);
    if (!members.includes(c.get("member").id)) return c.json({ error: "not found" }, 404);
    await next();
  };
  api.use("/:planId", onTrip);
  api.use("/:planId/*", onTrip);

  api.get("/:planId", async (c) => {
    const plan = await settle(c.req.param("planId"));
    if (!plan) return c.json({ error: "not found" }, 404);
    const me = c.get("member");
    const mine = plan.ballots.find((b) => b.memberId === me.id);
    const voted = new Set(plan.ballots.map((b) => b.memberId));
    return c.json({
      // partySize: the people on the trip, who the vote waits for.
      plan: { ...plan.snapshot.plan, partySize: plan.partySize, status: plan.status, voteDeadline: plan.voteDeadline, winnerDestinationId: plan.winnerDestinationId },
      destinations: plan.snapshot.destinations,
      publishedAt: plan.snapshot.publishedAt,
      me,
      myRanking: mine?.ranking ?? null,
      myBallot: mine ? { ranking: mine.ranking, updatedAt: mine.updatedAt } : null,
      // Who has voted is always visible; what they voted is not (SPEC §4).
      participation: (await store.members()).filter((m) => plan.participants.includes(m.id)).map((m) => ({ ...m, voted: voted.has(m.id) })),
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

  // Ideas for where to go: everyone on the trip sees them, so nobody suggests
  // the same place twice; the organiser researches them from the panel.
  api.get("/:planId/suggestions", async (c) => c.json(await suggestionViews(c.req.param("planId"))));

  api.post("/:planId/suggestions", async (c) => {
    const planId = c.req.param("planId");
    const plan = await settle(planId);
    if (!plan) return c.json({ error: "not found" }, 404);
    if (plan.status === "closed") return c.json({ error: "la votación ya se cerró" }, 409);
    const body = z
      .object({ place: z.string().trim().min(1).max(80), note: z.string().trim().max(500).optional() })
      .safeParse(await c.req.json().catch(() => null));
    if (!body.success) return c.json({ error: "Escribe el destino (hasta 80 letras) y, si quieres, por qué" }, 400);
    const me = c.get("member").id;
    const mine = (await store.suggestions(planId)).filter((s) => s.memberId === me && s.status === "new");
    if (mine.length >= MAX_OPEN_SUGGESTIONS) return c.json({ error: `Ya tienes ${MAX_OPEN_SUGGESTIONS} ideas pendientes en este viaje` }, 409);
    await store.addSuggestion({
      id: randomToken(12),
      planId,
      memberId: me,
      place: body.data.place,
      note: body.data.note || null,
      createdAt: iso(),
      status: "new",
      proposalId: null,
    });
    return c.json(await suggestionViews(planId), 201);
  });

  // All of a plan's comments with likes, newest first. ?destinationId= narrows
  // to one destination, ?limit= to the latest few.
  api.get("/:planId/comments", async (c) => {
    const planId = c.req.param("planId");
    if (!(await store.getPlan(planId))) return c.json({ error: "not found" }, 404);
    const n = Math.trunc(Number(c.req.query("limit")));
    const max = n >= 1 ? Math.min(n, 100) : undefined;
    const destinationId = c.req.query("destinationId") || undefined;
    const likes = await store.likes(planId, c.get("member").id);
    const list = await store.comments(planId, { ...(destinationId ? { destinationId } : {}), ...(max ? { limit: max } : {}) });
    return c.json(list.map((cm): CommentView => ({ ...cm, likes: likes.get(cm.id)?.count ?? 0, likedByMe: likes.get(cm.id)?.mine ?? false })));
  });

  api.put("/:planId/comments/:commentId/like", async (c) => {
    const { planId, commentId } = c.req.param();
    const comment = await store.getComment(commentId);
    if (!comment || comment.planId !== planId) return c.json({ error: "not found" }, 404);
    const body = z.object({ on: z.boolean() }).safeParse(await c.req.json().catch(() => null));
    if (!body.success) return c.json({ error: "expected {on}" }, 400);
    await store.setLike(commentId, c.get("member").id, body.data.on, iso());
    const likes = (await store.likes(planId, c.get("member").id)).get(commentId);
    return c.json({ likes: likes?.count ?? 0, likedByMe: likes?.mine ?? false });
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
    return c.json({ ...comment, likes: 0, likedByMe: false } satisfies CommentView, 201);
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
