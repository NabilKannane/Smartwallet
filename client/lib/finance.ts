/** Règles métier partagées par le serveur et le client (aucune dépendance serveur ici). */

export const CATEGORIES_DEPENSE = [
  "Alimentation",
  "Logement",
  "Transport",
  "Santé",
  "Loisirs",
  "Shopping",
  "Factures",
  "Autres",
] as const;

export const CATEGORIES_REVENU = ["Salaire", "Freelance", "Investissement", "Autres"] as const;

export const CATEGORIES_FIXES = ["Logement", "Facture", "Abonnement", "Transport", "Assurance", "Autres"] as const;

/** Plaque d'identité fixe par catégorie : code court + couleur, identique dans toute l'app. */
const PLATES: Record<string, { code: string; color: string }> = {
  Alimentation: { code: "ALI", color: "#E9A23B" },
  Logement: { code: "LOG", color: "#7E9BDB" },
  Transport: { code: "TRA", color: "#5DB6AA" },
  Santé: { code: "SAN", color: "#E58C9A" },
  Loisirs: { code: "LOI", color: "#A88ADA" },
  Shopping: { code: "SHO", color: "#DCC552" },
  Factures: { code: "FAC", color: "#D39577" },
  Facture: { code: "FAC", color: "#D39577" },
  Abonnement: { code: "ABO", color: "#93BF7E" },
  Assurance: { code: "ASS", color: "#9DAABA" },
  Salaire: { code: "SAL", color: "#7FE0C4" },
  Freelance: { code: "FRE", color: "#A9E8D3" },
  Investissement: { code: "INV", color: "#62C7A6" },
  Autres: { code: "AUT", color: "#C4BCAD" },
};

export function plateFor(categorie: string) {
  return PLATES[categorie] ?? { code: categorie.slice(0, 3).toUpperCase(), color: "#C4BCAD" };
}

