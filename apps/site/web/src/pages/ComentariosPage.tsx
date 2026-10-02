import { useState } from "react";
import { Link, useParams } from "react-router";
import { copy } from "@wanderlot/core";
import { Chip, EmptyState, Main, PageHeader, ScrollRow, SectionHeader, Select, useCopy } from "@wanderlot/ui";
import { CommentComposer, CommentThread } from "../components/Comments.tsx";
import { useSite } from "../data/store.tsx";
import { groupWord, memberOf } from "../lib/view.ts";

const COPY = copy({
  es: {
    title: "Comentarios",
    subtitle: (comments: number, destinations: number, n: number, word: string) =>
      `${comments} comentarios sobre ${destinations} destinos · solo los vemos nosotros${n > 1 ? ` ${word}` : ""}`,
    filter: "Filtrar por destino",
    all: (n: number) => `Todos · ${n}`,
    newComment: "Nuevo comentario",
    about: "Comentar sobre",
    target: "Destino del comentario",
    see: "Ver la propuesta",
    nobody: "Nadie ha dicho nada todavía",
  },
  en: {
    title: "Comments",
    subtitle: (comments: number, destinations: number, n: number, word: string) =>
      `${comments} comments on ${destinations} destinations · ${n > 1 ? `only the ${word} of us can see them` : "only we can see them"}`,
    filter: "Filter by destination",
    all: (n: number) => `All · ${n}`,
    newComment: "New comment",
    about: "Comment on",
    target: "Destination for the comment",
    see: "See the idea",
    nobody: "Nobody has said anything yet",
  },
});

// Every conversation in the plan, grouped by destination.
export function ComentariosPage() {
  const site = useSite();
  const t = useCopy(COPY);
  const { planId } = useParams();
  const { destinations, comments, members, me, now, plan } = site;
  const [filter, setFilter] = useState<string>("all");
  const [target, setTarget] = useState(destinations[0]?.id ?? "");
  const shown = destinations.filter((d) => filter === "all" || d.id === filter);

  return (
    <Main>
      <PageHeader size="display" title={t.title} subtitle={t.subtitle(comments.length, destinations.length, plan.partySize, groupWord(plan.partySize))} />

      <ScrollRow role="group" aria-label={t.filter}>
        <Chip variant="solid" size="lg" on={filter === "all"} onClick={() => setFilter("all")}>
          {t.all(comments.length)}
        </Chip>
        {destinations.map((d) => (
          <Chip key={d.id} variant="solid" size="lg" on={filter === d.id} onClick={() => setFilter(d.id)}>
            {d.place.city} · {comments.filter((c) => c.destinationId === d.id).length}
          </Chip>
        ))}
      </ScrollRow>

      <section className="flex flex-col gap-3 rounded-2xl bg-surface-2 p-4 sm:p-5" aria-label={t.newComment}>
        <div className="flex flex-wrap items-center gap-3">
          <span className="text-[13px] font-bold">{t.about}</span>
          <Select
            className="w-56"
            size="sm"
            label={t.target}
            value={target}
            onChange={setTarget}
            options={destinations.map((d) => ({ value: d.id, label: d.place.city }))}
          />
        </div>
        <CommentComposer me={me} onSubmit={(body) => site.addComment(target, body)} />
      </section>

      {shown.map((d) => {
        const list = comments.filter((c) => c.destinationId === d.id);
        return (
          <section key={d.id} className="flex flex-col gap-3.5" aria-labelledby={`c-${d.id}`}>
            <SectionHeader
              id={`c-${d.id}`}
              title={`${d.place.city} · ${list.length}`}
              aside={
                <Link to={`/p/${planId}/destinos/${d.id}#comentarios`} className="font-semibold">
                  {t.see}
                </Link>
              }
            />
            {list.length === 0 ? (
              <EmptyState title={t.nobody} />
            ) : (
              <CommentThread
                comments={list}
                members={(id) => memberOf(members, id)}
                me={me}
                now={now}
                liked={site.liked}
                onLike={site.toggleLike}
                onReply={(parentId, body) => site.addComment(d.id, body, parentId)}
              />
            )}
          </section>
        );
      })}
    </Main>
  );
}
