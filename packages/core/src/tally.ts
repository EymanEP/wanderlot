// Borda count over the top three (SPEC §4).
export const POINTS = [3, 2, 1] as const;

export interface TallyOption {
  id: string;
  totalPerPersonCents: number;
}

export interface TallyRow {
  id: string;
  points: number;
  firsts: number;
  totalPerPersonCents: number;
  rank: number; // 1-based; equal ranks mean an unbroken tie
}

export interface TallyResult {
  rows: TallyRow[];
  winnerId: string | null; // null when first place is an unbroken tie
  tiedForFirst: string[];
}

export function ballotLength(optionCount: number): number {
  return Math.min(POINTS.length, optionCount);
}

// Ballots must already be valid (see validateRanking).
export function tally(options: readonly TallyOption[], rankings: readonly string[][]): TallyResult {
  const rows = new Map<string, TallyRow>(
    options.map((o) => [
      o.id,
      { id: o.id, points: 0, firsts: 0, totalPerPersonCents: o.totalPerPersonCents, rank: 0 },
    ]),
  );
  for (const ranking of rankings) {
    ranking.forEach((optionId, i) => {
      const row = rows.get(optionId);
      if (!row) throw new Error(`ballot names unknown option ${optionId}`);
      row.points += POINTS[i] ?? 0;
      if (i === 0) row.firsts += 1;
    });
  }

  const cmp = (a: TallyRow, b: TallyRow) =>
    b.points - a.points || b.firsts - a.firsts || a.totalPerPersonCents - b.totalPerPersonCents;
  // Stable order for display within a genuine tie.
  const sorted = [...rows.values()].sort((a, b) => cmp(a, b) || a.id.localeCompare(b.id));

  sorted.forEach((row, i) => {
    const prev = sorted[i - 1];
    row.rank = prev && cmp(prev, row) === 0 ? prev.rank : i + 1;
  });

  const tiedForFirst = sorted.filter((r) => r.rank === 1).map((r) => r.id);
  return {
    rows: sorted,
    winnerId: tiedForFirst.length === 1 ? tiedForFirst[0]! : null,
    tiedForFirst: tiedForFirst.length > 1 ? tiedForFirst : [],
  };
}
