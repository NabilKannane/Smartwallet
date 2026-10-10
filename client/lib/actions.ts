"use server";

import { revalidatePath } from "next/cache";

import {
  insertFixedItem,
  insertTransaction,
  insertWish,
  removeConversation,
  removeFixedItem,
  removeTransaction,
  removeWish,
  setConversationPinned,
  setSetting,
  updateFixedItem,
  updateWish,
  type Transaction,
} from "./db";
import {
  CATEGORIES_DEPENSE,
  CATEGORIES_FIXES,
  CATEGORIES_REVENU,
  isConversationId,
  isMcpClient,
  parseDevise,
  PRIORITES,
} from "./finance";

export type ActionResult = { ok: true; id?: number } | { ok: false; error: string };

function parseAmount(raw: FormDataEntryValue | null): number {
  if (typeof raw !== "string") return NaN;
  return Number(raw.replace(/\s/g, "").replace(",", "."));
}

function refreshAll() {
  revalidatePath("/", "layout");
}

// --- Transactions ---

export async function addTransaction(_: ActionResult | null, form: FormData): Promise<ActionResult> {
  const type = form.get("type") === "Revenu" ? "Revenu" : "Dépense";
  const categorie = String(form.get("categorie") ?? "");
  const description = String(form.get("description") ?? "").trim() || null;
  const date = String(form.get("date") ?? "");
  const montant = parseAmount(form.get("montant"));

  const allowed: readonly string[] = type === "Revenu" ? CATEGORIES_REVENU : CATEGORIES_DEPENSE;
  if (!allowed.includes(categorie)) return { ok: false, error: "Choisis une catégorie." };
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return { ok: false, error: "La date est invalide." };
  if (!Number.isFinite(montant) || montant <= 0) return { ok: false, error: "Le montant doit être supérieur à 0." };

  const id = await insertTransaction({ date, type, categorie, description, montant: Math.round(montant * 100) / 100 });
  refreshAll();
  return { ok: true, id };
}

export async function deleteTransaction(id: number): Promise<Transaction | null> {
  const row = await removeTransaction(id);
  refreshAll();
  return row ?? null;
}

export async function restoreTransaction(t: Transaction): Promise<void> {
  await insertTransaction(t);
  refreshAll();
}

// --- Budget ---

export async function saveSalary(_: ActionResult | null, form: FormData): Promise<ActionResult> {
  const v = parseAmount(form.get("salaire"));
  if (!Number.isFinite(v) || v < 0) return { ok: false, error: "Indique un salaire positif ou nul." };
  await setSetting("salaire_mensuel", String(v));
  refreshAll();
  return { ok: true };
}

export async function saveDevise(devise: string): Promise<void> {
  await setSetting("devise", parseDevise(devise));
  refreshAll();
}

function readFixed(form: FormData): { nom: string; categorie: string; montant: number } | string {
  const nom = String(form.get("nom") ?? "").trim();
  const categorie = String(form.get("categorie") ?? "");
  const montant = parseAmount(form.get("montant"));
  if (!nom) return "Donne un nom à cette charge.";
  if (!(CATEGORIES_FIXES as readonly string[]).includes(categorie)) return "Choisis une catégorie.";
  if (!Number.isFinite(montant) || montant <= 0) return "Le montant doit être supérieur à 0.";
  return { nom, categorie, montant: Math.round(montant * 100) / 100 };
}

export async function addFixed(_: ActionResult | null, form: FormData): Promise<ActionResult> {
  const f = readFixed(form);
  if (typeof f === "string") return { ok: false, error: f };
  await insertFixedItem(f.nom, f.categorie, f.montant);
  refreshAll();
  return { ok: true };
}

export async function editFixed(_: ActionResult | null, form: FormData): Promise<ActionResult> {
  const id = Number(form.get("id"));
  if (!Number.isInteger(id) || id <= 0) return { ok: false, error: "Charge introuvable : recharge la page." };
  const f = readFixed(form);
  if (typeof f === "string") return { ok: false, error: f };
  await updateFixedItem(id, f.nom, f.categorie, f.montant);
  refreshAll();
  return { ok: true };
}

export async function deleteFixed(id: number): Promise<void> {
  await removeFixedItem(id);
  refreshAll();
}

// --- Wishlist ---

function readWish(form: FormData): { nom: string; prix: number; priorite: string; note: string | null } | string {
  const nom = String(form.get("nom") ?? "").trim();
  const prix = parseAmount(form.get("prix"));
  const priorite = String(form.get("priorite") ?? "");
  const note = String(form.get("note") ?? "").trim() || null;
  if (!nom) return "Donne un nom à cet achat.";
  if (!Number.isFinite(prix) || prix <= 0) return "Le prix doit être supérieur à 0.";
  if (!(PRIORITES as readonly string[]).includes(priorite)) return "Choisis une priorité.";
  return { nom, prix: Math.round(prix * 100) / 100, priorite, note };
}

export async function addWish(_: ActionResult | null, form: FormData): Promise<ActionResult> {
  const w = readWish(form);
  if (typeof w === "string") return { ok: false, error: w };
  await insertWish(w.nom, w.prix, w.priorite, w.note);
  refreshAll();
  return { ok: true };
}

export async function editWish(_: ActionResult | null, form: FormData): Promise<ActionResult> {
  const id = Number(form.get("id"));
  if (!Number.isInteger(id) || id <= 0) return { ok: false, error: "Achat introuvable : recharge la page." };
  const w = readWish(form);
  if (typeof w === "string") return { ok: false, error: w };
  await updateWish(id, w.nom, w.prix, w.priorite, w.note);
  refreshAll();
  return { ok: true };
}

export async function deleteWish(id: number): Promise<void> {
  await removeWish(id);
  refreshAll();
}

// --- Conversations ---

export async function pinConversation(id: string, pinned: boolean): Promise<void> {
  if (!isConversationId(id)) return;
  await setConversationPinned(id, pinned);
  revalidatePath("/assistant");
}

export async function deleteConversation(id: string): Promise<void> {
  if (!isConversationId(id)) return;
  await removeConversation(id);
  revalidatePath("/assistant");
}

// --- Connexions MCP ---

const AI = process.env.AI_SERVICE_URL ?? "http://localhost:8000";

export async function disconnectMcpClient(client: string): Promise<ActionResult> {
  if (!isMcpClient(client)) return { ok: false, error: "Client inconnu." };
  try {
    const res = await fetch(`${AI}/mcp-clients/${client}/disconnect`, {
      method: "POST",
      signal: AbortSignal.timeout(5000),
      cache: "no-store",
    });
    if (!res.ok) return { ok: false, error: "Le service IA a refusé la déconnexion." };
  } catch {
    return { ok: false, error: "Service IA injoignable." };
  }
  revalidatePath("/mcp");
  return { ok: true };
}
