// v1 has no email or push: the panel writes the message the organiser pastes
// into the group chat (SPEC §7).
import { rangeLabel, type DateOption, type Plan } from "@wanderlot/core";

export interface PendingInvite {
  name: string;
  url: string;
}

export function inviteUrl(siteUrl: string, token: string): string {
  return new URL(`/i/${token}`, siteUrl).toString();
}

function formatDeadline(iso: string): string {
  return new Intl.DateTimeFormat("es-ES", {
    weekday: "long",
    day: "numeric",
    month: "long",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Europe/Madrid",
  }).format(new Date(iso));
}

// Everyone signs in at the site's address; people who haven't joined yet get
// their one-time invite (SPEC §5, §7).
export function voteOpenedMessage(plan: Pick<Plan, "id" | "name">, deadline: string, siteUrl: string, pending: PendingInvite[]): string {
  const lines = [
    `Abierta la votación de ${plan.name}.`,
    `Ordenad vuestros 3 destinos favoritos antes del ${formatDeadline(deadline)}.`,
    "El recuento no se ve hasta que votemos todos o se acabe el plazo.",
    "",
    `Entrad en ${new URL(`/p/${plan.id}`, siteUrl)}`,
  ];
  if (pending.length) {
    lines.push("", "Si aún no habéis entrado nunca, vuestra invitación (sirve una vez, no la reenviéis):", ...pending.map((p) => `• ${p.name}: ${p.url}`));
  }
  return lines.join("\n");
}

// A nudge naming who's missing: nobody sees anyone's ballot, only who voted.
export function voteReminderMessage(plan: Pick<Plan, "id" | "name">, deadline: string, siteUrl: string, missing: string[]): string {
  const who = missing.length === 1 ? `Falta ${missing[0]}` : `Faltan ${missing.slice(0, -1).join(", ")} y ${missing.at(-1)}`;
  return [
    `${who} por votar ${plan.name}.`,
    `Se cierra el ${formatDeadline(deadline)}; son dos minutos: ordenad vuestros 3 favoritos.`,
    `${new URL(`/p/${plan.id}/votacion`, siteUrl)}`,
  ].join("\n");
}

// voteWinnerCity: when the group went somewhere other than the vote's winner.
export function voteClosedMessage(plan: Pick<Plan, "id" | "name">, winnerCity: string | null, siteUrl: string, voteWinnerCity?: string | null): string {
  const url = new URL(`/p/${plan.id}`, siteUrl).toString();
  if (winnerCity && voteWinnerCity && voteWinnerCity !== winnerCity) {
    return `Votación de ${plan.name} cerrada: ganó ${voteWinnerCity}, pero al final nos vamos a ${winnerCity}. Recuento completo en ${url}`;
  }
  return winnerCity
    ? `Votación de ${plan.name} cerrada: nos vamos a ${winnerCity}. Recuento completo en ${url}`
    : `Votación de ${plan.name} cerrada con empate. Decido yo y os cuento. Recuento en ${url}`;
}

const list = (items: string[]) => (items.length > 1 ? `${items.slice(0, -1).join(", ")} o ${items.at(-1)}` : (items[0] ?? ""));

// The date vote is open (ROADMAP 2.1): which windows, until when, and the
// invites of whoever hasn't joined yet.
export function datesOpenedMessage(
  plan: Pick<Plan, "id" | "name">,
  options: DateOption[],
  deadline: string | null,
  siteUrl: string,
  pending: PendingInvite[],
): string {
  const lines = [
    `¿Cuándo nos vamos? (${plan.name})`,
    `Decid qué fechas os vienen bien: ${list(options.map((o) => rangeLabel(o.dateFrom, o.dateTo)))}. Para cada una: sí, si hace falta o no.`,
    ...(deadline ? [`Responded antes del ${formatDeadline(deadline)}, así podemos pedir los días.`] : []),
    "",
    `Entrad en ${new URL(`/p/${plan.id}/fechas`, siteUrl)}`,
  ];
  if (pending.length) {
    lines.push("", "Si aún no habéis entrado nunca, vuestra invitación (sirve una vez, no la reenviéis):", ...pending.map((p) => `• ${p.name}: ${p.url}`));
  }
  return lines.join("\n");
}

export function datesReminderMessage(plan: Pick<Plan, "id" | "name">, siteUrl: string, missing: string[]): string {
  const who = missing.length === 1 ? `Falta ${missing[0]}` : `Faltan ${missing.slice(0, -1).join(", ")} y ${missing.at(-1)}`;
  return `${who} por decir qué fechas le vienen bien para ${plan.name}. Es un minuto: ${new URL(`/p/${plan.id}/fechas`, siteUrl)}`;
}

export function datesChosenMessage(plan: Pick<Plan, "id" | "name">, option: DateOption, siteUrl: string): string {
  return `Fechas de ${plan.name} decididas: ${rangeLabel(option.dateFrom, option.dateTo)}. Ya podéis pedir los días. ${new URL(`/p/${plan.id}/fechas`, siteUrl)}`;
}

// Days off: who still has to say they've got them, before anything is booked.
export function leaveReminderMessage(plan: Pick<Plan, "id" | "name">, dates: { dateFrom: string; dateTo: string }, siteUrl: string, missing: string[]): string {
  const who = missing.length === 1 ? `Falta ${missing[0]}` : `Faltan ${missing.slice(0, -1).join(", ")} y ${missing.at(-1)}`;
  return `${plan.name}, ${rangeLabel(dates.dateFrom, dates.dateTo)}: antes de reservar nada, ¿os han aprobado los días en el trabajo? ${who} por confirmarlo. Se marca aquí: ${new URL(`/p/${plan.id}`, siteUrl)}`;
}
