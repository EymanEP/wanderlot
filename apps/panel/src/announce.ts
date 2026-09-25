// v1 has no email or push: the panel writes the message the organiser pastes
// into the group chat (SPEC §7).
import type { Plan } from "@wanderlot/core";

export interface Link {
  name: string;
  token: string;
}

const linkLines = (siteUrl: string, planId: string, links: Link[]) =>
  links.map((l) => `• ${l.name}: ${new URL(`/p/${planId}?k=${l.token}`, siteUrl)}`);

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

export function voteOpenedMessage(plan: Pick<Plan, "id" | "name">, deadline: string, siteUrl: string, links: Link[]): string {
  return [
    `Abierta la votación de ${plan.name}.`,
    `Ordenad vuestros 3 destinos favoritos antes del ${formatDeadline(deadline)}.`,
    "El recuento no se ve hasta que votemos los seis o se acabe el plazo.",
    "",
    "Cada uno tiene su enlace (no lo compartáis):",
    ...linkLines(siteUrl, plan.id, links),
  ].join("\n");
}

export function voteClosedMessage(plan: Pick<Plan, "id" | "name">, winnerCity: string | null, siteUrl: string): string {
  const url = new URL(`/p/${plan.id}`, siteUrl).toString();
  return winnerCity
    ? `Votación de ${plan.name} cerrada: nos vamos a ${winnerCity}. Recuento completo en ${url}`
    : `Votación de ${plan.name} cerrada con empate. Decido yo y os cuento. Recuento en ${url}`;
}
