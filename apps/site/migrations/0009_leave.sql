-- Days off (vacaciones): whether each person on a trip has the trip's days
-- off work. An answer is for the dates it was given for.
create table if not exists leave_answers (
  plan_id text not null,
  member_id text not null references members(id),
  -- not-asked · asked · approved · denied
  status text not null,
  date_from text not null,
  date_to text not null,
  -- member · organiser
  set_by text not null default 'member',
  updated_at text not null,
  primary key (plan_id, member_id)
);
