import { useState } from "react";
import {
  DATE_ANSWER_LABEL,
  answeredAll,
  bestDateOptions,
  dateCounts,
  deadlineLabel,
  longDate,
  nightsOf,
  rangeLabel,
  shortDate,
  type DateAnswer,
  type DateOption,
  type DatesView,
} from "@wanderlot/core";
import { Avatar, Badge, Button, Card, ChoiceChip, EmptyState, Field, Footer, Heading, Main, SectionHeader, Text, TextArea, cn, useToast } from "@wanderlot/ui";
import { useAuth } from "../data/auth.tsx";
import { LeaveCard } from "../components/LeaveCard.tsx";
import { useSite, type Person } from "../data/store.tsx";
import { names } from "../lib/view.ts";

const ANSWERS: DateAnswer[] = ["yes", "maybe", "no"];
const nights = (o: DateOption) => `${nightsOf(o)} ${nightsOf(o) === 1 ? "noche" : "noches"}`;
const longRange = (o: DateOption) => `Del ${shortDate(o.dateFrom)} al ${shortDate(o.dateTo)} · ${nights(o)}`;

// Cuándo (ROADMAP 2.1): for each date window, yes, if need be, or no; and
// who can go when, for everyone on the trip to see.
export function FechasPage() {
  const site = useSite();
  const { dates } = site;
  const { group } = useAuth();
  if (!dates) {
    return (
      <Main>
        <EmptyState title="Este viaje no tiene votación de fechas">{group.organiserName} ya ha decidido cuándo es.</EmptyState>
      </Main>
    );
  }
  return <Dates dates={dates} />;
}

