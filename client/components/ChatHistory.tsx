"use client";

import { PanelLeftClose, PanelLeftOpen, Pin, PinOff, SquarePen, Trash2 } from "lucide-react";
import { MotionConfig, motion } from "motion/react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

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

// Cookie lu par app/assistant/page.tsx (même nom) : le serveur rend directement le bon état, sans flash.
const HISTORY_COOKIE = "sw-history";

const WIDTH = { open: 248, collapsed: 52 };
const spring = { type: "spring", stiffness: 420, damping: 38 } as const;

export function ChatHistory({
  conversations,
  activeId,
  initialCollapsed,
}: {
  conversations: ConversationSummary[];
  activeId: string;
  initialCollapsed: boolean;
}) {
  const [collapsed, setCollapsed] = useState(initialCollapsed);
  const pinned = conversations.filter((c) => c.pinned);
  const recent = conversations.filter((c) => !c.pinned);

  function toggle() {
    const next = !collapsed;
    setCollapsed(next);
    document.cookie = `${HISTORY_COOKIE}=${next ? "collapsed" : "open"}; path=/; max-age=31536000; samesite=lax`;
  }

  const ToggleIcon = collapsed ? PanelLeftOpen : PanelLeftClose;
  const toggleLabel = collapsed ? "Afficher l’historique" : "Réduire l’historique";

  return (
    <MotionConfig reducedMotion="user" transition={spring}>
      <motion.nav
        className={`chat-history${collapsed ? " is-collapsed" : ""}`}
        aria-label="Historique des conversations"
        initial={false}
        animate={{ width: collapsed ? WIDTH.collapsed : WIDTH.open }}
      >
        <div className="history-head">
          <button
            type="button"
            className="icon-btn icon-btn-plain"
            onClick={toggle}
            aria-expanded={!collapsed}
            aria-label={toggleLabel}
            title={toggleLabel}
          >
            <ToggleIcon size={18} aria-hidden />
          </button>
          {collapsed ? (
            <Link href="/assistant" className="icon-btn icon-btn-plain" aria-label="Nouvelle conversation" title="Nouvelle conversation">
              <SquarePen size={17} aria-hidden />
            </Link>
          ) : (
            <h2>Conversations</h2>
          )}
        </div>

        {!collapsed && (
          <div className="history-body">
            <Link href="/assistant" className="btn btn-primary">
              <SquarePen size={16} aria-hidden /> Nouvelle conversation
            </Link>
            {pinned.length > 0 && <Group title="Épinglées" items={pinned} activeId={activeId} />}
            {recent.length > 0 ? (
              <Group title="Récentes" items={recent} activeId={activeId} />
            ) : (
              pinned.length === 0 && <p className="form-note">Tes conversations apparaîtront ici.</p>
            )}
          </div>
        )}
      </motion.nav>
    </MotionConfig>
  );
}
