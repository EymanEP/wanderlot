// v1 has no email or push: the panel writes the message the organiser pastes
// into the group chat (SPEC §7), in the group's language (ROADMAP 4).
import { DEFAULT_LOCALE, INTL_LOCALE, copy, pick, rangeLabel, type DateOption, type Locale, type Plan } from "@wanderlot/core";

export interface PendingInvite {
  name: string;
  url: string;
}

export function inviteUrl(siteUrl: string, token: string): string {
  return new URL(`/i/${token}`, siteUrl).toString();
}

const COPY = copy({
  es: {
    voteOpened: (plan: string) => `Abierta la votación de ${plan}.`,
    rankBy: (deadline: string) => `Ordenad vuestros 3 destinos favoritos antes del ${deadline}.`,
    hidden: "El recuento no se ve hasta que votemos todos o se acabe el plazo.",
    goTo: (url: string) => `Entrad en ${url}`,
    invites: "Si aún no habéis entrado nunca, vuestra invitación (sirve una vez, no la reenviéis):",
    missing: (names: string[]) => (names.length === 1 ? `Falta ${names[0]}` : `Faltan ${names.slice(0, -1).join(", ")} y ${names.at(-1)}`),
    toVote: (who: string, plan: string) => `${who} por votar ${plan}.`,
    closes: (deadline: string) => `Se cierra el ${deadline}; son dos minutos: ordenad vuestros 3 favoritos.`,
    overridden: (plan: string, voted: string, chosen: string, url: string) => `Votación de ${plan} cerrada: ganó ${voted}, pero al final nos vamos a ${chosen}. Recuento completo en ${url}`,
    won: (plan: string, city: string, url: string) => `Votación de ${plan} cerrada: nos vamos a ${city}. Recuento completo en ${url}`,
    tie: (plan: string, url: string) => `Votación de ${plan} cerrada con empate. Decido yo y os cuento. Recuento en ${url}`,
    or: "o",
    when: (plan: string) => `¿Cuándo nos vamos? (${plan})`,
    whichDates: (dates: string) => `Decid qué fechas os vienen bien: ${dates}. Para cada una: sí, si hace falta o no.`,
    answerBy: (deadline: string) => `Responded antes del ${deadline}, así podemos pedir los días.`,
    datesReminder: (who: string, plan: string, url: string) => `${who} por decir qué fechas le vienen bien para ${plan}. Es un minuto: ${url}`,
    datesChosen: (plan: string, dates: string, url: string) => `Fechas de ${plan} decididas: ${dates}. Ya podéis pedir los días. ${url}`,
    leave: (plan: string, dates: string, who: string, url: string) =>
      `${plan}, ${dates}: antes de reservar nada, ¿os han aprobado los días en el trabajo? ${who} por confirmarlo. Se marca aquí: ${url}`,
  },
  en: {
    voteOpened: (plan: string) => `Voting for ${plan} is open.`,
    rankBy: (deadline: string) => `Rank your 3 favourite destinations before ${deadline}.`,
    hidden: "Nobody sees the count until we've all voted or time runs out.",
    goTo: (url: string) => `Go to ${url}`,
    invites: "If you've never signed in, here's your invite (it works once, don't forward it):",
    missing: (names: string[]) => `${names.length === 1 ? names[0] : `${names.slice(0, -1).join(", ")} and ${names.at(-1)}`} still`,
    toVote: (who: string, plan: string) => `${who} need${who.includes(" and ") ? "" : "s"} to vote for ${plan}.`,
    closes: (deadline: string) => `It closes on ${deadline}; it takes two minutes: rank your 3 favourites.`,
    overridden: (plan: string, voted: string, chosen: string, url: string) => `Voting for ${plan} is closed: ${voted} won, but in the end we're going to ${chosen}. Full count at ${url}`,
    won: (plan: string, city: string, url: string) => `Voting for ${plan} is closed: we're going to ${city}. Full count at ${url}`,
    tie: (plan: string, url: string) => `Voting for ${plan} closed in a tie. I'll decide and let you know. Count at ${url}`,
    or: "or",
    when: (plan: string) => `When are we going? (${plan})`,
    whichDates: (dates: string) => `Say which dates suit you: ${dates}. For each one: yes, if need be, or no.`,
    answerBy: (deadline: string) => `Answer before ${deadline}, so we can ask for the days off.`,
    datesReminder: (who: string, plan: string, url: string) => `${who} need${who.includes(" and ") ? "" : "s"} to say which dates suit them for ${plan}. It takes a minute: ${url}`,
    datesChosen: (plan: string, dates: string, url: string) => `Dates for ${plan} decided: ${dates}. You can ask for the days off now. ${url}`,
    leave: (plan: string, dates: string, who: string, url: string) =>
      `${plan}, ${dates}: before booking anything, have you got the days off work approved? ${who} need${who.includes(" and ") ? "" : "s"} to confirm. Mark it here: ${url}`,
  },
});

