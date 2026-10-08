import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("./db", () => ({
  insertTransaction: vi.fn(async () => 42),
  removeTransaction: vi.fn(),
  insertFixedItem: vi.fn(),
  updateFixedItem: vi.fn(),
  removeFixedItem: vi.fn(),
  setSetting: vi.fn(),
  insertWish: vi.fn(),
  updateWish: vi.fn(),
  removeWish: vi.fn(),
}));

import { addFixed, addTransaction, addWish, editFixed, editWish, saveDevise, saveSalary } from "./actions";
import * as db from "./db";

function form(fields: Record<string, string>): FormData {
  const f = new FormData();
  for (const [k, v] of Object.entries(fields)) f.set(k, v);
  return f;
}

beforeEach(() => vi.clearAllMocks());

describe("addTransaction", () => {
  const ok = { type: "Dépense", categorie: "Alimentation", date: "2026-03-02", montant: "12,50", description: "  Courses  " };

  it("enregistre une dépense valide, montant arrondi et libellé nettoyé", async () => {
    expect(await addTransaction(null, form({ ...ok, montant: "1 234,567" }))).toEqual({ ok: true, id: 42 });
    expect(db.insertTransaction).toHaveBeenCalledWith({
      date: "2026-03-02",
      type: "Dépense",
      categorie: "Alimentation",
      description: "Courses",
      montant: 1234.57,
    });
  });

  it("enregistre un libellé vide comme null", async () => {
    await addTransaction(null, form({ ...ok, description: "   " }));
    expect(db.insertTransaction).toHaveBeenCalledWith(expect.objectContaining({ description: null }));
  });

  it.each([
    [{ montant: "0" }, "Le montant doit être supérieur à 0."],
    [{ montant: "-5" }, "Le montant doit être supérieur à 0."],
    [{ montant: "abc" }, "Le montant doit être supérieur à 0."],
    [{ date: "02/03/2026" }, "La date est invalide."],
    [{ categorie: "Inconnue" }, "Choisis une catégorie."],
    // Une catégorie de revenu n'est pas valable pour une dépense.
    [{ categorie: "Freelance" }, "Choisis une catégorie."],
  ])("refuse %o", async (patch, error) => {
    expect(await addTransaction(null, form({ ...ok, ...patch }))).toEqual({ ok: false, error });
    expect(db.insertTransaction).not.toHaveBeenCalled();
  });
});

describe("saveSalary", () => {
  it("accepte zéro et les montants au format français", async () => {
    expect(await saveSalary(null, form({ salaire: "2 500,50" }))).toEqual({ ok: true });
    expect(db.setSetting).toHaveBeenCalledWith("salaire_mensuel", "2500.5");
    expect(await saveSalary(null, form({ salaire: "0" }))).toEqual({ ok: true });
  });

  it("refuse un salaire négatif ou absent", async () => {
    expect((await saveSalary(null, form({ salaire: "-1" }))).ok).toBe(false);
    expect((await saveSalary(null, new FormData())).ok).toBe(false);
    expect(db.setSetting).not.toHaveBeenCalled();
  });
});

describe("saveDevise", () => {
  it("enregistre la devise choisie", async () => {
    await saveDevise("MAD");
    expect(db.setSetting).toHaveBeenCalledWith("devise", "MAD");
  });

  it("remplace une devise inconnue par EUR", async () => {
    await saveDevise("BTC");
    expect(db.setSetting).toHaveBeenCalledWith("devise", "EUR");
  });
});

describe("charges fixes", () => {
  const ok = { nom: "  Loyer ", categorie: "Logement", montant: "3000" };

  it("ajoute une charge valide", async () => {
    expect(await addFixed(null, form(ok))).toEqual({ ok: true });
    expect(db.insertFixedItem).toHaveBeenCalledWith("Loyer", "Logement", 3000);
  });

  it.each([
    [{ nom: "  " }, "Donne un nom à cette charge."],
    [{ categorie: "Alimentation" }, "Choisis une catégorie."],
    [{ montant: "0" }, "Le montant doit être supérieur à 0."],
  ])("refuse %o", async (patch, error) => {
    expect(await addFixed(null, form({ ...ok, ...patch }))).toEqual({ ok: false, error });
  });

  it("modifie une charge existante", async () => {
    expect(await editFixed(null, form({ ...ok, id: "7" }))).toEqual({ ok: true });
    expect(db.updateFixedItem).toHaveBeenCalledWith(7, "Loyer", "Logement", 3000);
  });

  it.each(["", "abc", "0", "-3", "1.5"])("refuse l'id %j sans toucher la base", async (id) => {
    const res = await editFixed(null, form({ ...ok, id }));
    expect(res).toEqual({ ok: false, error: "Charge introuvable : recharge la page." });
    expect(db.updateFixedItem).not.toHaveBeenCalled();
  });
});

describe("wishlist", () => {
  const ok = { nom: "  Vélo ", prix: "1 499,999", priorite: "Haute", note: "  " };

  it("ajoute un achat prévu, prix arrondi et note vide en null", async () => {
    expect(await addWish(null, form(ok))).toEqual({ ok: true });
    expect(db.insertWish).toHaveBeenCalledWith("Vélo", 1500, "Haute", null);
  });

  it.each([
    [{ nom: "" }, "Donne un nom à cet achat."],
    [{ prix: "0" }, "Le prix doit être supérieur à 0."],
    [{ prix: "abc" }, "Le prix doit être supérieur à 0."],
    [{ priorite: "Urgente" }, "Choisis une priorité."],
  ])("refuse %o", async (patch, error) => {
    expect(await addWish(null, form({ ...ok, ...patch }))).toEqual({ ok: false, error });
    expect(db.insertWish).not.toHaveBeenCalled();
  });

  it("modifie un achat existant", async () => {
    expect(await editWish(null, form({ ...ok, id: "3", note: "Rouge" }))).toEqual({ ok: true });
    expect(db.updateWish).toHaveBeenCalledWith(3, "Vélo", 1500, "Haute", "Rouge");
  });

  it("refuse un id invalide", async () => {
    expect(await editWish(null, form({ ...ok, id: "x" }))).toEqual({
      ok: false,
      error: "Achat introuvable : recharge la page.",
    });
    expect(db.updateWish).not.toHaveBeenCalled();
  });
});
