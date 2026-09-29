// Cuándo (ROADMAP 2.1): agreeing on dates. The organiser proposes 2–5 date
// windows; each person answers yes, "if need be" or no for each, like a
// Doodle. Nothing is ranked: the organiser reads the table and chooses.
import { z } from "zod";

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "YYYY-MM-DD");

export const MIN_DATE_OPTIONS = 2;
export const MAX_DATE_OPTIONS = 5;

export const DateAnswer = z.enum(["yes", "maybe", "no"]);
export type DateAnswer = z.infer<typeof DateAnswer>;

// A window's id is its dates, so editing the windows keeps the answers to
// the ones that stay.
export const DateOption = z.object({ id: z.string(), dateFrom: isoDate, dateTo: isoDate });
export type DateOption = z.infer<typeof DateOption>;

export function dateOptionId(dateFrom: string, dateTo: string): string {
  return `${dateFrom}_${dateTo}`;
}

export function nightsOf(o: { dateFrom: string; dateTo: string }): number {
  return Math.round((Date.parse(`${o.dateTo}T12:00:00Z`) - Date.parse(`${o.dateFrom}T12:00:00Z`)) / 86_400_000);
}

// What the organiser proposes: 2–5 distinct windows of 1–30 nights, in order.
export const DateWindows = z
  .array(z.object({ dateFrom: isoDate, dateTo: isoDate }))
  .min(MIN_DATE_OPTIONS, `Propón al menos ${MIN_DATE_OPTIONS} opciones`)
  .max(MAX_DATE_OPTIONS, `Como mucho ${MAX_DATE_OPTIONS} opciones`)
  .superRefine((ws, ctx) => {
    const seen = new Set<string>();
    for (const w of ws) {
      const n = nightsOf(w);
      if (!(n >= 1 && n <= 30)) ctx.addIssue({ code: "custom", message: "Cada opción va de 1 a 30 noches" });
      const key = dateOptionId(w.dateFrom, w.dateTo);
      if (seen.has(key)) ctx.addIssue({ code: "custom", message: "Hay dos opciones con las mismas fechas" });
      seen.add(key);
    }
  })
  .transform((ws) => [...ws].sort((a, b) => a.dateFrom.localeCompare(b.dateFrom) || a.dateTo.localeCompare(b.dateTo)).map((w) => ({ id: dateOptionId(w.dateFrom, w.dateTo), ...w })));

export interface DateResponse {
  memberId: string;
  answers: Record<string, DateAnswer>;
  // "Tengo que pedirlo antes del 15": one note per person, for all windows.
  note: string | null;
  updatedAt: string;
}

// The date vote as the site hands it out: to the organiser, and to everyone
// on the trip, who all see who can go when.
export interface DatesView {
  status: "open" | "closed";
  options: DateOption[];
  // Informative: answering stays open until the organiser chooses.
  deadline: string | null;
  chosenOptionId: string | null;
  responses: DateResponse[];
}

export interface DateOptionCount {
  id: string;
  yes: number;
  maybe: number;
  no: number;
}

// Per window: how many can, could and can't go. Windows added after someone
// answered count as unanswered for them.
export function dateCounts(view: Pick<DatesView, "options" | "responses">): DateOptionCount[] {
  return view.options.map((o) => {
    const count = { id: o.id, yes: 0, maybe: 0, no: 0 };
    for (const r of view.responses) {
      const a = r.answers[o.id];
      if (a) count[a]++;
    }
    return count;
  });
}

// The windows that suit the group best: most yes, then fewest no, then most
// "if need be". Empty until someone has answered.
export function bestDateOptions(view: Pick<DatesView, "options" | "responses">): string[] {
  const counts = dateCounts(view).filter((c) => c.yes + c.maybe + c.no > 0);
  if (!counts.length) return [];
  const key = (c: DateOptionCount) => [c.yes, -c.no, c.maybe];
  const better = (a: DateOptionCount, b: DateOptionCount) => {
    const [x, y] = [key(a), key(b)];
    for (let i = 0; i < 3; i++) if (x[i] !== y[i]) return x[i]! > y[i]!;
    return false;
  };
  const top = counts.reduce((best, c) => (better(c, best) ? c : best));
  return counts.filter((c) => !better(top, c)).map((c) => c.id);
}

// Whether this person answered every window there is now.
export function answeredAll(view: Pick<DatesView, "options" | "responses">, memberId: string): boolean {
  const r = view.responses.find((x) => x.memberId === memberId);
  return !!r && view.options.every((o) => r.answers[o.id]);
}

export const DATE_ANSWER_LABEL: Record<DateAnswer, string> = { yes: "Sí", maybe: "Si hace falta", no: "No" };
