import "server-only";

import { getDevise, getSalary, getSetting, listFixedItems, listTransactions, listWishlist } from "./db";
import { computeMonth, formatContext, monthKey, monthRange, type MonthKey, type Verdict } from "./finance";

export async function loadMonth(month: MonthKey) {
  const [salaire, fixed] = await Promise.all([getSalary(), listFixedItems()]);
  const charges = fixed.reduce((s, f) => s + f.montant, 0);
  const { from, to } = monthRange(month);
  const txs = await listTransactions(from, to);
  return { salaire, fixed, charges, month: computeMonth(month, salaire, charges, txs) };
}

export async function currentContext(): Promise<string> {
  const [{ salaire, fixed, month }, devise, wishlist] = await Promise.all([
    loadMonth(monthKey(new Date())),
    getDevise(),
    listWishlist(),
  ]);
  return formatContext(salaire, fixed, month, devise, wishlist);
}

export interface LastVerdict {
  question: string;
  verdict: Verdict;
  at: string;
}

export async function lastVerdict(): Promise<LastVerdict | null> {
  try {
    const raw = await getSetting("dernier_avis", "");
    return raw ? (JSON.parse(raw) as LastVerdict) : null;
  } catch {
    return null;
  }
}
