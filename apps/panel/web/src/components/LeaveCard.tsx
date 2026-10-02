import { useState } from "react";
import { LEAVE_STATUSES, copy, leaveLabel, allLeaveApproved, avatarTint, initials, leaveCounts, rangeLabel, type LeaveStatus } from "@wanderlot/core";
import { Avatar, Badge, Button, Card, CheckIcon, Heading, Notice, Select, Text, useCopy, useToast } from "@wanderlot/ui";
import type { LeavePage } from "../data/backend.ts";
import { useLoad, usePanel, usePlan } from "../data/store.tsx";
import { MessageDialog } from "./MessageDialog.tsx";

const COPY = copy({
  es: {
    loadError: (error: string) => `No se pudieron leer los días libres del sitio: ${error}`,
    outdated: "Para preguntar al grupo por los días libres, actualiza el sitio con npm run deploy:site.",
    failed: (msg: string) => `No se pudo: ${msg}`,
    heading: (range: string) => `Días libres · ${range}`,
    approved: (n: number, of: number) => `${n} de ${of} aprobados`,
    all: "Todos tienen los días: ya podéis reservar vuelos y alojamiento.",
    denied: "A alguien no le dan los días: hablad de otras fechas antes de reservar.",
    pending: "Cada uno lo marca en el sitio. Si alguien te lo dice por el grupo, márcalo aquí. Mejor no reservar nada hasta que estén todos.",
    remind: "Recordar a quien falta",
    list: "Días libres de cada uno",
    otherDates: "Contestó para otras fechas",
    byYou: "Marcado por ti",
    select: (name: string) => `Días libres de ${name}`,
    title: "Días libres",
    intro: "Pega este mensaje en el grupo: nombra a quien falta por confirmarlo.",
  },
  en: {
    loadError: (error: string) => `Couldn't read the days off from the site: ${error}`,
    outdated: "To ask the group about days off, update the site with npm run deploy:site.",
    failed: (msg: string) => `Couldn't do it: ${msg}`,
    heading: (range: string) => `Days off · ${range}`,
    approved: (n: number, of: number) => `${n} of ${of} approved`,
    all: "Everyone has the days: you can book flights and accommodation now.",
    denied: "Someone can't get the days: talk about other dates before booking.",
    pending: "Everyone marks it on the site. If someone tells you in the group, mark it here. Best not to book anything until everyone has them.",
    remind: "Remind the rest",
    list: "Everyone's days off",
    otherDates: "Answered for other dates",
    byYou: "Marked by you",
    select: (name: string) => `${name}'s days off`,
    title: "Days off",
    intro: "Paste this message into the group: it names whoever still has to confirm.",
  },
});

// Days off, as Fechas and El viaje read them: the same answers, loaded once
// per trip and dates (useLoad), and read again on each visit.
export function useLeave() {
  const { leave, state } = usePanel();
  const plan = usePlan();
  return useLoad<LeavePage>(`leave:${plan.id}:${plan.dateFrom}:${plan.dateTo}:${state.datesDecided}`, leave);
}

// Days off (vacaciones): each person says on the site whether they've got
// the trip's days off work; here the organiser follows it, marks it for
// whoever told them in the chat, and nudges the rest. Before anything is
// booked.
export function LeaveCard() {
  const t = useCopy(COPY);
  const { setLeave } = usePanel();
  const toast = useToast();
  const { data: page, error, set } = useLeave();
  const [message, setMessage] = useState(false);
  const leave = page?.leave;
  const options = LEAVE_STATUSES.map((s) => ({ value: s, label: leaveLabel(s) }));

  if (error) return <Notice role="alert">{t.loadError(error)}</Notice>;
  if (page?.outdated) return <Notice tone="neutral">{t.outdated}</Notice>;
  if (!leave || leave.people.length === 0) return null;

  const counts = leaveCounts(leave);
  const all = allLeaveApproved(leave);
  const mark = async (id: string, status: LeaveStatus) => {
    try {
      set(await setLeave(id, status));
    } catch (e) {
      toast(t.failed((e as Error).message));
    }
  };

  return (
    <Card as="section" variant="raised" aria-labelledby="dias-libres" className="flex flex-col gap-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex flex-col gap-1">
          <span className="flex flex-wrap items-center gap-2">
            <Heading id="dias-libres" size="subheading">
              {t.heading(rangeLabel(leave.dateFrom, leave.dateTo))}
            </Heading>
            <Badge tone={all ? "accent-solid" : counts.denied ? "dark" : "accent"} icon={all ? <CheckIcon size={12} /> : undefined}>
              {t.approved(counts.approved, leave.people.length)}
            </Badge>
          </span>
          <Text tone="muted" size="sm">
            {all
              ? t.all
              : counts.denied
                ? t.denied
                : t.pending}
          </Text>
        </div>
        {page.reminder && (
          <Button size="sm" variant="secondary" onClick={() => setMessage(true)}>
            {t.remind}
          </Button>
        )}
      </div>
      <ul aria-label={t.list} className="m-0 flex list-none flex-col gap-2 p-0">
        {leave.people.map((p) => (
          <li key={p.id} className="flex flex-wrap items-center gap-3 rounded-xl bg-surface-2 px-3.5 py-2.5">
            <Avatar initials={initials(p.name)} tint={avatarTint(p.id)} size="sm" />
            <span className="flex min-w-0 flex-1 flex-col">
              <span className="text-sm font-semibold">{p.name}</span>
              {(p.byOrganiser || p.forOtherDates) && (
                <span className="text-xs text-muted">{p.forOtherDates ? t.otherDates : t.byYou}</span>
              )}
            </span>
            <Select size="sm" label={t.select(p.name)} value={p.status} options={options} onChange={(s) => void mark(p.id, s)} className="w-[230px]" />
          </li>
        ))}
      </ul>
      {page.reminder && (
        <MessageDialog open={message} title={t.title} intro={t.intro} message={page.reminder} onClose={() => setMessage(false)} />
      )}
    </Card>
  );
}
