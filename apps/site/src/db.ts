// Site storage. The site keeps published snapshots verbatim and owns only what
// the group creates: ballots and comments (SPEC §2).
import { DatabaseSync } from "node:sqlite";
import { createHash, randomBytes, randomUUID } from "node:crypto";
import type { Ballot, Comment, Member, PlanStatus, Snapshot } from "@wanderlot/core";

const SCHEMA = `
create table if not exists plans (
  id text primary key,
  snapshot text not null,
  status text not null default 'draft',
  vote_deadline text,
  winner_destination_id text,
  published_at text not null
);
create table if not exists members (
  id text primary key,
  name text not null,
  token_hash text unique
);
create table if not exists ballots (
  plan_id text not null references plans(id),
  member_id text not null references members(id),
  ranking text not null,
  cast_at text not null,
  updated_at text not null,
  primary key (plan_id, member_id)
);
create table if not exists comments (
  id text primary key,
  plan_id text not null references plans(id),
  destination_id text not null,
  member_id text not null references members(id),
  parent_id text references comments(id),
  body text not null,
  created_at text not null
);
create index if not exists comments_by_plan on comments(plan_id, created_at);
`;

export interface StoredPlan {
  snapshot: Snapshot;
  status: PlanStatus;
  voteDeadline: string | undefined;
  winnerDestinationId: string | undefined;
}

export const hashToken = (token: string) => createHash("sha256").update(token).digest("hex");

type Row = Record<string, unknown>;

export class SiteDb {
  private db: DatabaseSync;

  constructor(path = ":memory:") {
    this.db = new DatabaseSync(path);
    this.db.exec("pragma foreign_keys = on;");
    this.db.exec(SCHEMA);
  }

  // --- plans ---------------------------------------------------------------

  getPlan(id: string): StoredPlan | undefined {
    const row = this.db.prepare("select * from plans where id = ?").get(id) as Row | undefined;
    if (!row) return undefined;
    return {
      snapshot: JSON.parse(row.snapshot as string) as Snapshot,
      status: row.status as PlanStatus,
      voteDeadline: (row.vote_deadline as string | null) ?? undefined,
      winnerDestinationId: (row.winner_destination_id as string | null) ?? undefined,
    };
  }

  upsertSnapshot(s: Snapshot): void {
    this.db
      .prepare(
        `insert into plans (id, snapshot, published_at) values (?, ?, ?)
         on conflict(id) do update set snapshot = excluded.snapshot, published_at = excluded.published_at`,
      )
      .run(s.plan.id, JSON.stringify(s), s.publishedAt);
  }

  setStatus(planId: string, status: PlanStatus, fields: { voteDeadline?: string; winnerDestinationId?: string | null } = {}) {
    this.db
      .prepare(
        `update plans set status = ?,
           vote_deadline = coalesce(?, vote_deadline),
           winner_destination_id = ?
         where id = ?`,
      )
      .run(status, fields.voteDeadline ?? null, fields.winnerDestinationId ?? null, planId);
  }

  // --- members -------------------------------------------------------------

  // Issues a fresh link token for a member (creating them if new). The raw
  // token is returned once and never stored (SPEC §5).
  issueToken(id: string, name: string): string {
    const token = randomBytes(32).toString("base64url");
    this.db
      .prepare(
        `insert into members (id, name, token_hash) values (?, ?, ?)
         on conflict(id) do update set name = excluded.name, token_hash = excluded.token_hash`,
      )
      .run(id, name, hashToken(token));
    return token;
  }

  memberByToken(token: string): Member | undefined {
    const row = this.db
      .prepare("select id, name from members where token_hash = ?")
      .get(hashToken(token)) as Row | undefined;
    return row ? { id: row.id as string, name: row.name as string } : undefined;
  }

  members(): Member[] {
    return (this.db.prepare("select id, name from members order by name").all() as Row[]).map((r) => ({
      id: r.id as string,
      name: r.name as string,
    }));
  }

  // --- ballots -------------------------------------------------------------

  ballots(planId: string): Ballot[] {
    return (this.db.prepare("select * from ballots where plan_id = ?").all(planId) as Row[]).map((r) => ({
      memberId: r.member_id as string,
      ranking: JSON.parse(r.ranking as string) as string[],
      castAt: r.cast_at as string,
      updatedAt: r.updated_at as string,
    }));
  }

  putBallot(planId: string, memberId: string, ranking: string[], now: string): void {
    this.db
      .prepare(
        `insert into ballots (plan_id, member_id, ranking, cast_at, updated_at) values (?, ?, ?, ?, ?)
         on conflict(plan_id, member_id) do update set ranking = excluded.ranking, updated_at = excluded.updated_at`,
      )
      .run(planId, memberId, JSON.stringify(ranking), now, now);
  }

  // --- comments ------------------------------------------------------------

  getComment(id: string): Comment | undefined {
    const row = this.db.prepare("select * from comments where id = ?").get(id) as Row | undefined;
    return row ? toComment(row) : undefined;
  }

  addComment(c: Omit<Comment, "id">): Comment {
    const id = randomUUID();
    this.db
      .prepare(
        `insert into comments (id, plan_id, destination_id, member_id, parent_id, body, created_at)
         values (?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(id, c.planId, c.destinationId, c.memberId, c.parentId ?? null, c.body, c.createdAt);
    return { ...c, id };
  }

  commentsFor(planId: string, destinationId: string): Comment[] {
    return (
      this.db
        .prepare("select * from comments where plan_id = ? and destination_id = ? order by created_at desc")
        .all(planId, destinationId) as Row[]
    ).map(toComment);
  }

  recentComments(planId: string, limit: number): Comment[] {
    return (
      this.db
        .prepare("select * from comments where plan_id = ? order by created_at desc limit ?")
        .all(planId, limit) as Row[]
    ).map(toComment);
  }
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
