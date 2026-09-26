-- Lockouts escalate for a 4-digit PIN: how many in a row, reset on success.
alter table member_pins add column lockouts integer not null default 0;