const euro = new Intl.NumberFormat("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const euroRound = new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 0 });

/** 1234.5 → "1 234,50" (espaces fines insécables du format fr-FR). */
export function money(n: number): string {
  return euro.format(n);
}

export function moneyRound(n: number): string {
  return euroRound.format(n);
}

export function signed(n: number): string {
  return `${n < 0 ? "−" : "+"}${money(Math.abs(n))}`;
}

// --- Mois ---

export type MonthKey = string; // "YYYY-MM"

export function monthKey(d: Date): MonthKey {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

export function todayISO(): string {
  const d = new Date();
  return `${monthKey(d)}-${String(d.getDate()).padStart(2, "0")}`;
}

export function parseMonth(m: string | undefined | null): MonthKey {
  return m && /^\d{4}-(0[1-9]|1[0-2])$/.test(m) ? m : monthKey(new Date());
}

export function shiftMonth(m: MonthKey, delta: number): MonthKey {
  const [y, mo] = m.split("-").map(Number);
  return monthKey(new Date(y, mo - 1 + delta, 1));
}

export function daysInMonth(m: MonthKey): number {
  const [y, mo] = m.split("-").map(Number);
  return new Date(y, mo, 0).getDate();
}

export function monthRange(m: MonthKey): { from: string; to: string } {
  return { from: `${m}-01`, to: `${m}-${String(daysInMonth(m)).padStart(2, "0")}` };
}

const monthFmt = new Intl.DateTimeFormat("fr-FR", { month: "long", year: "numeric" });
const monthShortFmt = new Intl.DateTimeFormat("fr-FR", { month: "short" });
const dayFmt = new Intl.DateTimeFormat("fr-FR", { weekday: "short", day: "numeric", month: "short" });

export function monthLabel(m: MonthKey): string {
  const [y, mo] = m.split("-").map(Number);
  const s = monthFmt.format(new Date(y, mo - 1, 1));
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export function monthShort(m: MonthKey): string {
  const [y, mo] = m.split("-").map(Number);
  return monthShortFmt.format(new Date(y, mo - 1, 1)).replace(".", "");
}

export function dayLabel(iso: string): string {
  const [y, mo, d] = iso.split("-").map(Number);
  return dayFmt.format(new Date(y, mo - 1, d));
}

// --- Reste du mois ---

export interface TxLite {
  id: number;
  date: string;
  type: "Dépense" | "Revenu";
  categorie: string;
  description: string | null;
  montant: number;
}

/** Une transaction compte-t-elle dans le Reste ? Le salaire est déjà porté par le réglage. */
export function countsInReste(t: Pick<TxLite, "type" | "categorie">): boolean {
  return !(t.type === "Revenu" && t.categorie === "Salaire");
}

export interface TapeLine extends TxLite {
  /** Reste après cette ligne (lecture du ticket). */
  after: number;
  counted: boolean;
}

export interface MonthReste {
  salaire: number;
  charges: number;
  ouverture: number; // salaire − charges
  revenus: number; // hors salaire
  depenses: number;
  reste: number;
  lines: TapeLine[]; // plus récente en premier
  trace: { day: number; reste: number }[]; // reste en fin de journée
  crossedZeroOn: string | null; // date de la ligne qui fait passer sous zéro
  joursRestants: number; // y compris aujourd'hui, 0 si mois passé
}

export function computeMonth(
  month: MonthKey,
  salaire: number,
  charges: number,
  txs: TxLite[],
  today: string = todayISO(),
): MonthReste {
  const ouverture = salaire - charges;
  const chrono = [...txs].sort((a, b) => (a.date === b.date ? a.id - b.id : a.date < b.date ? -1 : 1));

  let running = ouverture;
  let revenus = 0;
  let depenses = 0;
  let crossedZeroOn: string | null = ouverture < 0 ? `${month}-01` : null;
  const withAfter: TapeLine[] = chrono.map((t) => {
    const counted = countsInReste(t);
    if (counted) {
      const before = running;
      if (t.type === "Revenu") {
        running += t.montant;
        revenus += t.montant;
      } else {
        running -= t.montant;
        depenses += t.montant;
      }
      if (before >= 0 && running < 0 && !crossedZeroOn) crossedZeroOn = t.date;
    }
    return { ...t, after: running, counted };
  });

  const nDays = daysInMonth(month);
  const lastDay = today.startsWith(month) ? Number(today.slice(8, 10)) : today > `${month}-31` ? nDays : 0;
  const trace: { day: number; reste: number }[] = [];
  let r = ouverture;
  let i = 0;
  for (let day = 1; day <= lastDay; day++) {
    const iso = `${month}-${String(day).padStart(2, "0")}`;
    while (i < withAfter.length && withAfter[i].date <= iso) {
      r = withAfter[i].after;
      i++;
    }
    trace.push({ day, reste: r });
  }

  const joursRestants = today.startsWith(month) ? nDays - Number(today.slice(8, 10)) + 1 : today < `${month}-01` ? nDays : 0;

  return {
    salaire,
    charges,
    ouverture,
    revenus,
    depenses,
    reste: running,
    lines: withAfter.reverse(),
    trace,
    crossedZeroOn,
    joursRestants,
  };
}

// --- Contexte pour l'agent (même format que format_summary_as_text en Python) ---

export function formatContext(
  salaire: number,
  fixed: { nom: string; categorie: string; montant: number }[],
  month: MonthReste,
): string {
  const f = (n: number) => n.toFixed(2);
  const total = fixed.reduce((s, x) => s + x.montant, 0);
  const lines = [`Salaire mensuel net : ${f(salaire)} €`];
  if (fixed.length) {
    lines.push("Charges fixes mensuelles :");
    for (const item of fixed) lines.push(`  - ${item.nom} (${item.categorie}) : ${f(item.montant)} €`);
  } else {
    lines.push("Charges fixes mensuelles : aucune renseignée");
  }
  lines.push(`Total charges fixes : ${f(total)} €`);
  lines.push(`Reste disponible après charges fixes : ${f(salaire - total)} €`);
  lines.push(`Dépenses variables ce mois-ci : ${f(month.depenses)} €`);
  lines.push(`Autres revenus ce mois-ci : ${f(month.revenus)} €`);
  lines.push(`Reste réel du mois à ce jour : ${f(month.reste)} €`);
  if (month.joursRestants > 0) lines.push(`Jours restants dans le mois : ${month.joursRestants}`);
  return lines.join("\n");
}

// --- Verdict de l'assistant ---

export type Verdict = "Acheter" | "Attendre" | "Éviter";

const KEYWORD = "(acheter|attendre|[ée]viter)(?!\\p{L})(?!\\s*(?:[/,|]|ou\\s))";
// Mot-clé mis en avant (**Attendre**) ou annoncé (« Recommandation : Attendre »).
const STRONG = [
  new RegExp(`(?:\\*\\*|__)\\s*${KEYWORD}\\s*[.!]?\\s*(?:\\*\\*|__)`, "giu"),
  new RegExp(`(?:recommandation|verdict|conseil|décision)[^\\n:]*:\\s*[*_]*\\s*${KEYWORD}`, "giu"),
];
const ANY = /(?<!\p{L})(acheter|attendre|[ée]viter)(?!\p{L})/giu;

function toVerdict(word: string): Verdict {
  const w = word.toLowerCase();
  if (w === "acheter") return "Acheter";
  if (w === "attendre") return "Attendre";
  return "Éviter";
}

/**
 * Recommandation finale de l'assistant, ou null s'il n'a pas tranché.
 * Une phrase qui cite plusieurs options (« acheter, attendre ou éviter ») n'est pas un verdict.
 */
export function extractVerdict(reply: string): Verdict | null {
  let strong: { index: number; word: string } | null = null;
  for (const re of STRONG) {
    for (const m of reply.matchAll(re)) {
      if (!strong || m.index! > strong.index) strong = { index: m.index!, word: m[1] };
    }
  }
  if (strong) return toVerdict(strong.word);

  // L'assistant termine par une question : il attend une précision avant de conclure.
  if (reply.trim().endsWith("?")) return null;

  const sentences = reply.split(/(?<=[.!?])\s+|\n+/);
  for (let i = sentences.length - 1; i >= 0; i--) {
    const found = new Set([...sentences[i].matchAll(ANY)].map((m) => toVerdict(m[1])));
    if (found.size === 1) return [...found][0];
  }
  return null;
}