function formatDeadline(iso: string, l: Locale): string {
  const s = new Intl.DateTimeFormat(INTL_LOCALE[l], {
    weekday: "long",
    day: "numeric",
    month: "long",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Europe/Madrid",
  }).format(new Date(iso));
  return l === "en" ? s.replace(/,? at /, " at ").replace(/^(\w+),/, "$1") : s;
}

// Everyone signs in at the site's address; people who haven't joined yet get
// their one-time invite (SPEC §5, §7).
export function voteOpenedMessage(plan: Pick<Plan, "id" | "name">, deadline: string, siteUrl: string, pending: PendingInvite[], l: Locale = DEFAULT_LOCALE): string {
  const t = pick(COPY, l);
  const lines = [t.voteOpened(plan.name), t.rankBy(formatDeadline(deadline, l)), t.hidden, "", t.goTo(new URL(`/p/${plan.id}`, siteUrl).toString())];
  if (pending.length) lines.push("", t.invites, ...pending.map((p) => `• ${p.name}: ${p.url}`));
  return lines.join("\n");
}

// A nudge naming who's missing: nobody sees anyone's ballot, only who voted.
export function voteReminderMessage(plan: Pick<Plan, "id" | "name">, deadline: string, siteUrl: string, missing: string[], l: Locale = DEFAULT_LOCALE): string {
  const t = pick(COPY, l);
  return [t.toVote(t.missing(missing), plan.name), t.closes(formatDeadline(deadline, l)), `${new URL(`/p/${plan.id}/votacion`, siteUrl)}`].join("\n");
}

// voteWinnerCity: when the group went somewhere other than the vote's winner.
export function voteClosedMessage(plan: Pick<Plan, "id" | "name">, winnerCity: string | null, siteUrl: string, voteWinnerCity?: string | null, l: Locale = DEFAULT_LOCALE): string {
  const t = pick(COPY, l);
  const url = new URL(`/p/${plan.id}`, siteUrl).toString();
  if (winnerCity && voteWinnerCity && voteWinnerCity !== winnerCity) return t.overridden(plan.name, voteWinnerCity, winnerCity, url);
  return winnerCity ? t.won(plan.name, winnerCity, url) : t.tie(plan.name, url);
}

const list = (items: string[], or: string) => (items.length > 1 ? `${items.slice(0, -1).join(", ")} ${or} ${items.at(-1)}` : (items[0] ?? ""));

// The date vote is open (ROADMAP 2.1): which windows, until when, and the
// invites of whoever hasn't joined yet.
export function datesOpenedMessage(
  plan: Pick<Plan, "id" | "name">,
  options: DateOption[],
  deadline: string | null,
  siteUrl: string,
  pending: PendingInvite[],
  l: Locale = DEFAULT_LOCALE,
): string {
  const t = pick(COPY, l);
  const lines = [
    t.when(plan.name),
    t.whichDates(list(options.map((o) => rangeLabel(o.dateFrom, o.dateTo, l)), t.or)),
    ...(deadline ? [t.answerBy(formatDeadline(deadline, l))] : []),
    "",
    t.goTo(new URL(`/p/${plan.id}/fechas`, siteUrl).toString()),
  ];
  if (pending.length) lines.push("", t.invites, ...pending.map((p) => `• ${p.name}: ${p.url}`));
  return lines.join("\n");
}

export function datesReminderMessage(plan: Pick<Plan, "id" | "name">, siteUrl: string, missing: string[], l: Locale = DEFAULT_LOCALE): string {
  const t = pick(COPY, l);
  return t.datesReminder(t.missing(missing), plan.name, new URL(`/p/${plan.id}/fechas`, siteUrl).toString());
}

export function datesChosenMessage(plan: Pick<Plan, "id" | "name">, option: DateOption, siteUrl: string, l: Locale = DEFAULT_LOCALE): string {
  return pick(COPY, l).datesChosen(plan.name, rangeLabel(option.dateFrom, option.dateTo, l), new URL(`/p/${plan.id}/fechas`, siteUrl).toString());
}

// Days off: who still has to say they've got them, before anything is booked.
export function leaveReminderMessage(plan: Pick<Plan, "id" | "name">, dates: { dateFrom: string; dateTo: string }, siteUrl: string, missing: string[], l: Locale = DEFAULT_LOCALE): string {
  const t = pick(COPY, l);
  return t.leave(plan.name, rangeLabel(dates.dateFrom, dates.dateTo, l), t.missing(missing), new URL(`/p/${plan.id}`, siteUrl).toString());
}
