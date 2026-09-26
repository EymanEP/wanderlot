// Editing "Tu reparto": at most three destinations, in order (SPEC §4).
export const MAX_PICKS = 3;

export function moveUp(r: readonly string[], i: number): string[] {
  if (i <= 0 || i >= r.length) return [...r];
  const next = [...r];
  [next[i - 1], next[i]] = [next[i]!, next[i - 1]!];
  return next;
}

export function moveDown(r: readonly string[], i: number): string[] {
  return i < 0 || i >= r.length - 1 ? [...r] : moveUp(r, i + 1);
}

export function remove(r: readonly string[], id: string): string[] {
  return r.filter((x) => x !== id);
}

// With a free slot the destination goes last; with all three taken it
// replaces the third ("Al meter uno, sale el que esté en 3.ª posición").
export function add(r: readonly string[], id: string, max = MAX_PICKS): string[] {
  if (r.includes(id)) return [...r];
  return r.length < max ? [...r, id] : [...r.slice(0, max - 1), id];
}

// The points a destination would get if added now.
export function pointsIfAdded(r: readonly string[], max = MAX_PICKS): number {
  return max - Math.min(r.length, max - 1);
}

export function isComplete(r: readonly string[], optionCount: number): boolean {
  return r.length === Math.min(MAX_PICKS, optionCount);
}

export function sameRanking(a: readonly string[], b: readonly string[]): boolean {
  return a.length === b.length && a.every((x, i) => x === b[i]);
}
