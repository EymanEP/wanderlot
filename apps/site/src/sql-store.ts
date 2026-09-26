// SiteStore in SQL, once, over any SQLite that can run a query: node:sqlite
// (sqlite.ts) or Cloudflare D1 (d1.ts). Both use the schema in migrations/.
import type { Ballot, Comment, GroupSettings, Member, PlanStatus, Snapshot } from "@wanderlot/core";
import type { Flow, Invite, MemberPin, Passkey, Session, SiteStore, StoredPlan, Suggestion } from "./store.ts";

export type Row = Record<string, unknown>;
export type Value = string | number | null;

export interface Sql {
  get(sql: string, ...args: Value[]): Promise<Row | undefined>;
  all(sql: string, ...args: Value[]): Promise<Row[]>;
  // Returns the number of rows changed.
  run(sql: string, ...args: Value[]): Promise<number>;
}

export class SqlStore implements SiteStore {
  constructor(private sql: Sql) {}

  private get(sql: string, ...args: Value[]) {
    return this.sql.get(sql, ...args);
  }
  private all(sql: string, ...args: Value[]) {
    return this.sql.all(sql, ...args);
  }
  private run(sql: string, ...args: Value[]) {
    return this.sql.run(sql, ...args);
  }

  // --- settings ------------------------------------------------------------

  async settings(): Promise<Partial<GroupSettings>> {
    const rows = await this.all("select key, value from settings");
    return Object.fromEntries(rows.map((r) => [r.key as string, JSON.parse(r.value as string)]));
  }

  async putSettings(s: GroupSettings) {
    await this.run("delete from settings");
    for (const [k, v] of Object.entries(s)) {
      if (v !== undefined) await this.run("insert into settings (key, value) values (?, ?)", k, JSON.stringify(v));
    }
  }

  // --- plans ---------------------------------------------------------------

  async plans() {
    return (await this.all("select * from plans order by published_at desc, rowid desc")).map((row) => ({ id: row.id as string, ...toPlan(row) }));
  }

  async getPlan(id: string): Promise<StoredPlan | undefined> {
    const row = await this.get("select * from plans where id = ?", id);
    return row ? toPlan(row) : undefined;
  }

  async upsertSnapshot(s: Snapshot): Promise<void> {
    await this.run(
      `insert into plans (id, snapshot, published_at) values (?, ?, ?)
       on conflict(id) do update set snapshot = excluded.snapshot, published_at = excluded.published_at`,
      s.plan.id,
      JSON.stringify(s),
      s.publishedAt,
    );
  }

  async setStatus(planId: string, status: PlanStatus, fields: { voteDeadline?: string; winnerDestinationId?: string | null } = {}) {
    await this.run(
      `update plans set status = ?, vote_deadline = coalesce(?, vote_deadline), winner_destination_id = ? where id = ?`,
      status,
      fields.voteDeadline ?? null,
      fields.winnerDestinationId ?? null,
      planId,
    );
  }

  // --- members -------------------------------------------------------------

  async upsertMembers(members: Member[]): Promise<void> {
    for (const m of members) {
      await this.run("insert into members (id, name) values (?, ?) on conflict(id) do update set name = excluded.name", m.id, m.name);
    }
  }

  async members(): Promise<Member[]> {
    return (await this.all("select id, name from members order by name")).map((r) => ({ id: r.id as string, name: r.name as string }));
  }

  async member(id: string): Promise<Member | undefined> {
    const r = await this.get("select id, name from members where id = ?", id);
    return r ? { id: r.id as string, name: r.name as string } : undefined;
  }

  // --- trips ---------------------------------------------------------------

  async planMembers(planId: string): Promise<string[]> {
    return (await this.all("select member_id from plan_members where plan_id = ? order by member_id", planId)).map((r) => r.member_id as string);
  }

