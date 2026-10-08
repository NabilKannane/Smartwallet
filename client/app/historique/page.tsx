import type { Metadata } from "next";
import Link from "next/link";

import { CategoryPlate } from "@/components/CategoryPlate";
import { Ledger } from "@/components/Ledger";
import { getDevise, listTransactions } from "@/lib/db";
import {
  CATEGORIES_DEPENSE,
  CATEGORIES_REVENU,
  DEVISES,
  money,
  moneyRound,
  monthKey,
  monthLabel,
  monthRange,
  monthShort,
  parseMonth,
  plateFor,
  shiftMonth,
  type MonthKey,
} from "@/lib/finance";

export const metadata: Metadata = { title: "Historique" };

type SP = Promise<{ de?: string; a?: string; cat?: string | string[]; f?: string }>;

const ALL_CATS = [...new Set<string>([...CATEGORIES_DEPENSE, ...CATEGORIES_REVENU])];

function monthsBetween(from: MonthKey, to: MonthKey): MonthKey[] {
  const out: MonthKey[] = [];
  for (let m = from; m <= to; m = shiftMonth(m, 1)) out.push(m);
  return out;
}

/** Barres mois par mois, toujours sur la même échelle (max de tout l'historique). */
function MonthBars({
  months,
  totals,
  scaleMax,
  symbole,
}: {
  months: MonthKey[];
  totals: Map<MonthKey, { in: number; out: number }>;
  scaleMax: number;
  symbole: string;
}) {
  const W = 640;
  const H = 220;
  const L = 52;
  const B = 24;
  const T = 8;
  const colW = (W - L) / Math.max(months.length, 1);
  const barW = Math.min(18, colW / 3);
  const y = (v: number) => T + (1 - v / scaleMax) * (H - T - B);
  const ticks = [0, 0.5, 1].map((f) => f * scaleMax);
  const label = months
    .map((m) => {
      const t = totals.get(m) ?? { in: 0, out: 0 };
      return `${monthLabel(m)} : dépenses ${money(t.out)} ${symbole}, revenus ${money(t.in)} ${symbole}`;
    })
    .join(" ; ");

  return (
    <svg className="bars" viewBox={`0 0 ${W} ${H}`} role="img" aria-label={label}>
      {ticks.map((v) => (
        <g key={v}>
          <line className={v === 0 ? "base" : "grid"} x1={L} x2={W} y1={y(v)} y2={y(v)} />
          <text x={L - 8} y={y(v) + 3.5} textAnchor="end">
            {moneyRound(v)}
          </text>
        </g>
      ))}
      {months.map((m, i) => {
        const t = totals.get(m) ?? { in: 0, out: 0 };
        const cx = L + colW * i + colW / 2;
        return (
          <g key={m} className="col">
            <title>{`${monthLabel(m)} — dépenses ${money(t.out)} ${symbole}, revenus ${money(t.in)} ${symbole}`}</title>
            <rect className="b-out" x={cx - barW - 1} width={barW} y={y(t.out)} height={y(0) - y(t.out)} rx={1.5} />
            <rect className="b-in" x={cx + 1} width={barW} y={y(t.in)} height={y(0) - y(t.in)} rx={1.5} />
            {(months.length <= 12 || i % 2 === 0) && (
              <text x={cx} y={H - 6} textAnchor="middle">
                {monthShort(m)}
              </text>
            )}
          </g>
        );
      })}
    </svg>
  );
}

