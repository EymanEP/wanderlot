-- The organiser can send the group somewhere other than the vote's winner
-- (ROADMAP 1.1): winner_destination_id is where they're going, and this says
-- why, when it isn't the vote's winner.
alter table plans add column decided_note text;
