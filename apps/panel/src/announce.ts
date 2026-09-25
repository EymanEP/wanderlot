// v1 has no email or push: the panel writes the message the organiser pastes
// into the group chat (SPEC §7).
import type { Plan } from "@wanderlot/core";

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

export function voteClosedMessage(plan: Pick<Plan, "id" | "name">, winnerCity: string | null, siteUrl: string): string {
  const url = new URL(`/p/${plan.id}`, siteUrl).toString();
  return winnerCity
    ? `Votación de ${plan.name} cerrada: nos vamos a ${winnerCity}. Recuento completo en ${url}`
    : `Votación de ${plan.name} cerrada con empate. Decido yo y os cuento. Recuento en ${url}`;
}
