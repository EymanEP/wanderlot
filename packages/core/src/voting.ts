import type { PlanStatus } from "./model.ts";
import { ballotLength, type TallyResult } from "./tally.ts";

// A ballot ranks exactly min(3, n) distinct in-vote destinations (SPEC §4).
export function validateRanking(ranking: readonly string[], inVoteIds: readonly string[]): string | null {
  const need = ballotLength(inVoteIds.length);
  if (inVoteIds.length < 2) return "la votación necesita al menos 2 destinos";
  if (ranking.length !== need) return `hay que ordenar exactamente ${need} destinos`;
  if (new Set(ranking).size !== ranking.length) return "un destino aparece dos veces";
  const allowed = new Set(inVoteIds);
  const unknown = ranking.find((id) => !allowed.has(id));
  if (unknown) return `"${unknown}" no está en la votación`;
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
  // The final result, once closed; winnerId is the organiser's pick after a tie.
  result: (TallyResult & { winnerId: string | null }) | null;
}
