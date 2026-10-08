import { ArrowRight } from "lucide-react";
import Link from "next/link";

import { daysInMonth, MASQUE, money, moneyOr, moneyRound, type MonthKey, type MonthReste } from "@/lib/finance";

function Trace({ month, data, symbole, masque }: { month: MonthKey; data: MonthReste; symbole: string; masque: boolean }) {
  const W = 360;
  const H = 170;
  const PAD_L = 48;
  const PAD_R = 6;
  const PAD_T = 8;
  const PAD_B = 20;
  const n = daysInMonth(month);
  const values = [data.ouverture, ...data.trace.map((p) => p.reste)];
  const hi = Math.max(data.ouverture, ...values, 1);
  const lo = Math.min(0, ...values);
  const x = (day: number) => PAD_L + ((day - 1) / Math.max(n - 1, 1)) * (W - PAD_L - PAD_R);
  const y = (v: number) => PAD_T + (1 - (v - lo) / (hi - lo || 1)) * (H - PAD_T - PAD_B);

  const pts = data.trace.map((p) => [x(p.day), y(p.reste)] as const);
  const path = pts.map(([px, py], i) => `${i ? "L" : "M"}${px.toFixed(1)},${py.toFixed(1)}`).join(" ");
  const area = pts.length
    ? `${path} L${pts[pts.length - 1][0].toFixed(1)},${y(lo).toFixed(1)} L${pts[0][0].toFixed(1)},${y(lo).toFixed(1)} Z`
    : "";
  const last = pts[pts.length - 1];
  const todayDay = data.trace.length;
  const crossDay = data.crossedZeroOn?.startsWith(month) ? Number(data.crossedZeroOn.slice(8, 10)) : null;
  const crossPoint = crossDay ? data.trace.find((p) => p.day === crossDay) : null;
  // Projection : dépenser exactement le « par jour » amène à 0 le dernier jour.
  const showProj = last && data.joursRestants > 1 && data.reste > 0;

  const label = masque
    ? "Évolution du reste (montants masqués)."
    : data.trace.length
    ? `Évolution du reste : ${money(data.ouverture)} ${symbole} au 1er, ${money(data.reste)} ${symbole} aujourd'hui.`
    : "Le mois n'a pas encore commencé.";

  return (
    <svg className="trace" viewBox={`0 0 ${W} ${H}`} role="img" aria-label={label}>
      <line className="axis" x1={PAD_L} x2={W - PAD_R} y1={y(lo)} y2={y(lo)} />
      <line className="axis" x1={PAD_L} x2={PAD_L} y1={PAD_T} y2={y(lo)} />
      {lo < 0 && <line className="zero" x1={PAD_L} x2={W - PAD_R} y1={y(0)} y2={y(0)} />}
      {area && <path className="area" d={area} />}
      {showProj && <line className="proj" x1={last[0]} y1={last[1]} x2={x(n)} y2={y(0)} />}
      {last && todayDay < n && <line className="today" x1={last[0]} x2={last[0]} y1={y(lo)} y2={y(lo) + 5} />}
      {path && <path className="line" d={path} />}
      {last && <circle className="dot" cx={last[0]} cy={last[1]} r={3.5} />}
      {crossPoint && <circle className="cross" cx={x(crossPoint.day)} cy={y(crossPoint.reste)} r={4} />}
      <text x={PAD_L - 6} y={y(hi) + 4} textAnchor="end">
        {masque ? MASQUE : moneyRound(hi)}
      </text>
      <text x={PAD_L - 6} y={y(0) + 4} textAnchor="end">
        0
      </text>
      <text x={PAD_L} y={H - 4}>
        1er
      </text>
      {last && todayDay > 3 && todayDay < n - 3 && (
        <text x={last[0]} y={H - 4} textAnchor="middle">
          auj.
        </text>
      )}
      <text x={W - PAD_R} y={H - 4} textAnchor="end">
        {n}
      </text>
    </svg>
  );
}

export function RestePlate({
  month,
  data,
  isCurrent,
  symbole,
  masque,
}: {
  month: MonthKey;
  data: MonthReste;
  isCurrent: boolean;
  symbole: string;
  masque: boolean;
}) {
  if (data.salaire <= 0) {
    return (
      <section className="plate" aria-labelledby="reste-title">
        <div className="plate-empty">
          <h2 id="reste-title" className="text-step-2">
            Le reste du mois s’affichera ici
          </h2>
          <p>
            Pour le calculer, SmartWallet a besoin de ton salaire mensuel net et de tes charges fixes. Ça prend une
            minute, et tu ne le fais qu’une fois.
          </p>
          <div>
            <Link href="/budget" className="btn btn-on-plate">
              Renseigner mon budget <ArrowRight size={16} aria-hidden />
            </Link>
          </div>
        </div>
      </section>
    );
  }

  // Masqué : on ne trahit pas non plus le signe du reste.
  const negative = !masque && data.reste < 0;
  const show = (n: number) => moneyOr(masque, n);
  const perDay = data.joursRestants > 0 ? data.reste / data.joursRestants : null;

  return (
    <section className={`plate${negative ? " is-negative" : ""}`} aria-labelledby="reste-title">
      <div>
        <div className="plate-figure">
          <span className="num vfd-refresh" key={data.reste}>
            {show(data.reste)}
          </span>
          <span className="unit">{symbole}</span>
          <h2 id="reste-title" className="caption">
            {negative
              ? isCurrent
                ? "de dépassement ce mois-ci"
                : "de dépassement sur ce mois"
              : isCurrent
                ? "qui te restent vraiment ce mois-ci"
                : "restants en fin de mois"}
          </h2>
        </div>

        <div className="equation" aria-label="Détail du calcul">
          <div>
            <span>Salaire</span>
            <span className="num">{show(data.salaire)}</span>
          </div>
          <div>
            <span>− Charges fixes</span>
            <span className="num">{show(data.charges)}</span>
          </div>
          {data.revenus > 0 && (
            <div>
              <span>+ Autres revenus</span>
              <span className="num">{show(data.revenus)}</span>
            </div>
          )}
          <div>
            <span>− Dépenses du mois</span>
            <span className="num">{show(data.depenses)}</span>
          </div>
        </div>
      </div>

      <div className="plate-side">
        {perDay !== null && (
          <div className="per-day">
            <span>
              {masque || perDay >= 0 ? "Soit par jour, sur " : "Dépassement par jour restant, sur "}
              {data.joursRestants} {data.joursRestants > 1 ? "jours" : "jour"}
            </span>
            <span className="num">{show(Math.abs(perDay))} {symbole}</span>
          </div>
        )}
        <Trace month={month} data={data} symbole={symbole} masque={masque} />
      </div>
    </section>
  );
}
