// Cuándo (ROADMAP 2.1): agreeing on dates. The organiser proposes 2–5 date
// windows; each person answers yes, "if need be" or no for each, like a
// Doodle. Nothing is ranked: the organiser reads the table and chooses.
import { z } from "zod";
import { copy, currentLocale, type Locale } from "./i18n.ts";

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

const DATE_ANSWERS = copy<Record<DateAnswer, string>>({ es: { yes: "Sí", maybe: "Si hace falta", no: "No" }, en: { yes: "Yes", maybe: "If need be", no: "No" } });
export const dateAnswerLabel = (a: DateAnswer, l: Locale = currentLocale()) => DATE_ANSWERS[l][a];

// --- Days off (vacaciones) ---------------------------------------------------
// Everyone works somewhere different: before anything is booked, each person
// says whether they've got the trip's days off. An answer is for the dates it
// was given for; if the trip's dates change, it has to be given again.

export const LEAVE_STATUSES = ["not-asked", "asked", "approved", "denied"] as const;
export const LeaveStatus = z.enum(LEAVE_STATUSES);
export type LeaveStatus = z.infer<typeof LeaveStatus>;

// How each person stands, as the group sees it.
const LEAVE_LABELS = copy<Record<LeaveStatus, string>>({
  es: { "not-asked": "Aún no los ha pedido", asked: "Pedidos, esperando respuesta", approved: "Días aprobados", denied: "No se los dan" },
  en: { "not-asked": "Hasn't asked yet", asked: "Asked, waiting to hear", approved: "Days off approved", denied: "Not given" },
});
export const leaveLabel = (s: LeaveStatus, l: Locale = currentLocale()) => LEAVE_LABELS[l][s];

// What each person answers, in their own words.
const LEAVE_CHOICES = copy<Record<LeaveStatus, string>>({
  es: { "not-asked": "Aún no los he pedido", asked: "Los he pedido", approved: "Me los han aprobado", denied: "No me los dan" },
  en: { "not-asked": "I haven't asked yet", asked: "I've asked", approved: "They're approved", denied: "I can't get them" },
});
export const leaveChoice = (s: LeaveStatus, l: Locale = currentLocale()) => LEAVE_CHOICES[l][s];

export interface LeavePerson {
  id: string;
  name: string;
  status: LeaveStatus;
  // When they last answered, for these dates; null: not yet.
  at: string | null;
  // The organiser marked it for them (they said so in the group chat).
  byOrganiser: boolean;
  // They had answered for dates the trip no longer has.
  forOtherDates: boolean;
}

// The days-off check for a trip, once its dates are decided.
export interface LeaveView {
  dateFrom: string;
  dateTo: string;
  people: LeavePerson[];
}

export function leaveCounts(view: Pick<LeaveView, "people">): Record<LeaveStatus, number> {
  const counts = { "not-asked": 0, asked: 0, approved: 0, denied: 0 };
  for (const p of view.people) counts[p.status]++;
  return counts;
}

// Everyone on the trip has their days: safe to book.
export function allLeaveApproved(view: Pick<LeaveView, "people">): boolean {
  return view.people.length > 0 && view.people.every((p) => p.status === "approved");
}

// --- Place and dates together (ROADMAP 2.7) ------------------------------------

// The widest window a trip can choose its dates in: about two months.
export const MAX_WINDOW_DAYS = 62;

export function decidesPlaceFirst(plan: { datesBy?: "dates" | "place" | undefined }): boolean {
  return plan.datesBy === "place";
}

// The dates a destination is for: its own, in a trip that decides them
// with the place, else the trip's.
export function datesOf(plan: { dateFrom: string; dateTo: string }, p?: { dateFrom?: string | undefined; dateTo?: string | undefined }): { dateFrom: string; dateTo: string } {
  return p?.dateFrom && p.dateTo ? { dateFrom: p.dateFrom, dateTo: p.dateTo } : { dateFrom: plan.dateFrom, dateTo: plan.dateTo };
}