  async setPlanMembers(planId: string, memberIds: string[]) {
    await this.run("delete from plan_members where plan_id = ?", planId);
    for (const id of memberIds) await this.run("insert or ignore into plan_members (plan_id, member_id) values (?, ?)", planId, id);
  }

  async planIdsFor(memberId: string): Promise<string[]> {
    return (await this.all("select plan_id from plan_members where member_id = ?", memberId)).map((r) => r.plan_id as string);
  }

  // --- suggestions ---------------------------------------------------------

  async addSuggestion(s: Suggestion) {
    await this.run(
      "insert into suggestions (id, plan_id, member_id, place, note, created_at, status, proposal_id) values (?, ?, ?, ?, ?, ?, ?, ?)",
      s.id,
      s.planId,
      s.memberId,
      s.place,
      s.note,
      s.createdAt,
      s.status,
      s.proposalId,
    );
  }

  async suggestions(planId: string): Promise<Suggestion[]> {
    return (await this.all("select * from suggestions where plan_id = ? order by created_at, rowid", planId)).map((r) => ({
      id: r.id as string,
      planId: r.plan_id as string,
      memberId: r.member_id as string,
      place: r.place as string,
      note: (r.note as string | null) ?? null,
      createdAt: r.created_at as string,
      status: r.status as Suggestion["status"],
      proposalId: (r.proposal_id as string | null) ?? null,
    }));
  }

  async setSuggestionStatus(id: string, status: Suggestion["status"], proposalId: string | null) {
    await this.run("update suggestions set status = ?, proposal_id = coalesce(?, proposal_id) where id = ?", status, proposalId, id);
  }

  // --- PINs ----------------------------------------------------------------

  async pin(memberId: string): Promise<MemberPin | undefined> {
    const r = await this.get("select * from member_pins where member_id = ?", memberId);
    return r
      ? { hash: r.hash as string, salt: r.salt as string, setAt: r.set_at as string, failed: r.failed as number, lockedUntil: (r.locked_until as string | null) ?? null, lockouts: (r.lockouts as number | null) ?? 0 }
      : undefined;
  }

  async setPin(memberId: string, hash: string, salt: string, at: string) {
    await this.run(
      `insert into member_pins (member_id, hash, salt, set_at, failed, locked_until) values (?, ?, ?, ?, 0, null)
       on conflict(member_id) do update set hash = excluded.hash, salt = excluded.salt, set_at = excluded.set_at, failed = 0, locked_until = null, lockouts = 0`,
      memberId,
      hash,
      salt,
      at,
    );
  }

  async recordPinFailure(memberId: string, failed: number, lockedUntil: string | null, lockouts: number) {
    await this.run("update member_pins set failed = ?, locked_until = ?, lockouts = ? where member_id = ?", failed, lockedUntil, lockouts, memberId);
  }

  async deletePin(memberId: string) {
    await this.run("delete from member_pins where member_id = ?", memberId);
  }

  // --- invites -------------------------------------------------------------

  async createInvite(i: { id: string; memberId: string; tokenHash: string; createdAt: string; expiresAt: string }) {
    await this.run(
      "insert into invites (id, member_id, token_hash, created_at, expires_at) values (?, ?, ?, ?, ?)",
      i.id,
      i.memberId,
      i.tokenHash,
      i.createdAt,
      i.expiresAt,
    );
  }

  async inviteByTokenHash(hash: string) {
    const r = await this.get("select * from invites where token_hash = ?", hash);
    return r ? toInvite(r) : undefined;
  }

  async latestInvite(memberId: string) {
    const r = await this.get("select * from invites where member_id = ? order by created_at desc, rowid desc limit 1", memberId);
    return r ? toInvite(r) : undefined;
  }

  async useInvite(id: string, at: string) {
    return (await this.run("update invites set used_at = ? where id = ? and used_at is null and cancelled_at is null", at, id)) === 1;
  }

