"use client";

import { Check, Eye, EyeOff, Plus, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useActionState, useEffect, useRef, useState, useTransition } from "react";

import { addFixed, deleteFixed, editFixed, saveDevise, saveSalary, type ActionResult } from "@/lib/actions";
import type { FixedItem } from "@/lib/db";
import { CATEGORIES_FIXES, DEVISES, MASQUE, moneyOr, type Devise } from "@/lib/finance";
import { submitKeepingValues } from "@/lib/form";

import { CategoryPlate } from "./CategoryPlate";
import { useDevise, useSymbole } from "./Currency";

export const amountProps = {
  inputMode: "decimal" as const,
  autoComplete: "off",
  pattern: "[0-9 ]+([,.][0-9]{1,2})?",
  title: "Un montant comme 850 ou 49,99",
};

export function toInput(n: number) {
  return n.toFixed(2).replace(".", ",");
}

// Cookie lu par app/budget/page.tsx (même nom).
const MASQUE_COOKIE = "sw-budget-masque";

/** Bouton œil : masque ou affiche les montants de la page Budget. */
export function MasqueToggle({ masque }: { masque: boolean }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const label = masque ? "Afficher les montants" : "Masquer les montants";

  function toggle() {
    document.cookie = `${MASQUE_COOKIE}=${masque ? "0" : "1"}; path=/; max-age=31536000; samesite=lax`;
    startTransition(() => router.refresh());
  }

  return (
    <button type="button" className="btn btn-ghost" onClick={toggle} disabled={pending} aria-pressed={masque}>
      {masque ? <Eye size={16} aria-hidden /> : <EyeOff size={16} aria-hidden />} {label}
    </button>
  );
}

/** Montant masqué : la vraie valeur reste dans un champ caché pour que le formulaire s'envoie normalement. */
export function MaskedInput(props: React.ComponentProps<"input">) {
  return (
    <>
      <input {...props} hidden />
      <span className="input num" aria-label="Montant masqué">
        {MASQUE}
      </span>
    </>
  );
}

export function DeviseForm() {
  const devise = useDevise();
  const [choix, setChoix] = useState(devise);
  const [pending, startTransition] = useTransition();

  function choose(d: Devise) {
    setChoix(d);
    startTransition(() => saveDevise(d));
  }

  return (
    <div className="field">
      <span id="devise-label">Devise du budget</span>
      <div className="segmented" role="radiogroup" aria-labelledby="devise-label" aria-busy={pending}>
        {(Object.keys(DEVISES) as Devise[]).map((d) => (
          <label key={d} title={DEVISES[d].nom}>
            <input type="radio" name="devise" value={d} checked={choix === d} onChange={() => choose(d)} />
            <span>
              {d} · {DEVISES[d].symbole}
            </span>
          </label>
        ))}
      </div>
    </div>
  );
}

export function SalaryForm({ salaire, masque }: { salaire: number; masque: boolean }) {
  const symbole = useSymbole();
  const [state, action, pending] = useActionState<ActionResult | null, FormData>(saveSalary, null);
  const [dirty, setDirty] = useState(false);
  useEffect(() => {
    if (state?.ok) setDirty(false);
  }, [state]);

  return (
    <form onSubmit={submitKeepingValues(action)} className="salary-form" onChange={() => setDirty(true)}>
      <label className="field">
        <span>Salaire mensuel net ({symbole})</span>
        {masque && salaire ? (
          <MaskedInput name="salaire" defaultValue={toInput(salaire)} />
        ) : (
          <input className="input num" name="salaire" defaultValue={salaire ? toInput(salaire) : ""} placeholder="0,00" required {...amountProps} />
        )}
      </label>
      <button className="btn btn-primary" type="submit" disabled={pending || !dirty}>
        {pending ? "Enregistrement…" : "Enregistrer"}
      </button>
      <p className="form-note basis-full" role="status">
        {state && !state.ok ? <span className="form-error">{state.error}</span> : state?.ok && !dirty ? "Salaire enregistré." : ""}
      </p>
    </form>
  );
}

