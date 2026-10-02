import { useState } from "react";
import {
  answeredAll,
  dateAnswerLabel,
  bestDateOptions,
  dateCounts,
  deadlineLabel,
  longDate,
  nightsOf,
  rangeLabel,
  copy,
  shortDate,
  type DateAnswer,
  type DateOption,
  type DatesView,
} from "@wanderlot/core";
import { Avatar, Badge, Button, Card, ChoiceChip, EmptyState, Field, Footer, Heading, Main, SectionHeader, Text, TextArea, cn, useCopy, useToast } from "@wanderlot/ui";
import { useAuth } from "../data/auth.tsx";
import { LeaveCard } from "../components/LeaveCard.tsx";
import { useSite, type Person } from "../data/store.tsx";
import { names } from "../lib/view.ts";

const COPY = copy({
  es: {
    longRange: (from: string, to: string, n: number) => `Del ${from} al ${to} · ${n} ${n === 1 ? "noche" : "noches"}`,
    noDates: "Este viaje no tiene votación de fechas",
    noDatesText: (organiser: string) => `${organiser} ya ha decidido cuándo es.`,
    saved: "Respuesta guardada",
    couldNot: (msg: string) => `No se pudo guardar: ${msg}`,
    when: "¿Cuándo nos vamos?",
    decided: "Fechas decididas",
    openText: (organiser: string, n: number, plan: string) =>
      `${organiser} ha propuesto ${n} fechas para ${plan}. Di para cada una si te viene bien, si podrías si hace falta o si no puedes. No es una votación por puntos: sirve para ver quién puede cuándo y pedir los días a tiempo.`,
    decidedText: (organiser: string, plan: string) => `${organiser} eligió las fechas de ${plan} con lo que respondisteis. Ya se pueden pedir los días.`,
    going: "Nos vamos",
    answerBy: (date: string) => `Responde antes del ${date}`,
    answerAnytime: "Responde cuando puedas",
    answers: (n: number, of: number) => `${n} de ${of} respuestas`,
    canChange: "Puedes cambiar lo tuyo hasta que se decidan.",
    mine: "Tu respuesta",
    answeredOn: (date: string, open: boolean) => `Respondiste el ${date}${open ? " · puedes cambiarla" : ""}`,
    notAnswered: "Todavía no has respondido",
    note: "Algo que haya que saber (opcional)",
    noteHint: "Tengo que pedirlo antes del 15",
    footer: (organiser: string) => `Lo que respondes lo ven todos los del viaje. Las fechas se deciden cuando ${organiser} elige unas.`,
    answerAll: "Responde a todas las fechas",
    save: "Guardar mi respuesta",
    answer: "Responder",
    whoCanGo: "Quién puede cuándo",
    chosen: "Elegidas",
    best: "Las mejores",
    counts: (yes: number, maybe: number, no: number) => `${yes} sí · ${maybe} si hace falta · ${no} no`,
    notes: "Notas",
    quote: (s: string) => `«${s}»`,
    pending: (n: number, names: string) => `Falta${n === 1 ? "" : "n"} ${names}.`,
  },
  en: {
    longRange: (from: string, to: string, n: number) => `${from} to ${to} · ${n} ${n === 1 ? "night" : "nights"}`,
    noDates: "This trip has no dates vote",
    noDatesText: (organiser: string) => `${organiser} has already decided when it is.`,
    saved: "Answer saved",
    couldNot: (msg: string) => `Couldn't save: ${msg}`,
    when: "When are we going?",
    decided: "Dates decided",
    openText: (organiser: string, n: number, plan: string) =>
      `${organiser} has suggested ${n} dates for ${plan}. For each one, say whether it suits you, whether you could if need be, or whether you can't. It isn't a points vote: it's to see who can go when and ask for the days off in time.`,
    decidedText: (organiser: string, plan: string) => `${organiser} chose the dates for ${plan} from your answers. You can ask for the days off now.`,
    going: "We're going",
    answerBy: (date: string) => `Answer by ${date}`,
    answerAnytime: "Answer when you can",
    answers: (n: number, of: number) => `${n} of ${of} answers`,
    canChange: "You can change yours until they're decided.",
    mine: "Your answer",
    answeredOn: (date: string, open: boolean) => `You answered on ${date}${open ? " · you can change it" : ""}`,
    notAnswered: "You haven't answered yet",
    note: "Anything to know (optional)",
    noteHint: "I have to ask before the 15th",
    footer: (organiser: string) => `Everyone on the trip sees your answers. The dates are decided when ${organiser} picks some.`,
    answerAll: "Answer every date",
    save: "Save my answer",
    answer: "Answer",
    whoCanGo: "Who can go when",
    chosen: "Chosen",
    best: "The best",
    counts: (yes: number, maybe: number, no: number) => `${yes} yes · ${maybe} if need be · ${no} no`,
    notes: "Notes",
    quote: (s: string) => `“${s}”`,
    pending: (_n: number, names: string) => `Still to answer: ${names}.`,
  },
});

const ANSWERS: DateAnswer[] = ["yes", "maybe", "no"];

