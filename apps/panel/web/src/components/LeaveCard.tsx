import { useState } from "react";
import { LEAVE_LABEL, LEAVE_STATUSES, allLeaveApproved, avatarTint, initials, leaveCounts, rangeLabel, type LeaveStatus } from "@wanderlot/core";
import { Avatar, Badge, Button, Card, CheckIcon, Heading, Notice, Select, Text, useToast } from "@wanderlot/ui";
import type { LeavePage } from "../data/backend.ts";
import { useLoad, usePanel, usePlan } from "../data/store.tsx";
import { MessageDialog } from "./MessageDialog.tsx";

// Days off, as Fechas and El viaje read them: the same answers, loaded once
// per trip and dates (useLoad), and read again on each visit.
export function useLeave() {
  const { leave, state } = usePanel();
  const plan = usePlan();
  return useLoad<LeavePage>(`leave:${plan.id}:${plan.dateFrom}:${plan.dateTo}:${state.datesDecided}`, leave);
}

const OPTIONS = LEAVE_STATUSES.map((s) => ({ value: s, label: LEAVE_LABEL[s] }));

// Days off (vacaciones): each person says on the site whether they've got
// the trip's days off work; here the organiser follows it, marks it for
// whoever told them in the chat, and nudges the rest. Before anything is
// booked.
export function LeaveCard() {
  const { setLeave } = usePanel();
  const toast = useToast();
  const { data: page, error, set } = useLeave();
  const [message, setMessage] = useState(false);
  const leave = page?.leave;

  if (error) return <Notice role="alert">No se pudieron leer los días libres del sitio: {error}</Notice>;
  if (page?.outdated) return <Notice tone="neutral">Para preguntar al grupo por los días libres, actualiza el sitio con npm run deploy:site.</Notice>;
  if (!leave || leave.people.length === 0) return null;

  const counts = leaveCounts(leave);
  const all = allLeaveApproved(leave);
  const mark = async (id: string, status: LeaveStatus) => {
    try {
      set(await setLeave(id, status));
    } catch (e) {
      toast(`No se pudo: ${(e as Error).message}`);
    }
  };

  return (
    <Card as="section" variant="raised" aria-labelledby="dias-libres" className="flex flex-col gap-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex flex-col gap-1">
          <span className="flex flex-wrap items-center gap-2">
            <Heading id="dias-libres" size="subheading">
              Días libres · {rangeLabel(leave.dateFrom, leave.dateTo)}
            </Heading>
            <Badge tone={all ? "accent-solid" : counts.denied ? "dark" : "accent"} icon={all ? <CheckIcon size={12} /> : undefined}>
              {counts.approved} de {leave.people.length} aprobados
            </Badge>
          </span>
          <Text tone="muted" size="sm">
            {all
              ? "Todos tienen los días: ya podéis reservar vuelos y alojamiento."
              : counts.denied
                ? "A alguien no le dan los días: hablad de otras fechas antes de reservar."
                : "Cada uno lo marca en el sitio. Si alguien te lo dice por el grupo, márcalo aquí. Mejor no reservar nada hasta que estén todos."}
          </Text>
        </div>
        {page.reminder && (
          <Button size="sm" variant="secondary" onClick={() => setMessage(true)}>
            Recordar a quien falta
          </Button>
        )}
      </div>
      <ul aria-label="Días libres de cada uno" className="m-0 flex list-none flex-col gap-2 p-0">
        {leave.people.map((p) => (
          <li key={p.id} className="flex flex-wrap items-center gap-3 rounded-xl bg-surface-2 px-3.5 py-2.5">
            <Avatar initials={initials(p.name)} tint={avatarTint(p.id)} size="sm" />
            <span className="flex min-w-0 flex-1 flex-col">
              <span className="text-sm font-semibold">{p.name}</span>
              {(p.byOrganiser || p.forOtherDates) && (
                <span className="text-xs text-muted">{p.forOtherDates ? "Contestó para otras fechas" : "Marcado por ti"}</span>
              )}
            </span>
            <Select size="sm" label={`Días libres de ${p.name}`} value={p.status} options={OPTIONS} onChange={(s) => void mark(p.id, s)} className="w-[230px]" />
          </li>
        ))}
      </ul>
      {page.reminder && (
        <MessageDialog open={message} title="Días libres" intro="Pega este mensaje en el grupo: nombra a quien falta por confirmarlo." message={page.reminder} onClose={() => setMessage(false)} />
      )}
    </Card>
  );
}
