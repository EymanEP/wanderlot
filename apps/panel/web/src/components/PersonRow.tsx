import { copy, deadlineLabel, longDate, relativeTime } from "@wanderlot/core";
import type { Access } from "../data/backend.ts";
import type { Person } from "../data/store.tsx";
import { Avatar, Badge, Button, Card, useCopy, type BadgeTone } from "@wanderlot/ui";

export type PersonState = "inside" | "pending" | "expired" | "none";

export function personState(a: Access): PersonState {
  if (a.passkeys.length > 0 || a.pin) return "inside";
  if (a.invite?.status === "valid") return "pending";
  if (a.invite && a.invite.status !== "used") return "expired";
  return "none";
}

const COPY = copy({
  es: {
    badge: { inside: "Dentro", pending: "Invitación pendiente", expired: "Invitación caducada", none: "Sin invitar" } as Record<PersonState, string>,
    pinLocked: "PIN bloqueado por intentos fallidos",
    withPin: "Con PIN",
    aDevice: "Un dispositivo",
    lastSeen: (when: string) => ` · última vez ${when}`,
    noSession: " · sin sesión abierta",
    pending: (sent: string, expires: string) => `Invitación enviada el ${sent} · caduca el ${expires}`,
    expired: (date: string) => `Su invitación caducó el ${date} sin usarse`,
    none: "Todavía no le has mandado invitación",
    inviteOf: (name: string) => `Invitación de ${name}`,
    closeSessions: "Cerrar sesiones",
    revoke: "Quitar acceso",
    newInvite: "Nueva invitación",
    copyInvite: "Copiar invitación",
    createInvite: "Crear invitación",
  },
  en: {
    badge: { inside: "In", pending: "Invite pending", expired: "Invite expired", none: "Not invited" } as Record<PersonState, string>,
    pinLocked: "PIN locked after failed attempts",
    withPin: "With PIN",
    aDevice: "A device",
    lastSeen: (when: string) => ` · last seen ${when}`,
    noSession: " · no open session",
    pending: (sent: string, expires: string) => `Invite sent on ${sent} · expires ${expires}`,
    expired: (date: string) => `Their invite expired on ${date} unused`,
    none: "You haven't sent them an invite yet",
    inviteOf: (name: string) => `${name}'s invite`,
    closeSessions: "Close sessions",
    revoke: "Remove access",
    newInvite: "New invite",
    copyInvite: "Copy invite",
    createInvite: "Create invite",
  },
});

const BADGE: Record<PersonState, BadgeTone> = {
  inside: "accent",
  pending: "claude",
  expired: "neutral",
  none: "muted",
};

export interface PersonRowProps {
  member: Person;
  access: Access;
  now: Date;
  onInvite: () => void;
  onCopy: (url: string) => void;
  onCloseSessions: () => void;
  onRevoke: () => void;
}

// One person on "Personas": how they get in, and what the organiser can do.
export function PersonRow({ member: m, access: a, now, onInvite, onCopy, onCloseSessions, onRevoke }: PersonRowProps) {
  const t = useCopy(COPY);
  const state = personState(a);
  const lastSeen = a.sessions.map((s) => s.lastSeenAt).sort().at(-1);
  return (
    <Card as="li" variant="flat" padding="none" aria-label={m.name} className="flex flex-wrap items-center gap-x-4 gap-y-3 px-[18px] py-4 md:flex-nowrap">
      <Avatar initials={m.initials} tint={m.tint === "accent" ? "accent" : m.tint} size="xl" />
      <div className="flex min-w-[calc(100%-56px)] flex-1 flex-col gap-1 md:min-w-0">
        <div className="flex flex-wrap items-center gap-2.5">
          <span className="text-[17px] font-bold">{m.name}</span>
          <Badge tone={BADGE[state]}>{t.badge[state]}</Badge>
        </div>
        <span className="text-[13px] text-ink-2">
          {state === "inside" &&
            `${[...(a.pin ? [a.pin.locked ? t.pinLocked : t.withPin] : []), ...a.passkeys.map((p) => p.device ?? t.aDevice)].join(" · ")}${lastSeen ? t.lastSeen(relativeTime(lastSeen, now)) : t.noSession}`}
          {state === "pending" && t.pending(longDate(a.invite!.createdAt), deadlineLabel(a.invite!.expiresAt))}
          {state === "expired" && t.expired(longDate(a.invite!.expiresAt))}
          {state === "none" && t.none}
        </span>
        {state === "pending" && a.inviteUrl && (
          <span className="text-xs break-all text-muted select-all" aria-label={t.inviteOf(m.name)}>
            {a.inviteUrl}
          </span>
        )}
      </div>
      <div className="ml-auto flex shrink-0 flex-wrap justify-end gap-2">
        {state === "inside" && (
          <>
            <Button onClick={onCloseSessions} disabled={a.sessions.length === 0}>
              {t.closeSessions}
            </Button>
            <Button variant="ghost" onClick={onRevoke}>
              {t.revoke}
            </Button>
          </>
        )}
        {state === "pending" && (
          <>
            <Button onClick={onInvite}>{t.newInvite}</Button>
            <Button variant="soft" onClick={() => onCopy(a.inviteUrl!)}>
              {t.copyInvite}
            </Button>
          </>
        )}
        {(state === "expired" || state === "none") && (
          <Button variant="primary" onClick={onInvite}>
            {t.createInvite}
          </Button>
        )}
      </div>
    </Card>
  );
}
