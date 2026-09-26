-- Destinations friends suggest for a trip; the organiser researches them.
create table if not exists suggestions (
  id text primary key,
  plan_id text not null,
  member_id text not null references members(id),
  place text not null,
  note text,
  created_at text not null,
  -- new · researched · dismissed
  status text not null default 'new',
  proposal_id text
);
create index if not exists suggestions_by_plan on suggestions(plan_id, created_at);
