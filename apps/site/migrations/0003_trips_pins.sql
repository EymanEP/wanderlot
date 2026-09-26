-- Who is on each trip, and PIN sign-in.
create table if not exists plan_members (
  plan_id text not null,
  member_id text not null references members(id),
  primary key (plan_id, member_id)
);
create index if not exists plan_members_by_member on plan_members(member_id);
-- Until now every member saw every plan: keep it that way for existing ones.
insert or ignore into plan_members (plan_id, member_id) select p.id, m.id from plans p cross join members m;

create table if not exists member_pins (
  member_id text primary key references members(id),
  -- HMAC-SHA256 of the PIN with a per-member salt and a server-side secret.
  hash text not null,
  salt text not null,
  set_at text not null,
  failed integer not null default 0,
  locked_until text
);
