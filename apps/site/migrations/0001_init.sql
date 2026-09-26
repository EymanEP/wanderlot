-- Initial schema. Applied by Wrangler on D1 and by SqliteStore on node:sqlite.
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
  name text not null
);
create table if not exists invites (
  id text primary key,
  member_id text not null references members(id),
  token_hash text not null unique,
  created_at text not null,
  expires_at text not null,
  used_at text,
  cancelled_at text
);
create index if not exists invites_by_member on invites(member_id, created_at);
create table if not exists passkeys (
  id text primary key,
  member_id text not null references members(id),
  public_key text not null,
  counter integer not null,
  transports text not null,
  device text,
  created_at text not null,
  last_used_at text
);
create table if not exists sessions (
  token_hash text primary key,
  member_id text not null references members(id),
  passkey_id text,
  created_at text not null,
  last_seen_at text not null,
  expires_at text not null,
  user_agent text
);
create index if not exists sessions_by_member on sessions(member_id);
create table if not exists flows (
  id text primary key,
  challenge text not null,
  purpose text not null,
  invite_id text,
  expires_at text not null
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
