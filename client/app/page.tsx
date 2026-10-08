import { ChevronLeft, ChevronRight } from "lucide-react";
import Link from "next/link";

import { CategoryPlate } from "@/components/CategoryPlate";
import { MonthTape } from "@/components/MonthTape";
import { RestePlate } from "@/components/RestePlate";
import { monthBounds } from "@/lib/db";
import { money, monthKey, monthLabel, monthRange, parseMonth, shiftMonth, todayISO } from "@/lib/finance";
import { lastVerdict, loadMonth } from "@/lib/summary";

const relative = new Intl.RelativeTimeFormat("fr-FR", { numeric: "auto" });

function since(iso: string): string {
  const days = Math.round((new Date(iso).getTime() - Date.now()) / 86_400_000);
  return relative.format(days, "day");
}

export default async function CeMois({ searchParams }: { searchParams: Promise<{ m?: string }> }) {
  const { m } = await searchParams;
  const current = monthKey(new Date());
  const month = parseMonth(m);
  const isCurrent = month === current;
  const [{ salaire, fixed, charges, month: data }, { first }, avis] = await Promise.all([
    loadMonth(month),
    monthBounds(),
    lastVerdict(),
  ]);
  const firstMonth = first ? first.slice(0, 7) : current;
  const canPrev = month > firstMonth;
  const canNext = month < current;
  const { from, to } = monthRange(month);
  const today = todayISO();

  return (
    <>
      <header className="page-head">
        <div>
          <h1>{monthLabel(month)}</h1>
          {!isCurrent && <p>Tu regardes un mois passé. Les charges fixes et le salaire sont ceux d’aujourd’hui.</p>}
        </div>
        <nav className="month-nav" aria-label="Changer de mois">
          {canPrev ? (
            <Link href={`/?m=${shiftMonth(month, -1)}`} aria-label="Mois précédent">
              <ChevronLeft size={18} aria-hidden />
            </Link>
          ) : (
            <span aria-disabled="true">
              <ChevronLeft size={18} aria-hidden />
            </span>
          )}
          {canNext ? (
            <Link href={`/?m=${shiftMonth(month, 1)}`} aria-label="Mois suivant">
              <ChevronRight size={18} aria-hidden />
            </Link>
          ) : (
            <span aria-disabled="true">
              <ChevronRight size={18} aria-hidden />
            </span>
          )}
          {!isCurrent && (
            <Link href="/" className="today-link">
              Revenir à ce mois
            </Link>
          )}
        </nav>
      </header>

      <RestePlate month={month} data={data} isCurrent={isCurrent} />

      <div className="month-grid">
        <MonthTape
          lines={data.lines}
          ouverture={data.ouverture}
          defaultDate={isCurrent ? today : to}
          minDate={from}
          maxDate={to}
          crossedZeroOn={data.crossedZeroOn}
          hasSalary={salaire > 0}
        />

        <div className="aside">
          <section className="slip" aria-labelledby="fixed-title">
            <div className="section-head">
              <h2 id="fixed-title">Charges fixes</h2>
              <Link href="/budget">Modifier</Link>
            </div>
            {fixed.length === 0 ? (
              <p className="form-note">
                Aucune charge fixe. Ajoute ton loyer, tes factures et tes abonnements dans{" "}
                <Link href="/budget">Budget</Link>.
              </p>
            ) : (
              <>
                <ul>
                  {fixed.map((f) => (
                    <li key={f.id}>
                      <CategoryPlate categorie={f.categorie} hideName />
                      <span className="cat-name min-w-0 flex-1">
                        {f.nom}
                      </span>
                      <span className="num">{money(f.montant)}</span>
                    </li>
                  ))}
                </ul>
                <div className="total">
                  <span>Total / mois</span>
                  <span className="num">{money(charges)} €</span>
                </div>
              </>
            )}
          </section>

          <section className="stub" aria-labelledby="avis-title">
            <div className="section-head mb-0">
              <h2 id="avis-title">Dernier avis</h2>
              <Link href="/assistant">{avis ? "Nouvelle question" : "Demander"}</Link>
            </div>
            {avis ? (
              <>
                <span className={`verdict-word v-${avis.verdict}`}>{avis.verdict}</span>
                <q>{avis.question}</q>
                <span className="form-note">{since(avis.at)}</span>
              </>
            ) : (
              <p className="form-note">
                Avant un achat, demande à l’assistant : il répond Acheter, Attendre ou Éviter, d’après ce qu’il te reste.
              </p>
            )}
          </section>
        </div>
      </div>
    </>
  );
}
