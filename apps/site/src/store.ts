// What the site keeps, behind one async interface: node:sqlite implements it
// (sqlite.ts) and Cloudflare D1 (d1.ts) implement it, from the same migrations/.
import type { Ballot, Comment, DateAnswer, DateOption, DateResponse, GroupSettings, Member, PlanStatus, Snapshot } from "@wanderlot/core";

export interface StoredPlan {
  snapshot: Snapshot;
  status: PlanStatus;
  voteDeadline: string | undefined;
  winnerDestinationId: string | undefined;
  decidedNote: string | undefined;
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

export interface MemberPin {
  hash: string;
  salt: string;
  setAt: string;
  failed: number;
  lockedUntil: string | null;
  // Lockouts in a row; each lasts longer than the last.
  lockouts: number;
}

export interface Suggestion {
  id: string;
  planId: string;
  memberId: string;
  place: string;
  note: string | null;
  createdAt: string;
  status: "new" | "researched" | "dismissed";
  proposalId: string | null;
}

export interface Flow {
  challenge: string;
  purpose: "register" | "login";
  inviteId: string | null;
  expiresAt: string;
}

export interface DatePoll {
  options: DateOption[];
  deadline: string | null;
  status: "open" | "closed";
  chosenOptionId: string | null;
  updatedAt: string;
}

// The /admin password (ROADMAP 3.1) and its lockouts, like a PIN's.
export interface OrganiserLogin {
  hash: string;
  salt: string;
  setAt: string;
  failed: number;
  lockedUntil: string | null;
  lockouts: number;
}

export interface OrganiserSession {
  createdAt: string;
  lastSeenAt: string;
  expiresAt: string;
  userAgent: string | null;
}

export interface SiteStore {
  // settings
  settings(): Promise<Partial<GroupSettings>>;
  putSettings(s: GroupSettings): Promise<void>;

  // plans
  getPlan(id: string): Promise<StoredPlan | undefined>;
  plans(): Promise<(StoredPlan & { id: string })[]>;
  upsertSnapshot(s: Snapshot): Promise<void>;
  // A trip and everything hanging off it: ballots, comments, likes, ideas, who goes.
  deletePlan(planId: string): Promise<boolean>;
  // Clears the decision's note unless one is given.
  setStatus(planId: string, status: PlanStatus, fields?: { voteDeadline?: string; winnerDestinationId?: string | null; decidedNote?: string | null }): Promise<void>;

  // members
  upsertMembers(members: Member[]): Promise<void>;
  members(): Promise<Member[]>;
  member(id: string): Promise<Member | undefined>;

  // who is on each trip (SPEC §5): a member sees only their trips
  planMembers(planId: string): Promise<string[]>;
  setPlanMembers(planId: string, memberIds: string[]): Promise<void>;
  planIdsFor(memberId: string): Promise<string[]>;

  // destinations friends suggest for a trip, oldest first
  addSuggestion(s: Suggestion): Promise<void>;
  suggestions(planId: string): Promise<Suggestion[]>;
  setSuggestionStatus(id: string, status: Suggestion["status"], proposalId: string | null): Promise<void>;

  // PINs: stored as a keyed hash, never the PIN itself
  pin(memberId: string): Promise<MemberPin | undefined>;
  setPin(memberId: string, hash: string, salt: string, at: string): Promise<void>;
  recordPinFailure(memberId: string, failed: number, lockedUntil: string | null, lockouts: number): Promise<void>;
  deletePin(memberId: string): Promise<void>;

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
  // Newest first; optionally one destination's, optionally only the latest few.
  comments(planId: string, opts?: { destinationId?: string; limit?: number }): Promise<Comment[]>;
  setLike(commentId: string, memberId: string, on: boolean, at: string): Promise<void>;
  // Like counts for a plan's comments, and which ones this member liked.
  likes(planId: string, memberId: string): Promise<Map<string, { count: number; mine: boolean }>>;
  // The date vote (ROADMAP 2.1).
  datePoll(planId: string): Promise<DatePoll | undefined>;
  putDatePoll(planId: string, poll: DatePoll): Promise<void>;
  // Removes the vote and its answers.
  deleteDatePoll(planId: string): Promise<void>;
  dateResponses(planId: string): Promise<DateResponse[]>;
  putDateResponse(planId: string, memberId: string, answers: Record<string, DateAnswer>, note: string | null, at: string): Promise<void>;

  // The panel's own data (ROADMAP 3.2): one JSON entry per trip, versioned.
  panelVersions(): Promise<Record<string, number>>;
  panelPlan(planId: string): Promise<{ entry: string; version: number } | undefined>;
  // Writes if the stored version is still `version` (0: not there yet);
  // null deletes. Resolves to the new version, or null on a conflict.
  savePanelPlan(planId: string, entry: string | null, version: number, at: string): Promise<number | null>;
  panelInvites(): Promise<{ memberId: string; sealed: string; expiresAt: string }[]>;
  savePanelInvite(memberId: string, sealed: string | null, expiresAt: string | null): Promise<void>;

  // The panel at /admin (ROADMAP 3.1).
  organiserLogin(): Promise<OrganiserLogin | undefined>;
  setOrganiserLogin(login: { hash: string; salt: string; setAt: string } | null): Promise<void>;
  recordOrganiserFailure(failed: number, lockedUntil: string | null, lockouts: number): Promise<void>;
  createOrganiserSession(hash: string, s: OrganiserSession): Promise<void>;
  organiserSession(hash: string): Promise<OrganiserSession | undefined>;
  touchOrganiserSession(hash: string, lastSeenAt: string, expiresAt: string): Promise<void>;
  deleteOrganiserSession(hash: string): Promise<void>;
  deleteOrganiserSessions(): Promise<void>;

  // Who liked what in a plan, for the export.
  commentLikes(planId: string): Promise<{ commentId: string; memberId: string; createdAt: string }[]>;
}
