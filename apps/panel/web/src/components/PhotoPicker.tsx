import { useEffect, useState, type FormEvent } from "react";
import type { Photo } from "@wanderlot/core";
import { Button, Chip, Dialog, Field, Notice, ScrollRow, Skeleton, TextInput, cn } from "@wanderlot/ui";
import type { PhotoResults } from "../data/backend.ts";

// Up to this many photos per destination: a hero and three tiles on the site.
export const MAX_PHOTOS = 4;

const SOURCE_LABEL: Record<Photo["source"], string> = { wikimedia: "Wikimedia", unsplash: "Unsplash", pexels: "Pexels" };

export interface PhotoPickerProps {
  open: boolean;
  city: string;
  // What research suggested photographing; the first one is searched first.
  suggestions: string[];
  chosen: Photo[];
  search: (query: string) => Promise<PhotoResults>;
  onSave: (photos: Photo[]) => void;
  onClose: () => void;
}

// Search Wikimedia/Unsplash/Pexels and pick up to four, in order. Photos are
// linked, never copied, and each keeps its credit (SPEC §6).
export function PhotoPicker({ open, city, suggestions, chosen, search, onSave, onClose }: PhotoPickerProps) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<PhotoResults | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [picked, setPicked] = useState<Photo[]>(chosen);

  const run = async (q: string) => {
    const text = q.trim();
    if (!text) return;
    setQuery(text);
    setLoading(true);
    setError(null);
    try {
      setResults(await search(text));
    } catch (e) {
      setError((e as Error).message);
      setResults(null);
    } finally {
      setLoading(false);
    }
  };

  // Each time it opens: start from what's saved and search the first idea.
  useEffect(() => {
    if (!open) return;
    setPicked(chosen);
    setResults(null);
    void run(suggestions[0] ?? city);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const toggle = (p: Photo) =>
    setPicked((cur) => (cur.some((x) => x.url === p.url) ? cur.filter((x) => x.url !== p.url) : cur.length < MAX_PHOTOS ? [...cur, p] : cur));

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    void run(query);
  };

  // Results keep their places; picks from earlier searches stay visible first.
  const found = results?.photos ?? [];
  const shown = [...picked.filter((p) => !found.some((x) => x.url === p.url)), ...found];

  return (
    <Dialog
      open={open}
      wide
      title={`Fotos de ${city}`}
      onClose={onClose}
      actions={
        <>
          <Button onClick={onClose}>Cancelar</Button>
          <Button variant="primary" onClick={() => onSave(picked)}>
            {picked.length ? `Guardar ${picked.length} ${picked.length === 1 ? "foto" : "fotos"}` : "Guardar sin fotos"}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-3.5">
        <form onSubmit={onSubmit} className="flex items-end gap-2">
          <Field label="Buscar fotos" className="flex-1">
            {({ inputId }) => <TextInput id={inputId} value={query} onChange={(e) => setQuery(e.target.value)} placeholder={`${city}, un barrio, un monumento…`} />}
          </Field>
          <Button type="submit" disabled={loading}>
            Buscar
          </Button>
        </form>
        {suggestions.length > 0 && (
          <ScrollRow role="group" aria-label="Ideas de Claude">
            {suggestions.map((s) => (
              <Chip key={s} on={s === query} onClick={() => void run(s)}>
                {s}
              </Chip>
            ))}
          </ScrollRow>
        )}

        <p className="m-0 text-[13px] text-muted">
          Elige hasta {MAX_PHOTOS}, en orden: la primera será la portada. {picked.length}/{MAX_PHOTOS} elegidas.
        </p>
        {error && <Notice>No se pudo buscar: {error}</Notice>}
        {results?.errors.map((e) => (
          <Notice key={e.source} tone="neutral">
            {SOURCE_LABEL[e.source]} no respondió ({e.message}); el resto sí.
          </Notice>
        ))}

        <ul className="m-0 grid max-h-[52vh] list-none grid-cols-2 gap-3 overflow-y-auto p-1 sm:grid-cols-3">
          {shown.map((p) => {
            const n = picked.findIndex((x) => x.url === p.url);
            const full = n < 0 && picked.length >= MAX_PHOTOS;
            return (
              <li key={p.url} className="flex min-w-0 flex-col gap-1">
                <button
                  type="button"
                  aria-pressed={n >= 0}
                  aria-label={`${p.alt || city} · ${p.author}`}
                  disabled={full}
                  onClick={() => toggle(p)}
                  className={cn(
                    "relative aspect-[3/2] cursor-pointer overflow-hidden rounded-xl border-0 bg-surface-4 p-0 outline-offset-2 disabled:cursor-not-allowed disabled:opacity-50",
                    n >= 0 && "outline-3 outline-accent outline-solid",
                  )}
                >
                  <img src={p.url} alt="" loading="lazy" className="size-full object-cover" />
                  {n >= 0 && (
                    <span className="absolute top-2 left-2 flex size-7 items-center justify-center rounded-full bg-accent text-sm font-bold text-white">
                      {n + 1}
                    </span>
                  )}
                </button>
                <span className="truncate text-xs text-muted">
                  {p.author} · {SOURCE_LABEL[p.source]}
                  {p.source === "wikimedia" ? ` · ${p.license}` : ""}
                </span>
              </li>
            );
          })}
          {loading && !results && Array.from({ length: 6 }, (_, i) => (
              <li key={i}>
                <Skeleton className="aspect-[3/2] rounded-xl" />
              </li>
            ))}
        </ul>
        {!loading && results && results.photos.length === 0 && picked.length === 0 && (
          <p className="m-0 text-sm text-muted">Nada con «{query}». Prueba con otra búsqueda.</p>
        )}
      </div>
    </Dialog>
  );
}
