-- The date vote (ROADMAP 2.1): the windows the organiser proposed, and each
-- person's answers. A trip without one has no rows here.
create table if not exists date_polls (
  plan_id text primary key,
  -- JSON: [{ id, dateFrom, dateTo }]
  options text not null,
  deadline text,
  -- open · closed
  status text not null default 'open',
  chosen_option_id text,
  updated_at text not null
);
create table if not exists date_answers (
  plan_id text not null,
  member_id text not null references members(id),
  -- JSON: { optionId: yes | maybe | no }
  answers text not null,
  note text,
  updated_at text not null,
  primary key (plan_id, member_id)
);
