import "server-only";

import { cookies } from "next/headers";

/** Montants masqués par l'utilisateur ? Même nom de cookie que dans components/BudgetForms.tsx. */
export async function isMasque(): Promise<boolean> {
  return (await cookies()).get("sw-budget-masque")?.value === "1";
}
