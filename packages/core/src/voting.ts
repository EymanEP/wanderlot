import type { PlanStatus } from "./model.ts";
import { ballotLength, type TallyResult } from "./tally.ts";
import { copy, currentLocale, pick, type Locale } from "./i18n.ts";

const RANKING = copy({
  es: {
    tooFew: "la votación necesita al menos 2 destinos",
    length: (n: number) => `hay que ordenar exactamente ${n} destinos`,
    twice: "un destino aparece dos veces",
    unknown: (id: string) => `"${id}" no está en la votación`,
  },
  en: {
    tooFew: "voting needs at least 2 destinations",
    length: (n: number) => `you have to rank exactly ${n} destinations`,
    twice: "a destination appears twice",
    unknown: (id: string) => `"${id}" isn't in the vote`,
  },
});

// A ballot ranks exactly min(3, n) distinct in-vote destinations (SPEC §4).
export function validateRanking(ranking: readonly string[], inVoteIds: readonly string[], l: Locale = currentLocale()): string | null {
  const t = pick(RANKING, l);
  const need = ballotLength(inVoteIds.length);
  if (inVoteIds.length < 2) return t.tooFew;
  if (ranking.length !== need) return t.length(need);
  if (new Set(ranking).size !== ranking.length) return t.twice;
  const allowed = new Set(inVoteIds);
  const unknown = ranking.find((id) => !allowed.has(id));
  if (unknown) return t.unknown(unknown);
  return null;
}

export interface VoteClock {
  status: PlanStatus;
  voteDeadline?: string | undefined;
  partySize: number;
  ballotsCast: number;
}

// The status a plan should have now. Closing is checked on every read, so no
// scheduler is needed: the sixth ballot or the deadline closes it.
export function effectiveStatus(c: VoteClock, now: Date): PlanStatus {
  if (c.status !== "voting") return c.status;
  if (c.ballotsCast >= c.partySize) return "closed";
  if (c.voteDeadline && now.getTime() >= Date.parse(c.voteDeadline)) return "closed";
  return "voting";
}

// Once the first ballot is cast, the destination set and every inVote flag
// are frozen; content may still change (SPEC §2, publish rules).
export function freezeViolation(
  published: readonly { id: string; inVote: boolean }[],
  next: readonly { id: string; inVote: boolean }[],
): string | null {
  const key = (ds: readonly { id: string; inVote: boolean }[]) =>
    ds.map((d) => `${d.id}:${d.inVote}`).sort().join(",");
  if (key(published) === key(next)) return null;
  return "la votación ya tiene papeletas: no se pueden añadir, quitar ni cambiar destinos de la votación";
}

// What the organiser sees of a vote in the panel (SPEC §4, §7). Friends see
// only who has voted until it closes; the organiser follows the count and
// every ballot live.
export interface VoteState {
  status: PlanStatus;
  voteDeadline: string | null;
  partySize: number;
  voted: string[];
  // The running count, from the ballots so far.
  tally: TallyResult;
  // Each ballot, most recently changed first.
  ballots: { memberId: string; ranking: string[]; updatedAt: string }[];
  // The final result, once closed. winnerId is where they're going: the
  // vote's winner, the organiser's pick after a tie, or another destination
  // the organiser chose (then voteWinnerId is the vote's own and decidedNote
  // says why). Older sites leave the last two out.
  result: (TallyResult & { winnerId: string | null; voteWinnerId?: string | null; decidedNote?: string | null }) | null;
}
