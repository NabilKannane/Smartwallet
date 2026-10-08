import "server-only";

import { neon } from "@neondatabase/serverless";

import { parseDevise, type Devise, type Verdict } from "./finance";

/** Base Postgres hébergée sur Neon. Même schéma que l'ancienne base SQLite de l'app Streamlit. */
if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL manquant : ajoute la chaîne de connexion Neon dans client/.env.local");
}

const sql = neon(process.env.DATABASE_URL);

declare global {
  // eslint-disable-next-line no-var
  var __fmSchema: Promise<void> | undefined;
}

async function createSchema() {
  await sql`
    CREATE TABLE IF NOT EXISTS transactions (
      id SERIAL PRIMARY KEY,
      date TEXT NOT NULL,
      type TEXT NOT NULL,
      categorie TEXT NOT NULL,
      description TEXT,
      montant DOUBLE PRECISION NOT NULL
    )`;
  await sql`
    CREATE TABLE IF NOT EXISTS fixed_items (
      id SERIAL PRIMARY KEY,
      nom TEXT NOT NULL,
      categorie TEXT NOT NULL,
      montant DOUBLE PRECISION NOT NULL
    )`;
  await sql`
    CREATE TABLE IF NOT EXISTS wishlist (
      id SERIAL PRIMARY KEY,
      nom TEXT NOT NULL,
      prix DOUBLE PRECISION NOT NULL,
      priorite TEXT NOT NULL,
      note TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )`;
  await sql`
    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT
    )`;
  await sql`
    CREATE TABLE IF NOT EXISTS conversations (
      id TEXT PRIMARY KEY,
      titre TEXT NOT NULL,
      pinned BOOLEAN NOT NULL DEFAULT false,
      messages JSONB NOT NULL DEFAULT '[]',
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )`;
}

/** Crée les tables une seule fois par processus, avant la première requête. */
function ready(): Promise<void> {
  globalThis.__fmSchema ??= createSchema().catch((e) => {
    globalThis.__fmSchema = undefined;
    throw e;
  });
  return globalThis.__fmSchema;
}

export type TxType = "Dépense" | "Revenu";

export interface Transaction {
  id: number;
  date: string; // YYYY-MM-DD
  type: TxType;
  categorie: string;
  description: string | null;
  montant: number;
}

export interface FixedItem {
  id: number;
  nom: string;
  categorie: string;
  montant: number;
}

export interface WishItem {
  id: number;
  nom: string;
  prix: number;
  priorite: string;
  note: string | null;
}

export type ChatMessage = { role: "user"; text: string } | { role: "assistant"; text: string; verdict: Verdict | null };

export interface ConversationSummary {
  id: string;
  titre: string;
  pinned: boolean;
}

export interface Conversation extends ConversationSummary {
  messages: ChatMessage[];
}

// --- Transactions ---

export async function listTransactions(from?: string, to?: string): Promise<Transaction[]> {
  await ready();
  if (from && to) {
    return (await sql`
      SELECT * FROM transactions WHERE date >= ${from} AND date <= ${to} ORDER BY date DESC, id DESC
    `) as Transaction[];
  }
  return (await sql`SELECT * FROM transactions ORDER BY date DESC, id DESC`) as Transaction[];
}

export async function insertTransaction(t: Omit<Transaction, "id"> & { id?: number }): Promise<number> {
  await ready();
  if (t.id) {
    await sql`
      INSERT INTO transactions (id, date, type, categorie, description, montant)
      VALUES (${t.id}, ${t.date}, ${t.type}, ${t.categorie}, ${t.description}, ${t.montant})
    `;
    return t.id;
  }
  const [row] = await sql`
    INSERT INTO transactions (date, type, categorie, description, montant)
    VALUES (${t.date}, ${t.type}, ${t.categorie}, ${t.description}, ${t.montant})
    RETURNING id
  `;
  return Number(row.id);
}

export async function removeTransaction(id: number): Promise<Transaction | undefined> {
  await ready();
  const [row] = await sql`DELETE FROM transactions WHERE id = ${id} RETURNING *`;
  return row as Transaction | undefined;
}

