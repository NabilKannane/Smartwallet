"use client";

import { Plus, Trash2 } from "lucide-react";
import { useActionState, useEffect, useRef, useState, useTransition } from "react";

import { addTransaction, deleteTransaction, restoreTransaction, type ActionResult } from "@/lib/actions";
import type { Transaction } from "@/lib/db";
import {
  CATEGORIES_DEPENSE,
  CATEGORIES_REVENU,
  dayLabel,
  MASQUE,
  moneyOr,
  signed,
  type TapeLine,
} from "@/lib/finance";
import { submitKeepingValues } from "@/lib/form";

import { CategoryPlate } from "./CategoryPlate";
import { useSymbole } from "./Currency";

interface Props {
  lines: TapeLine[];
  ouverture: number;
  defaultDate: string;
  minDate: string;
  maxDate: string;
  crossedZeroOn: string | null;
  hasSalary: boolean;
  masque: boolean;
}

function QuickEntry({ defaultDate, minDate, maxDate }: Pick<Props, "defaultDate" | "minDate" | "maxDate">) {
  const symbole = useSymbole();
  const [type, setType] = useState<"Dépense" | "Revenu">("Dépense");
  const [state, action, pending] = useActionState<ActionResult | null, FormData>(addTransaction, null);
  const formRef = useRef<HTMLFormElement>(null);
  const amountRef = useRef<HTMLInputElement>(null);
  const categories = type === "Revenu" ? CATEGORIES_REVENU : CATEGORIES_DEPENSE;

  useEffect(() => {
    if (state?.ok) {
      const f = formRef.current;
      if (f) {
        (f.elements.namedItem("montant") as HTMLInputElement).value = "";
        (f.elements.namedItem("description") as HTMLInputElement).value = "";
      }
      amountRef.current?.focus();
    }
  }, [state]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      if (e.key.toLowerCase() !== "n" || e.metaKey || e.ctrlKey || e.altKey) return;
      if (t.closest("input, textarea, select, [contenteditable]")) return;
      e.preventDefault();
      amountRef.current?.focus();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <form ref={formRef} onSubmit={submitKeepingValues(action)} className="entry" aria-label="Ajouter une ligne">
      <div className="entry-row">
        <div className="field field-type">
          <span id="type-label">Type</span>
          <div className="segmented" role="radiogroup" aria-labelledby="type-label">
            {(["Dépense", "Revenu"] as const).map((t) => (
              <label key={t}>
                <input
                  type="radio"
                  name="type"
                  value={t}
                  checked={type === t}
                  onChange={() => setType(t)}
                />
                <span>{t}</span>
              </label>
            ))}
          </div>
        </div>
        <label className="field field-amount">
          <span>Montant ({symbole})</span>
          <input
            ref={amountRef}
            className="input num"
            name="montant"
            inputMode="decimal"
            placeholder="0,00"
            autoComplete="off"
            required
            pattern="[0-9]+([,.][0-9]{1,2})?"
            title="Un montant comme 12,50"
          />
        </label>
        <label className="field field-cat">
          <span>Catégorie</span>
          <select className="select" name="categorie" key={type} defaultValue={categories[0]}>
            {categories.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </label>
        <label className="field field-desc">
          <span>Libellé</span>
          <input className="input" name="description" placeholder="Courses, essence, ciné…" autoComplete="off" />
        </label>
        <label className="field field-date">
          <span>Date</span>
          <input className="input" type="date" name="date" defaultValue={defaultDate} min={minDate} max={maxDate} required />
        </label>
        <button className="btn btn-primary entry-submit" type="submit" disabled={pending}>
          <Plus size={16} strokeWidth={2.5} aria-hidden />
          {pending ? "Ajout…" : "Ajouter"}
        </button>
      </div>
      <div className="entry-foot">
        <p className="form-note" role="status">
          {state && !state.ok ? (
            <span className="form-error">{state.error}</span>
          ) : (
            "Ton salaire et tes charges fixes sont déjà déduits : ne saisis ici que le variable."
          )}
        </p>
        <p className="form-note">
          Raccourci <kbd>N</kbd> pour saisir
        </p>
      </div>
    </form>
  );
}

export function MonthTape({ lines, ouverture, defaultDate, minDate, maxDate, crossedZeroOn, hasSalary, masque }: Props) {
  const symbole = useSymbole();
  const [hidden, setHidden] = useState<Set<number>>(new Set());
  const [undo, setUndo] = useState<Transaction | null>(null);
  const [, startTransition] = useTransition();
  const seen = useRef<Set<number> | null>(null);
  const [fresh, setFresh] = useState<Set<number>>(new Set());

  // Repère les lignes qui viennent d'être imprimées (pas au premier rendu).
  useEffect(() => {
    const ids = new Set(lines.map((l) => l.id));
    if (seen.current) {
      const added = [...ids].filter((id) => !seen.current!.has(id));
      if (added.length) setFresh(new Set(added));
    }
    seen.current = ids;
  }, [lines]);

  useEffect(() => {
    if (!undo) return;
    const t = setTimeout(() => setUndo(null), 6000);
    return () => clearTimeout(t);
  }, [undo]);

  const visible = lines.filter((l) => !hidden.has(l.id));
  const crossedId = crossedZeroOn
    ? [...visible].reverse().find((l) => l.counted && l.after < 0 && l.date === crossedZeroOn)?.id
    : undefined;

  const byDay: { date: string; rows: TapeLine[] }[] = [];
  for (const l of visible) {
    const g = byDay[byDay.length - 1];
    if (g && g.date === l.date) g.rows.push(l);
    else byDay.push({ date: l.date, rows: [l] });
  }

  function remove(line: TapeLine) {
    setHidden((h) => new Set(h).add(line.id));
    startTransition(async () => {
      const row = await deleteTransaction(line.id);
      setUndo(row);
      setHidden((h) => {
        const n = new Set(h);
        n.delete(line.id);
        return n;
      });
    });
  }

  function restore() {
    if (!undo) return;
    const row = undo;
    setUndo(null);
    startTransition(() => restoreTransaction(row));
  }

  return (
    <section aria-labelledby="tape-title">
      <div className="section-head">
        <h2 id="tape-title">Le ticket du mois</h2>
        <span className="form-note">
          {visible.length} {visible.length > 1 ? "lignes" : "ligne"}
        </span>
      </div>

      <QuickEntry defaultDate={defaultDate} minDate={minDate} maxDate={maxDate} />

      <div className="tape">
        <table>
          <thead>
            <tr>
              <th className="col-cat" scope="col">
                Catégorie
              </th>
              <th scope="col">Libellé</th>
              <th className="col-act" scope="col">
                <span className="sr-only">Actions</span>
              </th>
              <th className="col-amount" scope="col">
                Montant
              </th>
              <th className="col-after" scope="col">
                Reste après
              </th>
            </tr>
          </thead>

          {byDay.length === 0 && (
            <tbody>
              <tr className="empty">
                <td colSpan={5}>Aucune ligne ce mois-ci. Ta première dépense s’imprimera ici, avec ce qu’il te reste après elle.</td>
              </tr>
            </tbody>
          )}

          {byDay.map((g) => (
            <tbody key={g.date}>
              <tr className="day">
                <th colSpan={4} scope="rowgroup">
                  {dayLabel(g.date)}
                </th>
                <td className="col-after" />
              </tr>
              {g.rows.map((l) => {
                const cls = [
                  fresh.has(l.id) ? "is-new" : "",
                  l.id === crossedId ? "crossed" : "",
                  l.counted ? "" : "uncounted",
                ]
                  .filter(Boolean)
                  .join(" ");
                return (
                  <tr key={l.id} className={cls || undefined}>
                    <td className="col-cat">
                      <CategoryPlate categorie={l.categorie} />
                    </td>
                    <td className="desc" title={l.description ?? undefined}>
                      {l.description || <span className="muted">{l.categorie}</span>}
                      {!l.counted && <span className="muted"> · déjà compté dans le salaire</span>}
                    </td>
                    <td className="col-act">
                      <button
                        type="button"
                        className="icon-btn"
                        onClick={() => remove(l)}
                        aria-label={`Supprimer ${l.description || l.categorie}, ${moneyOr(masque, l.montant)} ${symbole}`}
                      >
                        <Trash2 size={15} aria-hidden />
                      </button>
                    </td>
                    <td className={`col-amount num${l.type === "Revenu" ? " amount-in" : ""}`}>
                      {masque ? MASQUE : signed(l.type === "Revenu" ? l.montant : -l.montant)}
                    </td>
                    <td className={`col-after num${!masque && hasSalary && l.after < 0 ? " after-neg" : ""}`}>
                      {hasSalary ? moneyOr(masque, l.after) : "—"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          ))}

          <tfoot>
            <tr>
              <th colSpan={4} scope="row">
                Ouverture du mois<span className="foot-note"> · salaire − charges fixes</span>
              </th>
              <td className="col-after num">{hasSalary ? moneyOr(masque, ouverture) : "—"}</td>
            </tr>
          </tfoot>
        </table>
      </div>
      <div className="tape-tear" aria-hidden />

      {undo && (
        <div className="toast" role="status">
          <span>
            Ligne supprimée : {undo.description || undo.categorie}, {moneyOr(masque, undo.montant)} {symbole}
          </span>
          <button type="button" onClick={restore}>
            Annuler
          </button>
        </div>
      )}
    </section>
  );
}
