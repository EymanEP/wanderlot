import { useEffect, useState, type FormEvent } from "react";
import { copy, type SuggestionView } from "@wanderlot/core";
import { Button, Dialog, Field, Notice, TextArea, TextInput, useCopy, useToast } from "@wanderlot/ui";
import { useSource } from "../data/store.tsx";

const COPY = copy({
  es: {
    sent: (organiser: string) => `Idea enviada. ${organiser} la verá en el panel.`,
    title: "¿Adónde te gustaría ir?",
    cancel: "Cancelar",
    sending: "Enviando…",
    send: "Enviar idea",
    intro: (organiser: string) => `Propón un destino y ${organiser} lo investigará: vuelos, alojamiento y qué hacer. Si encaja, aparecerá con los demás.`,
    place: "Destino",
    placeHint: "Oporto, las Azores, algún sitio con nieve…",
    why: "Por qué (opcional)",
    already: "Ya propuestos",
    researched: " · investigado",
  },
  en: {
    sent: (organiser: string) => `Idea sent. ${organiser} will see it in the panel.`,
    title: "Where would you like to go?",
    cancel: "Cancel",
    sending: "Sending…",
    send: "Send idea",
    intro: (organiser: string) => `Suggest a destination and ${organiser} will look into it: flights, where to stay and what to do. If it fits, it'll show up with the rest.`,
    place: "Destination",
    placeHint: "Porto, the Azores, somewhere with snow…",
    why: "Why (optional)",
    already: "Already suggested",
    researched: " · looked into",
  },
});

export interface SuggestDialogProps {
  open: boolean;
  planId: string;
  organiser: string;
  onClose: () => void;
}

// "¿Adónde te gustaría ir?": a friend's idea goes to the organiser, who can
// research it from the panel. Everyone on the trip sees what's been suggested.
export function SuggestDialog({ open, planId, organiser, onClose }: SuggestDialogProps) {
  const source = useSource();
  const t = useCopy(COPY);
  const toast = useToast();
  const [ideas, setIdeas] = useState<SuggestionView[] | null>(null);
  const [place, setPlace] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setError(null);
    source.suggestions(planId).then(setIdeas, () => setIdeas([]));
  }, [open, planId, source]);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      setIdeas(await source.suggest(planId, place, note));
      toast(t.sent(organiser));
      setPlace("");
      setNote("");
      onClose();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const shown = (ideas ?? []).filter((i) => i.status !== "dismissed");

  return (
    <Dialog
      open={open}
      title={t.title}
      onClose={onClose}
      actions={
        <>
          <Button onClick={onClose}>{t.cancel}</Button>
          <Button variant="primary" type="submit" form="idea" disabled={busy || !place.trim()}>
            {busy ? t.sending : t.send}
          </Button>
        </>
      }
    >
      <form id="idea" onSubmit={submit} className="flex flex-col gap-3.5">
        <span>
          {t.intro(organiser)}
        </span>
        <Field label={t.place}>
          {({ inputId }) => <TextInput id={inputId} required maxLength={80} placeholder={t.placeHint} value={place} onChange={(e) => setPlace(e.target.value)} />}
        </Field>
        <Field label={t.why}>
          {({ inputId }) => <TextArea id={inputId} maxLength={500} rows={3} value={note} onChange={(e) => setNote(e.target.value)} />}
        </Field>
        {error && <Notice role="alert">{error}</Notice>}
        {shown.length > 0 && (
          <div className="flex flex-col gap-1.5 border-t border-line-faint pt-3">
            <span className="text-[13px] font-bold">{t.already}</span>
            <ul className="m-0 flex list-none flex-col gap-1 p-0 text-sm">
              {shown.map((i) => (
                <li key={i.id}>
                  <strong className="font-semibold">{i.place}</strong> <span className="text-muted">· {i.member.name}{i.status === "researched" ? t.researched : ""}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </form>
    </Dialog>
  );
}
