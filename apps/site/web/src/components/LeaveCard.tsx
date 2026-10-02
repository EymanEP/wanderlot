import { useState } from "react";
import { LEAVE_STATUSES, copy, leaveChoice, leaveLabel, allLeaveApproved, initials, leaveCounts, rangeLabel, avatarTint, type LeaveStatus } from "@wanderlot/core";
import { Avatar, Badge, Card, CheckIcon, Chip, Heading, Notice, Text, cn, useCopy } from "@wanderlot/ui";
import { useAuth } from "../data/auth.tsx";
import { useSite } from "../data/store.tsx";

const COPY = copy({
  es: {
    title: (dates: string) => `Días libres · ${dates}`,
    count: (n: number, of: number) => `${n} de ${of} con los días`,
    all: "Todos tenéis los días aprobados: ya se puede reservar.",
    denied: "A alguien no le dan esos días: habrá que hablarlo antes de reservar nada.",
    ask: "Antes de reservar vuelos y alojamiento, cada uno confirma aquí que tiene esos días libres en el trabajo.",
    you: "¿Y tú?",
    saving: "Guardando…",
    otherDates: "Habías contestado para otras fechas: dilo otra vez para estas.",
    byOrganiser: (organiser: string) => `Lo marcó ${organiser} por ti.`,
    each: "Cómo va cada uno",
    me: " (tú)",
  },
  en: {
    title: (dates: string) => `Days off · ${dates}`,
    count: (n: number, of: number) => `${n} of ${of} have the days`,
    all: "You all have the days approved: you can book now.",
    denied: "Someone can't get those days: talk it over before booking anything.",
    ask: "Before booking flights and a place to stay, everyone confirms here that they've got those days off work.",
    you: "And you?",
    saving: "Saving…",
    otherDates: "You'd answered for other dates: say it again for these.",
    byOrganiser: (organiser: string) => `${organiser} marked it for you.`,
    each: "How everyone's doing",
    me: " (you)",
  },
});

export const LEAVE_TONE: Record<LeaveStatus, string> = {
  approved: "bg-accent",
  asked: "bg-claude",
  denied: "bg-ink",
  "not-asked": "bg-line",
};

// Days off: everyone works somewhere different, so before anything is
// booked each person says whether they've got the trip's days, and sees
// where the rest are.
export function LeaveCard({ className }: { className?: string }) {
  const { leave, me, saveLeave } = useSite();
  const t = useCopy(COPY);
  const { group } = useAuth();
  const [busy, setBusy] = useState<LeaveStatus | null>(null);
  const [error, setError] = useState<string | null>(null);
  if (!leave || leave.people.length === 0) return null;

  const mine = leave.people.find((p) => p.id === me.id);
  const counts = leaveCounts(leave);
  const all = allLeaveApproved(leave);
  const dates = rangeLabel(leave.dateFrom, leave.dateTo);

  const pick = async (status: LeaveStatus) => {
    setBusy(status);
    setError(null);
    try {
      await saveLeave(status);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(null);
    }
  };

  return (
    <Card as="section" variant="raised" aria-labelledby="dias-libres" className={cn("flex flex-col gap-4", className)}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Heading id="dias-libres" as="h2" size="subheading">
          {t.title(dates)}
        </Heading>
        <Badge tone={all ? "accent-solid" : counts.denied ? "dark" : "accent"} icon={all ? <CheckIcon size={12} /> : undefined}>
          {t.count(counts.approved, leave.people.length)}
        </Badge>
      </div>
      <Text size="sm" tone="ink-2">
        {all
          ? t.all
          : counts.denied
            ? t.denied
            : t.ask}
      </Text>

      {mine && (
        <div className="flex flex-col gap-2">
          <span id="mis-dias" className="text-sm font-bold">
            {t.you}
          </span>
          <div role="group" aria-labelledby="mis-dias" className="flex flex-wrap gap-2">
            {LEAVE_STATUSES.map((s) => (
              <Chip key={s} size="sm" on={mine.status === s && !mine.forOtherDates} disabled={busy !== null} onClick={() => void pick(s)}>
                {busy === s ? t.saving : leaveChoice(s)}
              </Chip>
            ))}
          </div>
          {mine.forOtherDates && <span className="text-[13px] text-muted">{t.otherDates}</span>}
          {mine.byOrganiser && <span className="text-[13px] text-muted">{t.byOrganiser(group.organiserName)}</span>}
          {error && <Notice role="alert">{error}</Notice>}
        </div>
      )}

      <ul aria-label={t.each} className="m-0 grid list-none gap-x-6 gap-y-2.5 border-t border-line-faint p-0 pt-3.5 sm:grid-cols-2">
        {leave.people.map((p) => (
          <li key={p.id} className="flex items-center gap-2.5 text-sm">
            <Avatar initials={initials(p.name)} tint={p.id === me.id ? "accent" : avatarTint(p.id)} size="sm" />
            <span className="min-w-0 flex-1 truncate font-semibold">
              {p.name}
              {p.id === me.id ? t.me : ""}
            </span>
            <span className="flex shrink-0 items-center gap-1.5 text-[13px] text-ink-2">
              <span aria-hidden className={cn("size-2 rounded-full", LEAVE_TONE[p.status])} />
              {leaveLabel(p.status)}
            </span>
          </li>
        ))}
      </ul>
    </Card>
  );
}
