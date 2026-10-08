import "server-only";

import { cookies } from "next/headers";

/** Montants masqués ? Oui par défaut, tant que l'utilisateur ne les a pas affichés. Même cookie que components/BudgetForms.tsx. */
export async function isMasque(): Promise<boolean> {
  return (await cookies()).get("sw-budget-masque")?.value !== "0";
}
