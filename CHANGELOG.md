# Changelog

## 1.0.0 — 2026-10-06

The first release: everything a group of friends needs to plan a trip
together, from "where shall we go?" to the booked trip.

### The organiser's panel

- Create a trip: name, origin, who goes and a budget per person. Decide the
  dates first, or the place and its dates together (a month or two and how
  many nights; each proposal brings its own dates).
- Research destinations with Claude (the `claude` CLI, Anthropic's API),
  OpenAI or any OpenAI-compatible endpoint, or add them by hand. Flights
  verified with Duffel, photos from Unsplash or Pexels.
- Review, approve or discard proposals; type in checked prices, paste a
  screenshot for the AI to read, or check the finalists in your own browser.
- Compare finalists side by side, then publish to the friends' site.
- Follow the vote live, remind people, close it early, break ties, and send
  the result to WhatsApp in the group's language.
- Personas: invites, PINs, who goes on each trip, closing sessions and
  removing access.
- Export a trip, or everything, as one JSON file.
- Also served by the site at `/admin` (without AI), for managing from a phone.

### The friends' site

- Join from a one-time invite with a 4-digit PIN (a passkey is optional);
  installable on the home screen.
- Cuándo: say yes, if need be or no to each date option, and track who has
  the days off.
- Dónde: read the proposals, comment, like, suggest destinations and rank
  your top three (Borda count).
- El viaje: flights, stay, each person's share including getting to the
  airport (with several ways to choose from), what to do and what to know
  before you go, plus a Tricount link for the money.
- In Spanish and English.

### Hosting

- One deployment per group, free on Cloudflare Workers + D1 (or Node with
  `node:sqlite`). `npm run setup` deploys the site and connects the panel;
  `npm run deploy:site` after pulling new code.
