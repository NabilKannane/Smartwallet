"use client";

import { Check, MessagesSquare, Plus, Trash2 } from "lucide-react";
import Link from "next/link";
import { useActionState, useEffect, useRef, useState, useTransition } from "react";

import { addWish, deleteWish, editWish, type ActionResult } from "@/lib/actions";
import type { WishItem } from "@/lib/db";
import { moneyOr, PRIORITES } from "@/lib/finance";
import { submitKeepingValues } from "@/lib/form";

import { amountProps, MaskedInput, toInput } from "./BudgetForms";
import { useSymbole } from "./Currency";

/** Question pré-remplie pour l'assistant. */
function question(item: WishItem, symbole: string) {
  return `Est-ce que je peux m’acheter « ${item.nom} » à ${toInput(item.prix)} ${symbole} ?`;
}

function Faisable({ prix, reste, masque }: { prix: number; reste: number | null; masque: boolean }) {
  const symbole = useSymbole();
  if (masque || reste === null) return <span className="form-note">—</span>;
  if (prix <= reste) return <span className="wish-ok">Possible ce mois-ci</span>;
  return (
    <span className="wish-ko">
      Dépasse ton reste de <span className="num">{moneyOr(false, prix - Math.max(reste, 0))}</span> {symbole}
    </span>
  );
}

function WishRow({ item, reste, masque }: { item: WishItem; reste: number | null; masque: boolean }) {
  const symbole = useSymbole();
  const [state, action, pending] = useActionState<ActionResult | null, FormData>(editWish, null);
  const [dirty, setDirty] = useState(false);
  const [removing, startRemove] = useTransition();
  const formId = `wish-${item.id}`;

  useEffect(() => {
    if (state?.ok) setDirty(false);
  }, [state]);

  return (
    <tr className={removing ? "opacity-40" : undefined}>
      <td>
        <form id={formId} onSubmit={submitKeepingValues(action)} onChange={() => setDirty(true)}>
          <input type="hidden" name="id" value={item.id} />
        </form>
        <input form={formId} className="input" name="nom" defaultValue={item.nom} aria-label="Nom" required />
        <input
          form={formId}
          className="input wish-note"
          name="note"
          defaultValue={item.note ?? ""}
          placeholder="Note (lien, couleur, taille…)"
          aria-label="Note"
        />
        {state && !state.ok && <span className="form-error">{state.error}</span>}
      </td>
      <td>
        <select form={formId} className="select" name="priorite" defaultValue={item.priorite} aria-label="Priorité">
          {PRIORITES.map((p) => (
            <option key={p} value={p}>
              {p}
            </option>
          ))}
        </select>
      </td>
      <td>
        {masque ? (
          <MaskedInput form={formId} name="prix" defaultValue={toInput(item.prix)} />
        ) : (
          <input
            form={formId}
            className="input num"
            name="prix"
            defaultValue={toInput(item.prix)}
            aria-label={`Prix en ${symbole}`}
            required
            {...amountProps}
          />
        )}
      </td>
      <td>
        <Faisable prix={item.prix} reste={reste} masque={masque} />
      </td>
      <td>
        <div className="row-actions">
          {dirty && (
            <button form={formId} type="submit" className="save-dot" disabled={pending}>
              <Check size={14} strokeWidth={3} aria-hidden className="align-[-2px]" /> {pending ? "…" : "Valider"}
            </button>
          )}
          <Link
            className="icon-btn icon-btn-ask"
            href={`/assistant?q=${encodeURIComponent(question(item, symbole))}`}
            aria-label={`Demander à l’assistant pour ${item.nom}`}
            title="Demander à l’assistant"
          >
            <MessagesSquare size={16} aria-hidden />
          </Link>
          <button
            type="button"
            className="icon-btn"
            aria-label={`Retirer ${item.nom} de la wishlist`}
            disabled={removing}
            onClick={() => startRemove(() => deleteWish(item.id))}
          >
            <Trash2 size={16} aria-hidden />
          </button>
        </div>
      </td>
    </tr>
  );
}

function AddWishRow() {
  const symbole = useSymbole();
  const [state, action, pending] = useActionState<ActionResult | null, FormData>(addWish, null);
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
      <td>
        <form id="wish-new" ref={formRef} onSubmit={submitKeepingValues(action)} />
        <input
          ref={nameRef}
          form="wish-new"
          className="input"
          name="nom"
          placeholder="Téléphone, vélo, voyage…"
          aria-label="Nom du nouvel achat"
          required
        />
        <input form="wish-new" className="input wish-note" name="note" placeholder="Note (facultatif)" aria-label="Note" />
        {state && !state.ok && <span className="form-error">{state.error}</span>}
      </td>
      <td>
        <select form="wish-new" className="select" name="priorite" defaultValue="Moyenne" aria-label="Priorité">
          {PRIORITES.map((p) => (
            <option key={p} value={p}>
              {p}
            </option>
          ))}
        </select>
      </td>
      <td>
        <input
          form="wish-new"
          className="input num"
          name="prix"
          placeholder="0,00"
          aria-label={`Prix en ${symbole}`}
          required
          {...amountProps}
        />
      </td>
      <td />
      <td>
        <div className="row-actions">
          <button form="wish-new" type="submit" className="btn btn-primary" disabled={pending}>
            <Plus size={16} strokeWidth={2.5} aria-hidden /> Ajouter
          </button>
        </div>
      </td>
    </tr>
  );
}

export function WishTable({ items, reste, masque }: { items: WishItem[]; reste: number | null; masque: boolean }) {
  return (
    <div className="table-scroll">
      <table className="fixed-table wish-table">
        <thead>
          <tr>
            <th scope="col">Achat</th>
            <th scope="col">Priorité</th>
            <th scope="col" className="pr-[18px] text-right">
              Prix
            </th>
            <th scope="col">Ce mois-ci</th>
            <th scope="col">
              <span className="sr-only">Actions</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {items.length === 0 && (
            <tr>
              <td colSpan={5} className="form-note px-2 py-4">
                Rien pour l’instant. Note ici ce que tu prévois d’acheter : l’assistant en tiendra compte.
              </td>
            </tr>
          )}
          {items.map((it) => (
            <WishRow
              key={`${it.id}-${it.nom}-${it.prix}-${it.priorite}-${it.note}`}
              item={it}
              reste={reste}
              masque={masque}
            />
          ))}
          <AddWishRow />
        </tbody>
      </table>
    </div>
  );
}