export async function monthBounds(): Promise<{ first: string | null; last: string | null }> {
  await ready();
  const [row] = await sql`SELECT MIN(date) AS first, MAX(date) AS last FROM transactions`;
  return row as { first: string | null; last: string | null };
}

// --- Charges fixes ---

export async function listFixedItems(): Promise<FixedItem[]> {
  await ready();
  return (await sql`SELECT * FROM fixed_items ORDER BY categorie, nom`) as FixedItem[];
}

export async function insertFixedItem(nom: string, categorie: string, montant: number) {
  await ready();
  await sql`INSERT INTO fixed_items (nom, categorie, montant) VALUES (${nom}, ${categorie}, ${montant})`;
}

export async function updateFixedItem(id: number, nom: string, categorie: string, montant: number) {
  await ready();
  await sql`UPDATE fixed_items SET nom = ${nom}, categorie = ${categorie}, montant = ${montant} WHERE id = ${id}`;
}

export async function removeFixedItem(id: number) {
  await ready();
  await sql`DELETE FROM fixed_items WHERE id = ${id}`;
}

// --- Wishlist ---

export async function listWishlist(): Promise<WishItem[]> {
  await ready();
  return (await sql`
    SELECT id, nom, prix, priorite, note FROM wishlist
    ORDER BY CASE priorite WHEN 'Haute' THEN 0 WHEN 'Moyenne' THEN 1 ELSE 2 END, prix, id
  `) as WishItem[];
}

export async function insertWish(nom: string, prix: number, priorite: string, note: string | null) {
  await ready();
  await sql`INSERT INTO wishlist (nom, prix, priorite, note) VALUES (${nom}, ${prix}, ${priorite}, ${note})`;
}

export async function updateWish(id: number, nom: string, prix: number, priorite: string, note: string | null) {
  await ready();
  await sql`UPDATE wishlist SET nom = ${nom}, prix = ${prix}, priorite = ${priorite}, note = ${note} WHERE id = ${id}`;
}

export async function removeWish(id: number) {
  await ready();
  await sql`DELETE FROM wishlist WHERE id = ${id}`;
}

// --- Conversations de l'assistant ---

export async function listConversations(): Promise<ConversationSummary[]> {
  await ready();
  return (await sql`
    SELECT id, titre, pinned FROM conversations ORDER BY updated_at DESC LIMIT 100
  `) as ConversationSummary[];
}

export async function getConversation(id: string): Promise<Conversation | undefined> {
  await ready();
  const [row] = await sql`SELECT id, titre, pinned, messages FROM conversations WHERE id = ${id}`;
  return row as Conversation | undefined;
}

/** Ajoute des messages à une conversation, en la créant si besoin. Le titre n'est fixé qu'à la création. */
export async function appendMessages(id: string, titre: string, messages: ChatMessage[]) {
  await ready();
  await sql`
    INSERT INTO conversations (id, titre, messages) VALUES (${id}, ${titre}, ${JSON.stringify(messages)}::jsonb)
    ON CONFLICT (id) DO UPDATE SET messages = conversations.messages || EXCLUDED.messages, updated_at = now()
  `;
}

export async function setConversationPinned(id: string, pinned: boolean) {
  await ready();
  await sql`UPDATE conversations SET pinned = ${pinned} WHERE id = ${id}`;
}

export async function removeConversation(id: string) {
  await ready();
  await sql`DELETE FROM conversations WHERE id = ${id}`;
}

// --- Paramètres ---

export async function getSetting(key: string, fallback = ""): Promise<string> {
  await ready();
  const [row] = await sql`SELECT value FROM settings WHERE key = ${key}`;
  return (row?.value as string | null | undefined) ?? fallback;
}

export async function setSetting(key: string, value: string) {
  await ready();
  await sql`
    INSERT INTO settings (key, value) VALUES (${key}, ${value})
    ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value
  `;
}

export async function getSalary(): Promise<number> {
  const v = parseFloat(await getSetting("salaire_mensuel", "0"));
  return Number.isFinite(v) ? v : 0;
}

export async function getDevise(): Promise<Devise> {
  return parseDevise(await getSetting("devise", "EUR"));
}
