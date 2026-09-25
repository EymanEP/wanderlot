import { useState, type FormEvent, type ReactNode } from "react";
import { relativeTime } from "@wanderlot/core";
import type { MockComment, MockMember } from "@wanderlot/mocks";
import { Avatar, Button, cn, controlClasses } from "@wanderlot/ui";

export interface CommentComposerProps {
  me: MockMember;
  onSubmit: (body: string) => void;
  placeholder?: string;
  size?: "md" | "sm";
  autoFocus?: boolean;
  onCancel?: () => void;
}

export function CommentComposer({ me, onSubmit, placeholder = "Escribe un comentario…", size = "md", autoFocus, onCancel }: CommentComposerProps) {
  const [body, setBody] = useState("");
  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!body.trim()) return;
    onSubmit(body.trim());
    setBody("");
  };
  const md = size === "md";
  return (
    <form onSubmit={submit} className="flex items-center gap-3">
      <Avatar initials={me.initials} tint="accent" size={md ? "xl" : "md"} className="max-sm:hidden" />
      <label className="sr-only" htmlFor={`composer-${placeholder}`}>
        {placeholder}
      </label>
      <input
        id={`composer-${placeholder}`}
        value={body}
        onChange={(e) => setBody(e.target.value)}
        placeholder={placeholder}
        autoFocus={autoFocus}
        onKeyDown={(e) => e.key === "Escape" && onCancel?.()}
        className={cn(controlClasses, "min-w-0 flex-1 rounded-full px-[18px]", md ? "h-[50px]" : "h-11 text-sm")}
      />
      <Button type="submit" variant="dark" pill disabled={!body.trim()} className={md ? "h-[50px] px-6 text-[15px]" : "h-11"}>
        {md ? "Comentar" : "Responder"}
      </Button>
    </form>
  );
}

export interface CommentThreadProps {
  comments: MockComment[]; // this destination's, any order
  members: (id: string) => MockMember;
  me: MockMember;
  now: Date;
  liked: string[];
  onLike: (id: string) => void;
  onReply: (parentId: string, body: string) => void;
}

// Top-level comments oldest first, each with its replies (one level, SPEC §1).
export function CommentThread({ comments, members, me, now, liked, onLike, onReply }: CommentThreadProps) {
  const [replyingTo, setReplyingTo] = useState<string | null>(null);
  const roots = comments.filter((c) => !c.parentId).sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  const replies = (id: string) => comments.filter((c) => c.parentId === id).sort((a, b) => a.createdAt.localeCompare(b.createdAt));

  return (
    <div className="flex flex-col gap-3.5">
      {roots.map((c) => {
        const author = members(c.memberId);
        return (
          <article key={c.id} className="flex gap-3">
            <Avatar initials={author.initials} tint={author.tint === "accent" ? "mint" : author.tint} size="xl" />
            <div className="flex min-w-0 flex-1 flex-col gap-2.5">
              <Bubble comment={c} author={author} now={now} tone="filled">
                <div className="flex gap-4 pt-1">
                  <button
                    type="button"
                    aria-pressed={liked.includes(c.id)}
                    onClick={() => onLike(c.id)}
                    className={cn("cursor-pointer border-0 bg-transparent p-0 text-[13px] font-semibold", liked.includes(c.id) ? "text-accent" : "text-ink-2 hover:text-ink")}
                  >
                    Me gusta · {c.likes}
                  </button>
                  <button
                    type="button"
                    aria-expanded={replyingTo === c.id}
                    onClick={() => setReplyingTo(replyingTo === c.id ? null : c.id)}
                    className="cursor-pointer border-0 bg-transparent p-0 text-[13px] font-semibold text-ink-2 hover:text-ink"
                  >
                    Responder
                  </button>
                </div>
              </Bubble>
              {replies(c.id).map((r) => {
                const ra = members(r.memberId);
                return (
                  <div key={r.id} className="flex gap-3 sm:pl-7">
                    <Avatar initials={ra.initials} tint={ra.tint === "accent" ? "mint" : ra.tint} size="md" />
                    <Bubble comment={r} author={ra} now={now} tone="outline" />
                  </div>
                );
              })}
              {replyingTo === c.id && (
                <div className="sm:pl-7">
                  <CommentComposer
                    me={me}
                    size="sm"
                    autoFocus
                    placeholder={`Responder a ${author.name}…`}
                    onCancel={() => setReplyingTo(null)}
                    onSubmit={(body) => {
                      onReply(c.id, body);
                      setReplyingTo(null);
                    }}
                  />
                </div>
              )}
            </div>
          </article>
        );
      })}
    </div>
  );
}

function Bubble({ comment, author, now, tone, children }: { comment: MockComment; author: MockMember; now: Date; tone: "filled" | "outline"; children?: ReactNode }) {
  return (
    <div className={cn("flex min-w-0 flex-1 flex-col gap-[5px] rounded-2xl px-[18px] py-3.5", tone === "filled" ? "bg-surface-2" : "border border-line-soft")}>
      <div className="flex items-baseline gap-2.5">
        <span className="text-sm font-bold">{author.name}</span>
        <time dateTime={comment.createdAt} className="text-xs text-muted">
          {relativeTime(comment.createdAt, now)}
        </time>
      </div>
      <p className="m-0 text-sm leading-[1.45] text-pretty">{comment.body}</p>
      {children}
    </div>
  );
}
