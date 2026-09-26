# Security

## Reporting a vulnerability

Please don't open a public issue. Report it privately through GitHub:
**Security → Report a vulnerability** on this repository. Include what you
found, how to reproduce it, and what an attacker could do with it.

You'll get a reply within a week. Once a fix is out, we'll credit you in the
release notes unless you'd rather not be named.

## What's in scope

- **The published site** (`apps/site`): invites, passkeys, sessions, the
  admin API, voting rules, and anything that leaks one friend's data to
  another or to outsiders.
- **The local panel** (`apps/panel`): anything that lets a web page, another
  user on the machine, or AI research output drive the panel or reach its
  keys.

The design, including what each part is trusted to do, is in
[`docs/SPEC.md`](docs/SPEC.md) (§5 access, §9 APIs).

## Running your own copy

Each group hosts its own deployment, so its safety is partly in the hoster's
hands:

- Keep `ADMIN_TOKEN` and `.env` private. Anyone with the token controls the
  site.
- Set the site's final address (`ORIGIN`) before inviting anyone, because
  passkeys are tied to it.
- Run `npm run deploy:site` again after pulling updates.