function Dates({ dates }: { dates: DatesView }) {
  const { me, members, saveDates, plan } = useSite();
  const { group } = useAuth();
  const toast = useToast();
  const mine = dates.responses.find((r) => r.memberId === me.id);
  const [answers, setAnswers] = useState<Record<string, DateAnswer>>(mine?.answers ?? {});
  const [note, setNote] = useState(mine?.note ?? "");
  const [saving, setSaving] = useState(false);

  const open = dates.status === "open";
  const chosen = dates.options.find((o) => o.id === dates.chosenOptionId);
  const complete = dates.options.every((o) => answers[o.id]);
  const dirty = dates.options.some((o) => answers[o.id] !== mine?.answers[o.id]) || note.trim() !== (mine?.note ?? "");
  const answered = members.filter((m) => answeredAll(dates, m.id));

  const save = async () => {
    setSaving(true);
    try {
      // Only the windows there are now: an answer to one taken away stays out.
      await saveDates(Object.fromEntries(dates.options.map((o) => [o.id, answers[o.id]!])), note);
      toast("Respuesta guardada");
    } catch (e) {
      toast(`No se pudo guardar: ${(e as Error).message}`);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Main className="gap-7">
      <section className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between lg:gap-12">
        <div className="flex max-w-[820px] flex-col gap-2.5">
          <Heading as="h1" size="display">
            {open ? "¿Cuándo nos vamos?" : "Fechas decididas"}
          </Heading>
          <Text size="lg">
            {open
              ? `${group.organiserName} ha propuesto ${dates.options.length} fechas para ${plan.name}. Di para cada una si te viene bien, si podrías si hace falta o si no puedes. No es una votación por puntos: sirve para ver quién puede cuándo y pedir los días a tiempo.`
              : `${group.organiserName} eligió las fechas de ${plan.name} con lo que respondisteis. Ya se pueden pedir los días.`}
          </Text>
        </div>
        <Card variant="accent" className="flex shrink-0 flex-col gap-1.5 lg:w-[300px]">
          {chosen ? (
            <>
              <span className="text-[13px] font-bold">Nos vamos</span>
              <span className="text-[28px] font-extrabold tracking-[-0.03em]">{rangeLabel(chosen.dateFrom, chosen.dateTo)}</span>
              <span className="text-[13px]">{longRange(chosen)}</span>
            </>
          ) : (
            <>
              <span className="text-[13px] font-bold">{dates.deadline ? `Responde antes del ${deadlineLabel(dates.deadline)}` : "Responde cuando puedas"}</span>
              <span className="text-[28px] font-extrabold tracking-[-0.03em] tabular-nums">
                {answered.length} de {members.length} respuestas
              </span>
              <span className="text-[13px]">Puedes cambiar lo tuyo hasta que se decidan.</span>
            </>
          )}
        </Card>
      </section>

      {chosen && <LeaveCard />}

      <div className="flex flex-col gap-7 lg:flex-row">
        <section aria-labelledby="tu-respuesta" className="flex min-w-0 flex-1 flex-col gap-3.5">
          <SectionHeader
            id="tu-respuesta"
            title="Tu respuesta"
            aside={mine ? `Respondiste el ${longDate(mine.updatedAt)}${open ? " · puedes cambiarla" : ""}` : "Todavía no has respondido"}
          />
          <ul className="m-0 flex list-none flex-col gap-2.5 p-0">
            {dates.options.map((o) => {
              const label = rangeLabel(o.dateFrom, o.dateTo);
              return (
                <li key={o.id}>
                  <Card
                    variant={o.id === dates.chosenOptionId ? "accent" : "raised"}
                    padding="sm"
                    className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div className="flex flex-col gap-0.5">
                      <span className="text-lg font-bold">{label}</span>
                      <span className="text-[13px] text-muted">{longRange(o)}</span>
                    </div>
                    <div role="radiogroup" aria-label={label} className="flex flex-wrap gap-2">
                      {ANSWERS.map((a) => (
                        <ChoiceChip
                          key={a}
                          type="radio"
                          name={o.id}
                          label={DATE_ANSWER_LABEL[a]}
                          checked={answers[o.id] === a}
                          disabled={!open}
                          onChange={() => setAnswers({ ...answers, [o.id]: a })}
                          className={cn(!open && "cursor-default opacity-70")}
                        />
                      ))}
                    </div>
                  </Card>
                </li>
              );
            })}
          </ul>
          <Field label="Algo que haya que saber (opcional)">
            {({ inputId }) => (
              <TextArea
                id={inputId}
                rows={2}
                maxLength={300}
                disabled={!open}
                placeholder="Tengo que pedirlo antes del 15"
                value={note}
                onChange={(e) => setNote(e.target.value)}
              />
            )}
          </Field>
        </section>

        <aside className="flex shrink-0 flex-col gap-[18px] lg:w-[396px]">
          <WhoCanGo dates={dates} members={members} />
        </aside>
      </div>

      {open && (
        <Footer>
          <span className="text-[13px] text-ink-2">
            Lo que respondes lo ven todos los del viaje. Las fechas se deciden cuando {group.organiserName} elige unas.
          </span>
          <Button variant="primary" size="lg" disabled={!complete || !dirty || saving} onClick={save} title={!complete ? "Responde a todas las fechas" : undefined}>
            {mine ? "Guardar mi respuesta" : "Responder"}
          </Button>
        </Footer>
      )}
    </Main>
  );
}

// Per window: who said yes, if need be, or no. Everyone on the trip sees it.
function WhoCanGo({ dates, members }: { dates: DatesView; members: Person[] }) {
  const best = new Set(dates.status === "open" ? bestDateOptions(dates) : []);
  const counts = new Map(dateCounts(dates).map((c) => [c.id, c]));
  const byMember = new Map(dates.responses.map((r) => [r.memberId, r]));
  const notes = members.flatMap((m) => {
    const n = byMember.get(m.id)?.note;
    return n ? [{ m, n }] : [];
  });
  const pending = members.filter((m) => !answeredAll(dates, m.id));
  return (
    <Card variant="muted" className="flex flex-col gap-4">
      <Heading as="h2" size="card">
        Quién puede cuándo
      </Heading>
      <ul className="m-0 flex list-none flex-col gap-3.5 p-0">
        {dates.options.map((o) => {
          const c = counts.get(o.id)!;
          return (
            <li key={o.id} aria-label={rangeLabel(o.dateFrom, o.dateTo)} className="flex flex-col gap-2 border-b border-line-soft pb-3.5 last:border-0 last:pb-0">
              <div className="flex items-center justify-between gap-2">
                <span className="font-bold">{rangeLabel(o.dateFrom, o.dateTo)}</span>
                {o.id === dates.chosenOptionId ? <Badge tone="accent-solid">Elegidas</Badge> : best.has(o.id) && <Badge tone="accent">Las mejores</Badge>}
              </div>
              <span className="text-[13px] text-ink-2 tabular-nums">
                {c.yes} sí · {c.maybe} si hace falta · {c.no} no
              </span>
              <div className="flex flex-wrap gap-x-4 gap-y-1.5">
                {ANSWERS.map((a) => {
                  const who = members.filter((m) => byMember.get(m.id)?.answers[o.id] === a);
                  if (!who.length) return null;
                  return (
                    <span key={a} className="flex items-center gap-1.5 text-xs">
                      <span className={cn("font-bold", a === "yes" ? "text-accent-strong" : "text-muted")}>{DATE_ANSWER_LABEL[a]}</span>
                      <span className="flex -space-x-1.5">
                        {who.map((m) => (
                          <Avatar key={m.id} initials={m.initials} name={m.name} tint={a === "no" ? "empty" : m.tint} size="xs" />
                        ))}
                      </span>
                    </span>
                  );
                })}
              </div>
            </li>
          );
        })}
      </ul>
      {notes.length > 0 && (
        <ul aria-label="Notas" className="m-0 flex list-none flex-col gap-1.5 border-t border-line-soft p-0 pt-3.5">
          {notes.map(({ m, n }) => (
            <li key={m.id} className="text-[13px] text-ink-2">
              <span className="font-semibold text-ink">{m.name}:</span> «{n}»
            </li>
          ))}
        </ul>
      )}
      {dates.status === "open" && pending.length > 0 && <span className="text-[13px] text-muted">Falta{pending.length === 1 ? "" : "n"} {names(pending.map((m) => m.name))}.</span>}
    </Card>
  );
}
