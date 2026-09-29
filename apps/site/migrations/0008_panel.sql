-- The panel's own data, kept by the site so the laptop and the panel served
-- at /admin share it (ROADMAP 3.1, 3.2). Friends never read these tables.

-- One row per trip: everything the panel keeps (proposals, notes, drafts),
-- as JSON, with a version so two devices can't overwrite each other.
create table if not exists panel_plans (
  plan_id text primary key,
  entry text not null,
  version integer not null,
  updated_at text not null
);

-- Unused invite links, to copy again: encrypted with the admin token.
create table if not exists panel_invites (
  member_id text primary key,
  sealed text not null,
  expires_at text not null
);

-- The password for /admin (one row), and its sign-in lockouts.
create table if not exists organiser (
  id integer primary key check (id = 1),
  password_hash text not null,
  salt text not null,
  set_at text not null,
  failed integer not null default 0,
  locked_until text,
  lockouts integer not null default 0
);

create table if not exists organiser_sessions (
  token_hash text primary key,
  created_at text not null,
  last_seen_at text not null,
  expires_at text not null,
  user_agent text
);