function FixedRow({ item, masque }: { item: FixedItem; masque: boolean }) {
  const [state, action, pending] = useActionState<ActionResult | null, FormData>(editFixed, null);
  const [dirty, setDirty] = useState(false);
  const [removing, startRemove] = useTransition();
  const formId = `fixed-${item.id}`;

  useEffect(() => {
    if (state?.ok) setDirty(false);
  }, [state]);

  return (
    <tr className={removing ? "opacity-40" : undefined}>
      <td className="w-14">
        <CategoryPlate categorie={item.categorie} hideName />
      </td>
      <td>
        <form id={formId} onSubmit={submitKeepingValues(action)} onChange={() => setDirty(true)}>
          <input type="hidden" name="id" value={item.id} />
        </form>
        <input form={formId} className="input" name="nom" defaultValue={item.nom} aria-label="Nom" required onChange={() => setDirty(true)} />
        {state && !state.ok && <span className="form-error">{state.error}</span>}
      </td>
      <td className="w-[22%]">
        <select form={formId} className="select" name="categorie" defaultValue={item.categorie} aria-label="Catégorie" onChange={() => setDirty(true)}>
          {!(CATEGORIES_FIXES as readonly string[]).includes(item.categorie) && <option value={item.categorie}>{item.categorie}</option>}
          {CATEGORIES_FIXES.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
      </td>
      <td className="w-[18%]">
        {masque ? (
          <MaskedInput form={formId} name="montant" defaultValue={toInput(item.montant)} />
        ) : (
          <input form={formId} className="input num" name="montant" defaultValue={toInput(item.montant)} aria-label="Montant" required onChange={() => setDirty(true)} {...amountProps} />
        )}
      </td>
      <td>
        <div className="row-actions">
          {dirty && (
            <button form={formId} type="submit" className="save-dot" disabled={pending}>
              <Check size={14} strokeWidth={3} aria-hidden className="align-[-2px]" /> {pending ? "…" : "Valider"}
            </button>
          )}
          <button
            type="button"
            className="icon-btn"
            aria-label={`Supprimer ${item.nom}`}
            disabled={removing}
            onClick={() => startRemove(() => deleteFixed(item.id))}
          >
            <Trash2 size={16} aria-hidden />
          </button>
        </div>
      </td>
    </tr>
  );
}

function AddFixedRow() {
  const [state, action, pending] = useActionState<ActionResult | null, FormData>(addFixed, null);
  const formRef = useRef<HTMLFormElement>(null);
  const nameRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (state?.ok) {
      formRef.current?.reset();
      nameRef.current?.focus();
    }
  }, [state]);

  return (
    <tr className="add-row">
      <td />
      <td>
        <form id="fixed-new" ref={formRef} onSubmit={submitKeepingValues(action)} />
        <input ref={nameRef} form="fixed-new" className="input" name="nom" placeholder="Loyer, électricité, mutuelle…" aria-label="Nom de la nouvelle charge" required />
        {state && !state.ok && <span className="form-error">{state.error}</span>}
      </td>
      <td>
        <select form="fixed-new" className="select" name="categorie" defaultValue="Facture" aria-label="Catégorie">
          {CATEGORIES_FIXES.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
      </td>
      <td>
        <input form="fixed-new" className="input num" name="montant" placeholder="0,00" aria-label="Montant en euros" required {...amountProps} />
      </td>
      <td>
        <div className="row-actions">
          <button form="fixed-new" type="submit" className="btn btn-primary" disabled={pending}>
            <Plus size={16} strokeWidth={2.5} aria-hidden /> Ajouter
          </button>
        </div>
      </td>
    </tr>
  );
}

export function FixedTable({ items, masque }: { items: FixedItem[]; masque: boolean }) {
  const symbole = useSymbole();
  const total = items.reduce((s, it) => s + it.montant, 0);
  return (
    <div className="table-scroll">
      <table className="fixed-table">
        <thead>
          <tr>
            <th scope="col">
              <span className="sr-only">Plaque</span>
            </th>
            <th scope="col">Nom</th>
            <th scope="col">Catégorie</th>
            <th scope="col" className="pr-[18px] text-right">
              Montant / mois
            </th>
            <th scope="col">
              <span className="sr-only">Actions</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {items.length === 0 && (
            <tr>
              <td colSpan={5} className="form-note px-2 py-4">
                Aucune charge pour l’instant. Commence par le loyer : c’est souvent la plus grosse.
              </td>
            </tr>
          )}
          {items.map((it) => (
            <FixedRow key={`${it.id}-${it.nom}-${it.categorie}-${it.montant}`} item={it} masque={masque} />
          ))}
          <AddFixedRow />
        </tbody>
        {items.length > 0 && (
          <tfoot>
            <tr>
              <th scope="row" colSpan={3}>
                Total des charges fixes
              </th>
              <td className="num pr-4.5 text-right">
                {moneyOr(masque, total)} {symbole}
              </td>
              <td />
            </tr>
          </tfoot>
        )}
      </table>
    </div>
  );
}
