import { randomUUID } from "node:crypto";

import { ChevronDown } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { MasqueToggle } from "@/components/BudgetForms";
import { Chat, ServiceStatus } from "@/components/Chat";
import { ChatHistory } from "@/components/ChatHistory";
import { getConversation, getDevise, listConversations, listWishlist } from "@/lib/db";
import { DEVISES, isConversationId, moneyOr, monthKey } from "@/lib/finance";
import { isMasque } from "@/lib/masque";
import { currentContext, loadMonth } from "@/lib/summary";

export const metadata: Metadata = { title: "Assistant" };

export default async function Assistant({ searchParams }: { searchParams: Promise<{ q?: string; c?: string }> }) {
  const { q, c } = await searchParams;
  const [{ salaire, month }, context, devise, masque, wishlist, conversations, conversation] = await Promise.all([
    loadMonth(monthKey(new Date())),
    currentContext(),
    getDevise(),
    isMasque(),
    listWishlist(),
    listConversations(),
    isConversationId(c) ? getConversation(c) : undefined,
  ]);
  // Sans conversation existante dans l'URL, on en démarre une nouvelle.
  const conversationId = conversation?.id ?? randomUUID();
  const symbole = DEVISES[devise].symbole;
  const r = Math.max(0, month.reste);
  // La wishlist est triée par priorité : on propose d'abord l'achat le plus important.
  const wish = wishlist[0];
  const suggestions = [
    wish
      ? `Est-ce que je peux m’acheter « ${wish.nom} » de ma wishlist ?`
      : `Est-ce que je peux m’acheter un ordinateur à 900 ${symbole} ?`,
    ...(wishlist.length > 1 ? ["Dans ma wishlist, qu’est-ce que je devrais acheter en premier ?"] : []),
    `Un week-end à ${masque ? 200 : Math.max(150, Math.round((r * 0.15) / 50) * 50)} ${symbole} ce mois-ci, c’est raisonnable ?`,
    "Combien je peux mettre de côté ce mois-ci sans me priver ?",
  ];

  return (
    <>
      <header className="page-head">
        <div>
          <h1>Assistant achat</h1>
          <p>Avant de payer, demande. La réponse s’appuie sur ton vrai budget, pas sur des moyennes.</p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <MasqueToggle masque={masque} />
          <ServiceStatus />
        </div>
      </header>

      <div className="chat-grid">
        <ChatHistory conversations={conversations} activeId={conversationId} />

        <Chat
          key={conversationId}
          conversationId={conversationId}
          initialMessages={conversation?.messages ?? []}
          suggestions={suggestions}
          initialQuestion={!conversation && typeof q === "string" ? q.slice(0, 500) : ""}
        />

        <aside className="aside">
          <section className="slip" aria-labelledby="ctx-reste">
            <div className="section-head">
              <h2 id="ctx-reste">Reste ce mois</h2>
              <span className={`num font-bold${!masque && month.reste < 0 ? " text-red" : ""}`}>
                {salaire > 0 ? `${moneyOr(masque, month.reste)} ${symbole}` : "—"}
              </span>
            </div>
            <p className="form-note">C’est le chiffre que l’assistant prend comme point de départ.</p>
          </section>

          <section className="slip" aria-labelledby="ctx-wish">
            <div className="section-head">
              <h2 id="ctx-wish">Wishlist</h2>
              <Link href="/wishlist">{wishlist.length ? "Modifier" : "Ajouter"}</Link>
            </div>
            <p className="form-note">
              {wishlist.length
                ? `${wishlist.length} ${wishlist.length > 1 ? "achats prévus" : "achat prévu"}, transmis à l’assistant avec ton budget.`
                : "Ajoute tes achats prévus : l’assistant pourra t’aider à choisir lequel faire et quand."}
            </p>
          </section>

          <details className="slip context-slip">
            <summary>
              Ce que l’assistant reçoit <ChevronDown size={16} aria-hidden />
            </summary>
            {masque ? (
              <p className="form-note mt-3">Montants masqués. Affiche-les pour voir le contexte envoyé.</p>
            ) : (
              <pre className="mt-3">{context}</pre>
            )}
          </details>
        </aside>
      </div>
    </>
  );
}
