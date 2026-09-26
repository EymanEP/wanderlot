import { useState } from "react";
import { Link, useParams } from "react-router";
import { Chip, EmptyState, Main, PageHeader, ScrollRow, SectionHeader, Select } from "@wanderlot/ui";
import { CommentComposer, CommentThread } from "../components/Comments.tsx";
import { useSite } from "../data/store.tsx";
import { memberOf } from "../lib/view.ts";

// Every conversation in the plan, grouped by destination.
export function ComentariosPage() {
  const site = useSite();
  const { planId } = useParams();
  const { destinations, comments, members, me, now } = site;
  const [filter, setFilter] = useState<string>("all");
  const [target, setTarget] = useState(destinations[0]?.id ?? "");
  const shown = destinations.filter((d) => filter === "all" || d.id === filter);

  return (
    <Main>
      <PageHeader size="display" title="Comentarios" subtitle={`${comments.length} comentarios sobre ${destinations.length} destinos · solo los vemos nosotros seis`} />

      <ScrollRow role="group" aria-label="Filtrar por destino">
        <Chip variant="solid" size="lg" on={filter === "all"} onClick={() => setFilter("all")}>
          Todos · {comments.length}
        </Chip>
        {destinations.map((d) => (
          <Chip key={d.id} variant="solid" size="lg" on={filter === d.id} onClick={() => setFilter(d.id)}>
            {d.place.city} · {comments.filter((c) => c.destinationId === d.id).length}
          </Chip>
        ))}
      </ScrollRow>

      <section className="flex flex-col gap-3 rounded-2xl bg-surface-2 p-4 sm:p-5" aria-label="Nuevo comentario">
        <div className="flex flex-wrap items-center gap-3">
          <span className="text-[13px] font-bold">Comentar sobre</span>
          <Select
            className="w-56"
            size="sm"
            label="Destino del comentario"
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
                  Ver la propuesta
                </Link>
              }
            />
            {list.length === 0 ? (
              <EmptyState title="Nadie ha dicho nada todavía" />
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