export default async function Historique({ searchParams }: { searchParams: SP }) {
  const sp = await searchParams;
  const [all, devise] = await Promise.all([listTransactions(), getDevise()]);
  const symbole = DEVISES[devise].symbole;
  const current = monthKey(new Date());

  if (all.length === 0) {
    return (
      <>
        <header className="page-head">
          <div>
            <h1>Historique</h1>
          </div>
        </header>
        <div className="empty-state">
          <h2>Rien à comparer pour l’instant</h2>
          <p>Dès que tu auras saisi des dépenses, tu verras ici où va ton argent, mois après mois et par catégorie.</p>
          <Link className="btn btn-primary" href="/">
            Saisir une dépense
          </Link>
        </div>
      </>
    );
  }

  const firstMonth = all[all.length - 1].date.slice(0, 7);
  const lastMonth = all[0].date.slice(0, 7) > current ? all[0].date.slice(0, 7) : current;
  const allMonths = monthsBetween(firstMonth, lastMonth);

  const defaultFrom = allMonths[Math.max(0, allMonths.length - 6)];
  let from = sp.de ? parseMonth(sp.de) : defaultFrom;
  let to = sp.a ? parseMonth(sp.a) : lastMonth;
  if (from > to) [from, to] = [to, from];

  const catsParam = sp.cat === undefined ? (sp.f ? [] : null) : Array.isArray(sp.cat) ? sp.cat : [sp.cat];
  const selected = new Set(catsParam ?? ALL_CATS);

  // Échelle fixe : le plus gros mois de tout l'historique, toutes catégories.
  const fullTotals = new Map<MonthKey, { in: number; out: number }>();
  for (const t of all) {
    const k = t.date.slice(0, 7);
    const v = fullTotals.get(k) ?? { in: 0, out: 0 };
    if (t.type === "Revenu") v.in += t.montant;
    else v.out += t.montant;
    fullTotals.set(k, v);
  }
  const rawMax = Math.max(1, ...[...fullTotals.values()].flatMap((v) => [v.in, v.out]));
  const magnitude = 10 ** Math.floor(Math.log10(rawMax));
  const scaleMax = Math.ceil(rawMax / magnitude) * magnitude;

  const range = { from: monthRange(from).from, to: monthRange(to).to };
  const rows = all.filter((t) => t.date >= range.from && t.date <= range.to && selected.has(t.categorie));

  const totals = new Map<MonthKey, { in: number; out: number }>();
  for (const t of rows) {
    const k = t.date.slice(0, 7);
    const v = totals.get(k) ?? { in: 0, out: 0 };
    if (t.type === "Revenu") v.in += t.montant;
    else v.out += t.montant;
    totals.set(k, v);
  }

  const byCat = new Map<string, number>();
  for (const t of rows) if (t.type === "Dépense") byCat.set(t.categorie, (byCat.get(t.categorie) ?? 0) + t.montant);
  const catList = [...byCat.entries()].sort((a, b) => b[1] - a[1]);
  const catTotal = catList.reduce((s, [, v]) => s + v, 0);
  const catMax = catList[0]?.[1] ?? 1;

  const visibleMonths = monthsBetween(from, to);

  return (
    <>
      <header className="page-head">
        <div>
          <h1>Historique</h1>
          <p>Où part ton argent, mois après mois. Toujours sur la même échelle, pour comparer d’un coup d’œil.</p>
        </div>
      </header>

      <form className="filters" method="get" aria-label="Filtres">
        <input type="hidden" name="f" value="1" />
        <label className="field w-44">
          <span>Du mois</span>
          <select className="select" name="de" defaultValue={from}>
            {allMonths.map((m) => (
              <option key={m} value={m}>
                {monthLabel(m)}
              </option>
            ))}
          </select>
        </label>
        <label className="field w-44">
          <span>Au mois</span>
          <select className="select" name="a" defaultValue={to}>
            {allMonths.map((m) => (
              <option key={m} value={m}>
                {monthLabel(m)}
              </option>
            ))}
          </select>
        </label>
        <fieldset className="flex-[1_1_22rem]">
          <legend>Catégories</legend>
          <div className="chips">
            {ALL_CATS.map((c) => (
              <label key={c} className="chip" style={{ "--plate-color": plateFor(c).color } as React.CSSProperties}>
                <input type="checkbox" name="cat" value={c} defaultChecked={selected.has(c)} />
                <span>{c}</span>
              </label>
            ))}
          </div>
        </fieldset>
        <div className="flex gap-2">
          <button className="btn btn-primary" type="submit">
            Appliquer
          </button>
          <Link className="btn btn-ghost" href="/historique">
            Réinitialiser
          </Link>
        </div>
      </form>

      {rows.length === 0 ? (
        <div className="empty-state mt-8">
          <h2>Aucune ligne pour ces filtres</h2>
          <p>Élargis la période ou coche d’autres catégories.</p>
          <Link className="btn btn-ghost" href="/historique">
            Tout afficher
          </Link>
        </div>
      ) : (
        <>
          <div className="hist-grid">
            <section className="panel" aria-labelledby="mm-title">
              <div className="section-head">
                <h2 id="mm-title">Mois par mois</h2>
                <div className="legend" aria-hidden>
                  <span>
                    <i className="bg-ink" />
                    Dépenses
                  </span>
                  <span>
                    <i className="bg-gain" />
                    Revenus saisis
                  </span>
                </div>
              </div>
              <MonthBars symbole={symbole} months={visibleMonths} totals={totals} scaleMax={scaleMax} />
              <p className="scale-note">
                Échelle fixe de 0 à <span className="num">{moneyRound(scaleMax)} {symbole}</span>, calée sur ton plus gros mois.
              </p>
            </section>

            <section className="panel" aria-labelledby="cat-title">
              <div className="section-head">
                <h2 id="cat-title">Par catégorie</h2>
                <span className="num form-note">{money(catTotal)} {symbole}</span>
              </div>
              {catList.length === 0 ? (
                <p className="form-note">Aucune dépense dans cette sélection.</p>
              ) : (
                <ul className="cat-bars">
                  {catList.map(([c, v]) => (
                    <li key={c} style={{ "--plate-color": plateFor(c).color } as React.CSSProperties}>
                      <CategoryPlate categorie={c} />
                      <span>
                        <span className="num">{money(v)}</span>
                        <span className="share num">{Math.round((v / catTotal) * 100)} %</span>
                      </span>
                      <span className="track" aria-hidden>
                        <span className="fill block" style={{ width: `${(v / catMax) * 100}%` }} />
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </div>

          <section className="panel ledger" aria-labelledby="led-title">
            <div className="section-head">
              <h2 id="led-title">Toutes les lignes</h2>
            </div>
            <Ledger rows={rows} />
          </section>
        </>
      )}
    </>
  );
}
