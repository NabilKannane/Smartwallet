import type { Metadata } from "next";

import { DeviseForm, FixedTable, SalaryForm } from "@/components/BudgetForms";
import { getDevise, getSalary, listFixedItems } from "@/lib/db";
import { DEVISES, money } from "@/lib/finance";

export const metadata: Metadata = { title: "Budget" };

export default async function Budget() {
  const [salaire, fixed, devise] = await Promise.all([getSalary(), listFixedItems(), getDevise()]);
  const charges = fixed.reduce((s, f) => s + f.montant, 0);
  const ouverture = salaire - charges;

  return (
    <>
      <header className="page-head">
        <div>
          <h1>Budget</h1>
          <p>Ce qui rentre et ce qui part chaque mois, quoi qu’il arrive. Tout le reste se calcule à partir d’ici.</p>
        </div>
      </header>

      <div className="budget-grid">
        <div className="grid gap-12">
          <section className="panel" aria-labelledby="sal-title">
            <div className="section-head">
              <h2 id="sal-title">Salaire</h2>
            </div>
            <div className="grid gap-6">
              <DeviseForm />
              <SalaryForm salaire={salaire} />
            </div>
          </section>

          <section className="panel" aria-labelledby="fix-title">
            <div className="section-head">
              <h2 id="fix-title">Charges fixes mensuelles</h2>
              <span className="form-note">Modifie une ligne directement, puis valide.</span>
            </div>
            <FixedTable items={fixed} />
          </section>
        </div>

        <aside className="slip receipt-total" aria-labelledby="tot-title">
          <h2 id="tot-title" className="mb-2">
            Chaque mois
          </h2>
          <div className="line">
            <span>Salaire</span>
            <span className="num">{money(salaire)}</span>
          </div>
          <div className="line">
            <span>
              − Charges fixes <span className="muted">({fixed.length})</span>
            </span>
            <span className="num">{money(charges)}</span>
          </div>
          <div className={`plate-sm${ouverture < 0 ? " is-negative" : ""}`}>
            <span>Disponible avant dépenses</span>
            <span className="num">{money(ouverture)} {DEVISES[devise].symbole}</span>
          </div>
          {salaire > 0 && (
            <p className="form-note mt-2">
              Les charges fixes prennent {Math.round((charges / salaire) * 100)} % de ton salaire.
            </p>
          )}
        </aside>
      </div>
    </>
  );
}
