"use client";

import { createContext, useContext } from "react";

import { DEVISES, type Devise } from "@/lib/finance";

const DeviseContext = createContext<Devise>("EUR");

export function DeviseProvider({ devise, children }: { devise: Devise; children: React.ReactNode }) {
  return <DeviseContext.Provider value={devise}>{children}</DeviseContext.Provider>;
}

export function useDevise(): Devise {
  return useContext(DeviseContext);
}

/** Symbole de la devise choisie (« DH », « € », « $ »). */
export function useSymbole(): string {
  return DEVISES[useDevise()].symbole;
}

/** Affiche le symbole de la devise ; utilisable aussi dans les composants serveur. */
export function Cur() {
  return <>{useSymbole()}</>;
}
