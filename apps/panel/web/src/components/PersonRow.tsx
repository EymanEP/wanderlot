import { deadlineLabel, longDate, relativeTime } from "@wanderlot/core";
import type { MockAccess, MockMember } from "@wanderlot/mocks";
import { Avatar, Badge, Button, Card, type BadgeTone } from "@wanderlot/ui";

export type PersonState = "inside" | "pending" | "expired" | "none";

export function personState(a: MockAccess): PersonState {
  if (a.passkeys.length > 0) return "inside";
  if (a.invite?.status === "valid") return "pending";
  if (a.invite && a.invite.status !== "used") return "expired";
  return "none";
}

const BADGE: Record<PersonState, { label: string; tone: BadgeTone }> = {
  inside: { label: "Dentro", tone: "accent" },
  pending: { label: "Invitación pendiente", tone: "claude" },
  expired: { label: "Invitación caducada", tone: "neutral" },
  none: { label: "Sin invitar", tone: "muted" },
};

export interface PersonRowProps {
  member: MockMember;
  access: MockAccess;
  now: Date;
  onInvite: () => void;
  onCopy: (url: string) => void;
  onCloseSessions: () => void;
  onRevoke: () => void;
}

// One person on "Personas": how they get in, and what the organiser can do.
export function PersonRow({ member: m, access: a, now, onInvite, onCopy, onCloseSessions, onRevoke }: PersonRowProps) {
  const state = personState(a);
  const lastSeen = a.sessions.map((s) => s.lastSeenAt).sort().at(-1);
  return (
    <Card as="li" variant="flat" padding="none" aria-label={m.name} className="flex flex-wrap items-center gap-x-4 gap-y-3 px-[18px] py-4 md:flex-nowrap">
      <Avatar initials={m.initials} tint={m.tint === "accent" ? "accent" : m.tint} size="xl" />
      <div className="flex min-w-[calc(100%-56px)] flex-1 flex-col gap-1 md:min-w-0">
        <div className="flex flex-wrap items-center gap-2.5">
          <span className="text-[17px] font-bold">{m.name}</span>
          <Badge tone={BADGE[state].tone}>{BADGE[state].label}</Badge>
        </div>
        <span className="text-[13px] text-ink-2">
          {state === "inside" &&
            `${a.passkeys.map((p) => p.device).join(" y ")}${lastSeen ? ` · última vez ${relativeTime(lastSeen, now)}` : " · sin sesión abierta"}`}
          {state === "pending" && `Invitación enviada el ${longDate(a.invite!.createdAt)} · caduca el ${deadlineLabel(a.invite!.expiresAt)}`}
          {state === "expired" && `Su invitación caducó el ${longDate(a.invite!.expiresAt)} sin usarse`}
          {state === "none" && "Todavía no le has mandado invitación"}
        </span>
        {state === "pending" && a.inviteUrl && (
          <span className="text-xs break-all text-muted select-all" aria-label={`Invitación de ${m.name}`}>
            {a.inviteUrl}
          </span>
        )}
      </div>
      <div className="ml-auto flex shrink-0 flex-wrap justify-end gap-2">
        {state === "inside" && (
          <>
            <Button onClick={onCloseSessions} disabled={a.sessions.length === 0}>
              Cerrar sesiones
            </Button>
            <Button variant="ghost" onClick={onRevoke}>
              Quitar acceso
            </Button>
          </>
        )}
        {state === "pending" && (
          <>
            <Button onClick={onInvite}>Nueva invitación</Button>
            <Button variant="soft" onClick={() => onCopy(a.inviteUrl!)}>
              Copiar invitación
            </Button>
          </>
        )}
        {(state === "expired" || state === "none") && (
          <Button variant="primary" onClick={onInvite}>
            Crear invitación
          </Button>
        )}
      </div>
    </Card>
  );
}
