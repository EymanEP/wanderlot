import { Link } from "react-router";
import { Avatar, Card } from "@wanderlot/ui";
import type { CommentView } from "@wanderlot/core";
import type { Person } from "../data/store.tsx";

// A comment out of context, on the Plan page: who, where, what.
export function CommentCard({ comment, author, place, href }: { comment: CommentView; author: Person; place: string; href: string }) {
  return (
    <Card as="article" variant="flat" padding="none" radius="tile" className="flex flex-col gap-[9px] p-[18px]">
      <div className="flex items-center gap-2.5">
        <Avatar initials={author.initials} tint={author.tint === "accent" ? "mint" : author.tint} size="sm" />
        <span className="flex-1 text-sm font-semibold">{author.name}</span>
        <Link to={href} className="text-xs text-muted no-underline hover:text-ink">
          {place}
        </Link>
      </div>
      <p className="m-0 line-clamp-3 text-sm leading-[1.45] text-ink-2">{comment.body}</p>
    </Card>
  );
}
