import { describe, expect, it } from "vitest";

import {
  actionMessage,
  computeMonth,
  conversationTitle,
  countsInReste,
  daysInMonth,
  extractVerdict,
  formatContext,
  isConversationId,
  MASQUE,
  money,
  moneyOr,
  monthRange,
  parseActions,
  parseDevise,
  parseMonth,
  shiftMonth,
  signed,
  type TxLite,
} from "./finance";

// fr-FR sépare les milliers par une espace fine insécable : on la remplace pour lire les attentes.
const plain = (s: string) => s.replace(/[  ]/g, " ");

let nextId = 1;
function tx(date: string, type: TxLite["type"], montant: number, categorie = "Alimentation"): TxLite {
  return { id: nextId++, date, type, categorie, description: null, montant };
}

describe("extractVerdict", () => {
  it.each([
    ["Il te reste 300 €.\n\n**Recommandation : Attendre** — mieux vaut le mois prochain.", "Attendre"],
    ["Tu veux acheter un PC à 900 €. Il te reste 400 €.\n\n**Éviter** : ça te mettrait à découvert.", "Éviter"],
    ["Tu peux te le permettre. Verdict : acheter.", "Acheter"],
    ["Recommandation : Acheter / Attendre / Éviter → **Attendre**", "Attendre"],
    ["Je te conseille d'attendre le mois prochain.", "Attendre"],
    ["Tu peux acheter sans souci.", "Acheter"],
  ])("trouve le verdict dans %j", (reply, expected) => {
    expect(extractVerdict(reply)).toBe(expected);
  });

  it.each([
    "Donne-moi le prix et je te dirai s'il vaut mieux acheter, attendre ou éviter.",
    "Tu veux acheter un vélo. Quel est son prix ?",
    "Bonjour, comment puis-je t'aider ?",
    "",
  ])("ne donne aucun verdict pour %j", (reply) => {
    expect(extractVerdict(reply)).toBeNull();
  });
});

describe("actions de l'assistant", () => {
  it("garde les actions valides et ignore le reste", () => {
    expect(
      parseActions([
        { type: "add", target: "wishlist", label: "  Vélo " },
        { type: "drop", target: "wishlist", label: "x" },
        { type: "delete", target: "transactions", label: "x" },
        { type: "update", target: "wishlist" },
        null,
      ]),
    ).toEqual([
      { type: "add", target: "wishlist", label: "Vélo" },
      { type: "update", target: "wishlist", label: "" },
    ]);
    expect(parseActions(undefined)).toEqual([]);
  });

  it("formule la notification", () => {
    expect(actionMessage({ type: "add", target: "wishlist", label: "Vélo" })).toBe("« Vélo » ajouté à ta wishlist");
    expect(actionMessage({ type: "update", target: "wishlist", label: "Vélo" })).toBe("« Vélo » modifié dans ta wishlist");
    expect(actionMessage({ type: "delete", target: "wishlist", label: "" })).toBe("Un article retiré de ta wishlist");
  });
});

describe("conversations", () => {
  it("n'accepte que des UUID comme identifiant", () => {
    expect(isConversationId("3f2b8c1e-9a4d-4e7b-8c2f-1a2b3c4d5e6f")).toBe(true);
    expect(isConversationId("web-abc123")).toBe(false);
    expect(isConversationId("' OR 1=1 --")).toBe(false);
    expect(isConversationId(undefined)).toBe(false);
  });

  it("titre : première question sur une ligne, coupée à 60 caractères", () => {
    expect(conversationTitle("  Je peux acheter\n un vélo ?  ")).toBe("Je peux acheter un vélo ?");
    const t = conversationTitle("a".repeat(100));
    expect(t).toHaveLength(60);
    expect(t.endsWith("…")).toBe(true);
  });
});

describe("devise", () => {
  it("accepte les trois devises", () => {
    expect(parseDevise("MAD")).toBe("MAD");
    expect(parseDevise("EUR")).toBe("EUR");
    expect(parseDevise("USD")).toBe("USD");
  });

  it("revient à EUR pour une valeur inconnue", () => {
    expect(parseDevise("GBP")).toBe("EUR");
    expect(parseDevise("")).toBe("EUR");
    expect(parseDevise(null)).toBe("EUR");
  });
});

describe("format des montants", () => {
  it("formate en fr-FR avec deux décimales", () => {
    expect(plain(money(1234.5))).toBe("1 234,50");
    expect(plain(money(0))).toBe("0,00");
  });

  it("ajoute le signe", () => {
    expect(plain(signed(12.5))).toBe("+12,50");
    expect(plain(signed(-12.5))).toBe("−12,50");
  });

  it("remplace le montant par **** quand il est masqué", () => {
    expect(moneyOr(true, 1234.5)).toBe(MASQUE);
    expect(moneyOr(true, -50)).toBe("****");
    expect(plain(moneyOr(false, 1234.5))).toBe("1 234,50");
  });
});

