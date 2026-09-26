# Contributing to Wanderlot

Thanks for helping. Wanderlot is small on purpose: one self-hosted deployment
per group of friends, free to run. Changes that keep it that way are the
easiest to accept.

Before building something big, open an issue to talk it through. Bug fixes,
tests and docs can go straight to a pull request.

## Getting started

You need Node 22.13 or newer.

```sh
npm install
npx playwright install chromium   # once, for the end-to-end tests
```

The quickest way to see the UIs is on the mock data, with no servers or keys:

```sh
VITE_DATA=mock npm run dev:web -w @wanderlot/site    # the friends' site
VITE_DATA=mock npm run dev:web -w @wanderlot/panel   # the organiser's panel
npm run dev -w @wanderlot/ui                         # every component, in every state
```

To run everything for real (API servers, PINs and passkeys), see
[Running](README.md#running) in the README.

## Before you open a pull request

```sh
npm run typecheck
npm test            # unit tests: vitest, all packages
npm run test:e2e    # Chromium: panel → site → a friend's passkey
```

CI runs the same checks, plus the site against the Cloudflare Worker
(`npm run test:e2e:worker -w @wanderlot/site`, no account needed).

## How the code is laid out

- `packages/core`: the data model (zod), voting and tally rules, and display
  helpers. The published snapshot is the contract between panel and site.
- `packages/ui`: the design system. Build screens from these components, and
  add to them rather than styling one-offs in an app.
- `packages/mocks`: the demo data behind previews and UI tests.
- `apps/site`: the published site (Hono on Node or Cloudflare Workers + D1)
  and its React UI in `web/`.
- `apps/panel`: the organiser's local panel. Outside services (research,
  flights, photos) sit behind the interfaces in `src/providers/`.

[`docs/SPEC.md`](docs/SPEC.md) is the design. If your change alters behaviour
it describes, update it in the same pull request.

## Conventions

- **Language.** The site and the panel speak Spanish (Spain): their UI text
  and the group-chat messages they write. Everything a hoster or developer
  reads is in English: the setup and deploy scripts, server errors and logs,
  code, comments, docs and commits. Translating the UI is welcome, but open
  an issue first.
- **TypeScript, ESM, strict.** Validate anything that crosses a boundary (API
  bodies, AI output, third-party responses) with zod.
- **Tests with the change.** Server and rule changes come with unit tests.
  Screen changes come with a UI test (Testing Library on the mocks), and an
  end-to-end step if they change a real flow.
- **No network in tests.** Fake outside services with recorded response
  shapes, as the provider tests do.
- **Comments say why**, not what.
- **Commits** have a short imperative subject ("Add …", "Fix …") and a body
  saying why, when that isn't obvious.

## Things we're careful about

- **Trust labels.** Anything from AI research stays labelled "Lo escribió
  Claude" until a flight API confirms it (SPEC §3). Don't blur that line.
- **Photos.** They come only from Unsplash, Pexels and Wikimedia Commons,
  with credits. Claude suggests what to search for; it never supplies image
  URLs (SPEC §6).
- **The vote.** Nobody sees the count, the organiser included, until it
  closes (SPEC §4).
- **Who sees what.** A friend sees only the trips they're on (SPEC §5).
- **Security.** Sign-in is one-time invites plus a PIN (or a passkey), with
  lockout (SPEC §5); the site sends a strict CSP, and the panel only answers
  its own pages. Report
  vulnerabilities privately; see [SECURITY.md](SECURITY.md).

## Licence

Wanderlot is MIT licensed. By contributing, you agree your contributions are
released under the same licence.