  async cancelPendingInvites(memberId: string, at: string) {
    await this.run("update invites set cancelled_at = ? where member_id = ? and used_at is null and cancelled_at is null", at, memberId);
  }

  // --- passkeys ------------------------------------------------------------

  async addPasskey(p: Passkey) {
    await this.run(
      `insert into passkeys (id, member_id, public_key, counter, transports, device, created_at, last_used_at)
       values (?, ?, ?, ?, ?, ?, ?, ?)`,
      p.id,
      p.memberId,
      p.publicKey,
      p.counter,
      JSON.stringify(p.transports),
      p.device,
      p.createdAt,
      p.lastUsedAt,
    );
  }

  async passkey(id: string) {
    const r = await this.get("select * from passkeys where id = ?", id);
    return r ? toPasskey(r) : undefined;
  }

  async passkeysFor(memberId: string) {
    return (await this.all("select * from passkeys where member_id = ? order by created_at, rowid", memberId)).map(toPasskey);
  }

  async recordPasskeyUse(id: string, counter: number, at: string) {
    await this.run("update passkeys set counter = ?, last_used_at = ? where id = ?", counter, at, id);
  }

  async deletePasskeysFor(memberId: string) {
    await this.run("delete from passkeys where member_id = ?", memberId);
  }

  // --- sessions ------------------------------------------------------------

  async createSession(hash: string, s: Session) {
    await this.run(
      `insert into sessions (token_hash, member_id, passkey_id, created_at, last_seen_at, expires_at, user_agent)
       values (?, ?, ?, ?, ?, ?, ?)`,
      hash,
      s.memberId,
      s.passkeyId,
      s.createdAt,
      s.lastSeenAt,
      s.expiresAt,
      s.userAgent,
    );
  }

  async session(hash: string) {
    const r = await this.get("select * from sessions where token_hash = ?", hash);
    return r ? toSession(r) : undefined;
  }

  async touchSession(hash: string, lastSeenAt: string, expiresAt: string) {
    await this.run("update sessions set last_seen_at = ?, expires_at = ? where token_hash = ?", lastSeenAt, expiresAt, hash);
  }

  async deleteSession(hash: string) {
    await this.run("delete from sessions where token_hash = ?", hash);
  }

  async deleteSessionsFor(memberId: string) {
    await this.run("delete from sessions where member_id = ?", memberId);
  }

  async sessionsFor(memberId: string) {
    return (await this.all("select * from sessions where member_id = ? order by last_seen_at desc, rowid desc", memberId)).map(toSession);
  }

  // --- flows ---------------------------------------------------------------

  async putFlow(id: string, f: Flow, now: string) {
    // Abandoned flows are cleared as new ones start.
    await this.run("delete from flows where expires_at < ?", now);
    await this.run("insert into flows (id, challenge, purpose, invite_id, expires_at) values (?, ?, ?, ?, ?)", id, f.challenge, f.purpose, f.inviteId, f.expiresAt);
  }

  async takeFlow(id: string) {
    // One statement, so two concurrent requests can't both take it.
    const r = await this.get("delete from flows where id = ? returning *", id);
    if (!r) return undefined;
    return {
      challenge: r.challenge as string,
      purpose: r.purpose as Flow["purpose"],
      inviteId: (r.invite_id as string | null) ?? null,
      expiresAt: r.expires_at as string,
    };
  }

  // --- ballots -------------------------------------------------------------

  async ballots(planId: string): Promise<Ballot[]> {
    return (await this.all("select * from ballots where plan_id = ?", planId)).map((r) => ({
      memberId: r.member_id as string,
      ranking: JSON.parse(r.ranking as string) as string[],
      castAt: r.cast_at as string,
      updatedAt: r.updated_at as string,
    }));
  }