describe("mois", () => {
  it("valide la clé de mois", () => {
    expect(parseMonth("2026-02")).toBe("2026-02");
    expect(parseMonth("2026-13")).not.toBe("2026-13");
    expect(parseMonth("n'importe quoi")).toMatch(/^\d{4}-\d{2}$/);
  });

  it("change d'année en décalant le mois", () => {
    expect(shiftMonth("2026-01", -1)).toBe("2025-12");
    expect(shiftMonth("2026-12", 1)).toBe("2027-01");
  });

  it("connaît la longueur des mois, années bissextiles comprises", () => {
    expect(daysInMonth("2024-02")).toBe(29);
    expect(daysInMonth("2026-02")).toBe(28);
    expect(daysInMonth("2026-04")).toBe(30);
    expect(monthRange("2026-02")).toEqual({ from: "2026-02-01", to: "2026-02-28" });
  });
});

describe("computeMonth", () => {
  it("part du salaire moins les charges, puis applique dépenses et revenus", () => {
    const m = computeMonth(
      "2026-03",
      2000,
      800,
      [tx("2026-03-02", "Dépense", 150), tx("2026-03-05", "Revenu", 100, "Freelance")],
      "2026-03-10",
    );
    expect(m.ouverture).toBe(1200);
    expect(m.depenses).toBe(150);
    expect(m.revenus).toBe(100);
    expect(m.reste).toBe(1150);
  });

  it("ne compte pas le salaire saisi comme transaction (déjà dans le réglage)", () => {
    expect(countsInReste({ type: "Revenu", categorie: "Salaire" })).toBe(false);
    const m = computeMonth("2026-03", 2000, 0, [tx("2026-03-01", "Revenu", 2000, "Salaire")], "2026-03-10");
    expect(m.reste).toBe(2000);
    expect(m.lines[0].counted).toBe(false);
  });

  it("calcule le reste après chaque ligne, la plus récente en premier", () => {
    const m = computeMonth(
      "2026-03",
      1000,
      0,
      [tx("2026-03-03", "Dépense", 100), tx("2026-03-01", "Dépense", 50)],
      "2026-03-10",
    );
    expect(m.lines.map((l) => [l.date, l.after])).toEqual([
      ["2026-03-03", 850],
      ["2026-03-01", 950],
    ]);
  });

  it("repère le jour où le reste passe sous zéro", () => {
    const m = computeMonth(
      "2026-03",
      500,
      0,
      [tx("2026-03-02", "Dépense", 300), tx("2026-03-04", "Dépense", 300), tx("2026-03-06", "Dépense", 50)],
      "2026-03-10",
    );
    expect(m.reste).toBe(-150);
    expect(m.crossedZeroOn).toBe("2026-03-04");
  });

  it("compte les jours restants selon le mois affiché", () => {
    expect(computeMonth("2026-03", 0, 0, [], "2026-03-10").joursRestants).toBe(22);
    expect(computeMonth("2026-02", 0, 0, [], "2026-03-10").joursRestants).toBe(0);
    expect(computeMonth("2026-04", 0, 0, [], "2026-03-10").joursRestants).toBe(30);
  });

  it("trace le reste jour par jour jusqu'à aujourd'hui", () => {
    const m = computeMonth("2026-03", 1000, 0, [tx("2026-03-02", "Dépense", 100)], "2026-03-03");
    expect(m.trace).toEqual([
      { day: 1, reste: 1000 },
      { day: 2, reste: 900 },
      { day: 3, reste: 900 },
    ]);
  });
});

describe("formatContext", () => {
  const month = computeMonth("2026-03", 8000, 3000, [tx("2026-03-02", "Dépense", 500)], "2026-03-10");
  const fixed = [{ nom: "Loyer", categorie: "Logement", montant: 3000 }];

  it("écrit les montants dans la devise choisie", () => {
    const ctx = formatContext(8000, fixed, month, "MAD");
    expect(ctx).toContain("Salaire mensuel net : 8000.00 DH");
    expect(ctx).toContain("  - Loyer (Logement) : 3000.00 DH");
    expect(ctx).toContain("Reste réel du mois à ce jour : 4500.00 DH");
    expect(ctx).not.toContain("€");
  });

  it("utilise l'euro par défaut", () => {
    expect(formatContext(8000, fixed, month)).toContain("Salaire mensuel net : 8000.00 €");
  });

  it("transmet la wishlist à l'assistant", () => {
    const wishlist = [
      { nom: "Vélo", prix: 1500, priorite: "Haute", note: "électrique" },
      { nom: "Casque", prix: 300, priorite: "Basse", note: null },
    ];
    const ctx = formatContext(8000, fixed, month, "MAD", wishlist);
    expect(ctx).toContain("Achats prévus (wishlist) :");
    expect(ctx).toContain("  - Vélo : 1500.00 DH (priorité haute) — électrique");
    expect(ctx).toContain("  - Casque : 300.00 DH (priorité basse)");
    expect(ctx).toContain("Total de la wishlist : 1800.00 DH");
  });

  it("n'ajoute rien quand la wishlist est vide", () => {
    expect(formatContext(8000, fixed, month, "MAD", [])).not.toContain("wishlist");
  });

  it("signale l'absence de charges fixes", () => {
    expect(formatContext(8000, [], month)).toContain("Charges fixes mensuelles : aucune renseignée");
  });
});
