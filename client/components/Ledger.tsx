"use client";

import { ArrowDown, ArrowUp } from "lucide-react";
import { useMemo, useState } from "react";

import type { Transaction } from "@/lib/db";
import { MASQUE, moneyOr, signed } from "@/lib/finance";

import { CategoryPlate } from "./CategoryPlate";
import { Cur } from "./Currency";

type Key = "date" | "montant";

const dateFmt = new Intl.DateTimeFormat("fr-FR", { day: "2-digit", month: "2-digit", year: "numeric" });

export function Ledger({ rows, masque }: { rows: Transaction[]; masque: boolean }) {
  const [sort, setSort] = useState<{ key: Key; dir: 1 | -1 }>({ key: "date", dir: -1 });

  const sorted = useMemo(() => {
    const v = (t: Transaction) => (sort.key === "date" ? t.date + String(t.id).padStart(8, "0") : t.type === "Revenu" ? t.montant : -t.montant);
    return [...rows].sort((a, b) => (v(a) < v(b) ? -1 : v(a) > v(b) ? 1 : 0) * sort.dir);
  }, [rows, sort]);

  function header(key: Key, label: string, right = false) {
    const active = sort.key === key;
    const Icon = sort.dir === 1 ? ArrowUp : ArrowDown;
    return (
      <th scope="col" className={right ? "r" : undefined} aria-sort={active ? (sort.dir === 1 ? "ascending" : "descending") : "none"}>
        <button
          type="button"
          className="sort-btn"
          onClick={() => setSort((s) => ({ key, dir: s.key === key ? (s.dir === 1 ? -1 : 1) : -1 }))}
        >
          {label}
          {active && <Icon size={13} aria-hidden />}
        </button>
      </th>
    );
  }

  return (
    <div className="table-scroll">
      <table>
        <thead>
          <tr>
            {header("date", "Date")}
            <th scope="col">Catégorie</th>
            <th scope="col">Libellé</th>
            {header("montant", "Montant", true)}
          </tr>
        </thead>
        <tbody>
          {sorted.map((t) => {
            const [y, m, d] = t.date.split("-").map(Number);
            return (
              <tr key={t.id}>
                <td className="num muted">{dateFmt.format(new Date(y, m - 1, d))}</td>
                <td>
                  <CategoryPlate categorie={t.categorie} />
                </td>
                <td>{t.description || <span className="muted">—</span>}</td>
                <td className={`r num${t.type === "Revenu" ? " text-gain" : ""}`}>
                  {masque ? MASQUE : signed(t.type === "Revenu" ? t.montant : -t.montant)}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <p className="scale-note">
        {rows.length} {rows.length > 1 ? "lignes" : "ligne"} · total dépenses{" "}
        <span className="num">{moneyOr(
            masque,
            rows.filter((r) => r.type === "Dépense").reduce((s, r) => s + r.montant, 0),
          )} <Cur /></span>
      </p>
    </div>
  );
}
