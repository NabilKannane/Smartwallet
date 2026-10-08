"use client";

import { Pin, PinOff, SquarePen, Trash2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTransition } from "react";

import { deleteConversation, pinConversation } from "@/lib/actions";
import type { ConversationSummary } from "@/lib/db";

function Item({ c, active }: { c: ConversationSummary; active: boolean }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <li className={`history-item${active ? " is-active" : ""}`}>
      <Link href={`/assistant?c=${c.id}`} aria-current={active ? "page" : undefined} title={c.titre}>
        {c.titre}
      </Link>
      <button
        type="button"
        className="icon-btn icon-btn-pin"
        aria-label={c.pinned ? `Désépingler « ${c.titre} »` : `Épingler « ${c.titre} »`}
        title={c.pinned ? "Désépingler" : "Épingler"}
        disabled={pending}
        onClick={() => start(() => pinConversation(c.id, !c.pinned))}
      >
        {c.pinned ? <PinOff size={15} aria-hidden /> : <Pin size={15} aria-hidden />}
      </button>
      <button
        type="button"
        className="icon-btn"
        aria-label={`Supprimer « ${c.titre} »`}
        title="Supprimer"
        disabled={pending}
        onClick={() =>
          start(async () => {
            await deleteConversation(c.id);
            if (active) router.push("/assistant");
          })
        }
      >
        <Trash2 size={15} aria-hidden />
      </button>
    </li>
  );
}

function Group({ title, items, activeId }: { title: string; items: ConversationSummary[]; activeId: string }) {
  return (
    <section className="history-group" aria-label={title}>
      <h2>{title}</h2>
      <ul>
        {items.map((c) => (
          <Item key={c.id} c={c} active={c.id === activeId} />
        ))}
      </ul>
    </section>
  );
}

export function ChatHistory({ conversations, activeId }: { conversations: ConversationSummary[]; activeId: string }) {
  const pinned = conversations.filter((c) => c.pinned);
  const recent = conversations.filter((c) => !c.pinned);
  return (
    <nav className="chat-history" aria-label="Historique des conversations">
      <Link href="/assistant" className="btn btn-primary">
        <SquarePen size={16} aria-hidden /> Nouvelle conversation
      </Link>
      {pinned.length > 0 && <Group title="Épinglées" items={pinned} activeId={activeId} />}
      {recent.length > 0 ? (
        <Group title="Récentes" items={recent} activeId={activeId} />
      ) : (
        pinned.length === 0 && <p className="form-note">Tes conversations apparaîtront ici.</p>
      )}
    </nav>
  );
}
