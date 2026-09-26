-- Group settings (name, organiser) and comment likes.
create table if not exists settings (
  key text primary key,
  value text not null
);
create table if not exists comment_likes (
  comment_id text not null references comments(id),
  member_id text not null references members(id),
  created_at text not null,
  primary key (comment_id, member_id)
);
