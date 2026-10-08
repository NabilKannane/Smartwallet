import type { Metadata } from "next";
import Link from "next/link";

import { MasqueToggle } from "@/components/BudgetForms";
import { WishTable } from "@/components/Wishlist";
import { getDevise, listWishlist } from "@/lib/db";
import { DEVISES, moneyOr, monthKey } from "@/lib/finance";
import { isMasque } from "@/lib/masque";
import { loadMonth } from "@/lib/summary";

export const metadata: Metadata = { title: "Wishlist" };

export default async function Wishlist() {
  const [items, { salaire, month }, devise, masque] = await Promise.all([
    listWishlist(),
    loadMonth(monthKey(new Date())),
    getDevise(),
    isMasque(),
  ]);
  const symbole = DEVISES[devise].symbole;
  const reste = salaire > 0 ? month.reste : null;
  const total = items.reduce((s, w) => s + w.prix, 0);
  const possibles = reste === null ? 0 : items.filter((w) => w.prix <= reste).length;

  return (
    <>
      <header className="page-head">
        <div>
          <h1>Wishlist</h1>
          <p>Ce que tu prévois d’acheter. L’assistant connaît cette liste et s’en sert pour te conseiller.</p>
        </div>
        <MasqueToggle masque={masque} />
      </header>

      <div className="budget-grid">
        <section className="panel" aria-labelledby="wish-title">
          <div className="section-head">
            <h2 id="wish-title">Achats prévus</h2>
            <span className="form-note">Modifie une ligne directement, puis valide.</span>
          </div>
          <WishTable items={items} reste={reste} masque={masque} />
        </section>

        <aside className="slip receipt-total" aria-labelledby="wtot-title">
          <h2 id="wtot-title" className="mb-2">
            En bref
          </h2>
          <div className="line">
            <span>
              Total de la liste <span className="muted">({items.length})</span>
            </span>
            <span className="num">
              {moneyOr(masque, total)} {symbole}
            </span>
          </div>
          <div className="line">
            <span>Reste ce mois</span>
            <span className="num">{reste === null ? "—" : `${moneyOr(masque, reste)} ${symbole}`}</span>
          </div>
          {reste === null ? (
            <p className="form-note mt-2">
              Renseigne ton salaire dans <Link href="/budget">Budget</Link> pour savoir ce qui est faisable.
            </p>
          ) : (
            !masque &&
            items.length > 0 && (
              <p className="form-note mt-2">
                {possibles === 0
                  ? "Aucun achat ne tient dans ton reste ce mois-ci."
                  : `${possibles} ${possibles > 1 ? "achats tiennent" : "achat tient"} dans ton reste ce mois-ci (un à la fois).`}
              </p>
            )
          )}
          <Link className="btn btn-ghost mt-2" href="/assistant">
            Demander conseil à l’assistant
          </Link>
        </aside>
      </div>
    </>
  );
}