// Cuándo (ROADMAP 2.1): for each date window, yes, if need be, or no; and
// who can go when, for everyone on the trip to see.
export function FechasPage() {
  const site = useSite();
  const t = useCopy(COPY);
  const { dates } = site;
  const { group } = useAuth();
  if (!dates) {
    return (
      <Main>
        <EmptyState title={t.noDates}>{t.noDatesText(group.organiserName)}</EmptyState>
      </Main>
    );
  }
  return <Dates dates={dates} />;
}

function Dates({ dates }: { dates: DatesView }) {
  const { me, members, saveDates, plan } = useSite();
  const { group } = useAuth();
  const toast = useToast();
  const t = useCopy(COPY);
  const longRange = (o: DateOption) => t.longRange(shortDate(o.dateFrom), shortDate(o.dateTo), nightsOf(o));
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
      toast(t.saved);
    } catch (e) {
      toast(t.couldNot((e as Error).message));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Main className="gap-7">
      <section className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between lg:gap-12">
        <div className="flex max-w-[820px] flex-col gap-2.5">
          <Heading as="h1" size="display">
            {open ? t.when : t.decided}
          </Heading>
          <Text size="lg">
            {open
              ? t.openText(group.organiserName, dates.options.length, plan.name)
              : t.decidedText(group.organiserName, plan.name)}
          </Text>
        </div>
        <Card variant="accent" className="flex shrink-0 flex-col gap-1.5 lg:w-[300px]">
          {chosen ? (
            <>
              <span className="text-[13px] font-bold">{t.going}</span>
              <span className="text-[28px] font-extrabold tracking-[-0.03em]">{rangeLabel(chosen.dateFrom, chosen.dateTo)}</span>
              <span className="text-[13px]">{longRange(chosen)}</span>
            </>
          ) : (
            <>
              <span className="text-[13px] font-bold">{dates.deadline ? t.answerBy(deadlineLabel(dates.deadline)) : t.answerAnytime}</span>
              <span className="text-[28px] font-extrabold tracking-[-0.03em] tabular-nums">
                {t.answers(answered.length, members.length)}
              </span>
              <span className="text-[13px]">{t.canChange}</span>
            </>
          )}
        </Card>
      </section>

      {chosen && <LeaveCard />}

      <div className="flex flex-col gap-7 lg:flex-row">
        <section aria-labelledby="tu-respuesta" className="flex min-w-0 flex-1 flex-col gap-3.5">
          <SectionHeader
            id="tu-respuesta"
            title={t.mine}
            aside={mine ? t.answeredOn(longDate(mine.updatedAt), open) : t.notAnswered}
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
                          label={dateAnswerLabel(a)}
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
          <Field label={t.note}>
            {({ inputId }) => (
              <TextArea
                id={inputId}
                rows={2}
                maxLength={300}
                disabled={!open}
                placeholder={t.noteHint}
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
            {t.footer(group.organiserName)}
          </span>
          <Button variant="primary" size="lg" disabled={!complete || !dirty || saving} onClick={save} title={!complete ? t.answerAll : undefined}>
            {mine ? t.save : t.answer}
          </Button>
        </Footer>
      )}
    </Main>
  );
}

// Per window: who said yes, if need be, or no. Everyone on the trip sees it.
function WhoCanGo({ dates, members }: { dates: DatesView; members: Person[] }) {
  const t = useCopy(COPY);
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
        {t.whoCanGo}
      </Heading>
      <ul className="m-0 flex list-none flex-col gap-3.5 p-0">
        {dates.options.map((o) => {
          const c = counts.get(o.id)!;
          return (
            <li key={o.id} aria-label={rangeLabel(o.dateFrom, o.dateTo)} className="flex flex-col gap-2 border-b border-line-soft pb-3.5 last:border-0 last:pb-0">
              <div className="flex items-center justify-between gap-2">
                <span className="font-bold">{rangeLabel(o.dateFrom, o.dateTo)}</span>
                {o.id === dates.chosenOptionId ? <Badge tone="accent-solid">{t.chosen}</Badge> : best.has(o.id) && <Badge tone="accent">{t.best}</Badge>}
              </div>
              <span className="text-[13px] text-ink-2 tabular-nums">
                {t.counts(c.yes, c.maybe, c.no)}
              </span>
              <div className="flex flex-wrap gap-x-4 gap-y-1.5">
                {ANSWERS.map((a) => {
                  const who = members.filter((m) => byMember.get(m.id)?.answers[o.id] === a);
                  if (!who.length) return null;
                  return (
                    <span key={a} className="flex items-center gap-1.5 text-xs">
                      <span className={cn("font-bold", a === "yes" ? "text-accent-strong" : "text-muted")}>{dateAnswerLabel(a)}</span>
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
        <ul aria-label={t.notes} className="m-0 flex list-none flex-col gap-1.5 border-t border-line-soft p-0 pt-3.5">
          {notes.map(({ m, n }) => (
            <li key={m.id} className="text-[13px] text-ink-2">
              <span className="font-semibold text-ink">{m.name}:</span> {t.quote(n)}
            </li>
          ))}
        </ul>
      )}
      {dates.status === "open" && pending.length > 0 && <span className="text-[13px] text-muted">{t.pending(pending.length, names(pending.map((m) => m.name)))}</span>}
    </Card>
  );
}
