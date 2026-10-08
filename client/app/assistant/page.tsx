import { ChevronDown } from "lucide-react";
import type { Metadata } from "next";

import { MasqueToggle } from "@/components/BudgetForms";
import { Chat, ServiceStatus } from "@/components/Chat";
import { getDevise } from "@/lib/db";
import { DEVISES, moneyOr, monthKey } from "@/lib/finance";
import { isMasque } from "@/lib/masque";
import { currentContext, loadMonth } from "@/lib/summary";

export const metadata: Metadata = { title: "Assistant" };

export default async function Assistant() {
  const [{ salaire, month }, context, devise, masque] = await Promise.all([
    loadMonth(monthKey(new Date())),
    currentContext(),
    getDevise(),
    isMasque(),
  ]);
  const symbole = DEVISES[devise].symbole;
  const r = Math.max(0, month.reste);
  const suggestions = [
    `Est-ce que je peux m’acheter un ordinateur à 900 ${symbole} ?`,
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
        <Chat suggestions={suggestions} />

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
