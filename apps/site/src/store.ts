// What the site keeps, behind one async interface: node:sqlite implements it
// (sqlite.ts) and Cloudflare D1 (d1.ts) implement it, from the same migrations/.
import type { Ballot, Comment, Member, PlanStatus, Snapshot } from "@wanderlot/core";

export interface StoredPlan {
  snapshot: Snapshot;
  status: PlanStatus;
  voteDeadline: string | undefined;
  winnerDestinationId: string | undefined;
}

export interface Invite {
  id: string;
  memberId: string;
  createdAt: string;
  expiresAt: string;
  usedAt: string | null;
  cancelledAt: string | null;
}

export interface Passkey {
  id: string; // base64url credential id
  memberId: string;
  publicKey: string; // base64url COSE key
  counter: number;
  transports: string[];
  device: string | null;
  createdAt: string;
  lastUsedAt: string | null;
}

export interface Session {
  memberId: string;
  passkeyId: string | null;
  createdAt: string;
  lastSeenAt: string;
  expiresAt: string;
  userAgent: string | null;
}

export interface Flow {
  challenge: string;
  purpose: "register" | "login";
  inviteId: string | null;
  expiresAt: string;
}

export interface SiteStore {
  // plans
  getPlan(id: string): Promise<StoredPlan | undefined>;
  upsertSnapshot(s: Snapshot): Promise<void>;
  setStatus(planId: string, status: PlanStatus, fields?: { voteDeadline?: string; winnerDestinationId?: string | null }): Promise<void>;

  // members
  upsertMembers(members: Member[]): Promise<void>;
  members(): Promise<Member[]>;
  member(id: string): Promise<Member | undefined>;

  // invites: the token is only ever stored hashed
  createInvite(invite: { id: string; memberId: string; tokenHash: string; createdAt: string; expiresAt: string }): Promise<void>;
  inviteByTokenHash(hash: string): Promise<Invite | undefined>;
  latestInvite(memberId: string): Promise<Invite | undefined>;
  // Marks it used only if still unused; false when someone got there first.
  useInvite(id: string, at: string): Promise<boolean>;
  cancelPendingInvites(memberId: string, at: string): Promise<void>;

  // passkeys
  addPasskey(p: Passkey): Promise<void>;
  passkey(id: string): Promise<Passkey | undefined>;
  passkeysFor(memberId: string): Promise<Passkey[]>;
  recordPasskeyUse(id: string, counter: number, at: string): Promise<void>;
  deletePasskeysFor(memberId: string): Promise<void>;

  // sessions: keyed by the cookie token's hash
  createSession(hash: string, s: Session): Promise<void>;
  session(hash: string): Promise<Session | undefined>;
  touchSession(hash: string, lastSeenAt: string, expiresAt: string): Promise<void>;
  deleteSession(hash: string): Promise<void>;
  deleteSessionsFor(memberId: string): Promise<void>;
  sessionsFor(memberId: string): Promise<Session[]>;

  // passkey ceremonies in flight
  // Also clears flows that expired before `now`.
  putFlow(id: string, flow: Flow, now: string): Promise<void>;
  // Returns and deletes it: a flow works once.
  takeFlow(id: string): Promise<Flow | undefined>;

  // ballots
  ballots(planId: string): Promise<Ballot[]>;
  putBallot(planId: string, memberId: string, ranking: string[], at: string): Promise<void>;

  // comments
  getComment(id: string): Promise<Comment | undefined>;
  addComment(c: Comment): Promise<void>;
  commentsFor(planId: string, destinationId: string): Promise<Comment[]>;
  recentComments(planId: string, limit: number): Promise<Comment[]>;
}