  async putBallot(planId: string, memberId: string, ranking: string[], at: string) {
    await this.run(
      `insert into ballots (plan_id, member_id, ranking, cast_at, updated_at) values (?, ?, ?, ?, ?)
       on conflict(plan_id, member_id) do update set ranking = excluded.ranking, updated_at = excluded.updated_at`,
      planId,
      memberId,
      JSON.stringify(ranking),
      at,
      at,
    );
  }

  // --- comments ------------------------------------------------------------

  async getComment(id: string) {
    const r = await this.get("select * from comments where id = ?", id);
    return r ? toComment(r) : undefined;
  }

  async addComment(c: Comment) {
    await this.run(
      "insert into comments (id, plan_id, destination_id, member_id, parent_id, body, created_at) values (?, ?, ?, ?, ?, ?, ?)",
      c.id,
      c.planId,
      c.destinationId,
      c.memberId,
      c.parentId ?? null,
      c.body,
      c.createdAt,
    );
  }

  async comments(planId: string, opts: { destinationId?: string; limit?: number } = {}) {
    const args: Value[] = [planId];
    let sql = "select * from comments where plan_id = ?";
    if (opts.destinationId) {
      sql += " and destination_id = ?";
      args.push(opts.destinationId);
    }
    sql += " order by created_at desc, rowid desc";
    if (opts.limit) {
      sql += " limit ?";
      args.push(opts.limit);
    }
    return (await this.all(sql, ...args)).map(toComment);
  }

  async setLike(commentId: string, memberId: string, on: boolean, at: string) {
    if (on) await this.run("insert into comment_likes (comment_id, member_id, created_at) values (?, ?, ?) on conflict do nothing", commentId, memberId, at);
    else await this.run("delete from comment_likes where comment_id = ? and member_id = ?", commentId, memberId);
  }

  async likes(planId: string, memberId: string) {
    const rows = await this.all(
      `select l.comment_id as id, count(*) as n, sum(case when l.member_id = ? then 1 else 0 end) as mine
       from comment_likes l join comments c on c.id = l.comment_id
       where c.plan_id = ? group by l.comment_id`,
      memberId,
      planId,
    );
    return new Map(rows.map((r) => [r.id as string, { count: Number(r.n), mine: Number(r.mine) > 0 }]));
  }
}

function toPlan(row: Row): StoredPlan {
  return {
    snapshot: JSON.parse(row.snapshot as string) as Snapshot,
    status: row.status as PlanStatus,
    voteDeadline: (row.vote_deadline as string | null) ?? undefined,
    winnerDestinationId: (row.winner_destination_id as string | null) ?? undefined,
  };
}

function toInvite(r: Row): Invite {
  return {
    id: r.id as string,
    memberId: r.member_id as string,
    createdAt: r.created_at as string,
    expiresAt: r.expires_at as string,
    usedAt: (r.used_at as string | null) ?? null,
    cancelledAt: (r.cancelled_at as string | null) ?? null,
  };
}

function toPasskey(r: Row): Passkey {
  return {
    id: r.id as string,
    memberId: r.member_id as string,
    publicKey: r.public_key as string,
    counter: Number(r.counter),
    transports: JSON.parse(r.transports as string) as string[],
    device: (r.device as string | null) ?? null,
    createdAt: r.created_at as string,
    lastUsedAt: (r.last_used_at as string | null) ?? null,
  };
}

function toSession(r: Row): Session {
  return {
    memberId: r.member_id as string,
    passkeyId: (r.passkey_id as string | null) ?? null,
    createdAt: r.created_at as string,
    lastSeenAt: r.last_seen_at as string,
    expiresAt: r.expires_at as string,
    userAgent: (r.user_agent as string | null) ?? null,
  };
}

function toComment(r: Row): Comment {
  const c: Comment = {
    id: r.id as string,
    planId: r.plan_id as string,
    destinationId: r.destination_id as string,
    memberId: r.member_id as string,
    body: r.body as string,
    createdAt: r.created_at as string,
  };
  if (r.parent_id) c.parentId = r.parent_id as string;
  return c;
}
