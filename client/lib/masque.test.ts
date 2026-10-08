import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

let cookie: string | undefined;
vi.mock("next/headers", () => ({
  cookies: async () => ({ get: () => (cookie === undefined ? undefined : { value: cookie }) }),
}));

import { isMasque } from "./masque";

beforeEach(() => {
  cookie = undefined;
});

describe("isMasque", () => {
  it("masque par défaut, sans cookie", async () => {
    expect(await isMasque()).toBe(true);
  });

  it("affiche seulement si l'utilisateur l'a demandé", async () => {
    cookie = "0";
    expect(await isMasque()).toBe(false);
  });

  it("reste masqué pour toute autre valeur", async () => {
    cookie = "1";
    expect(await isMasque()).toBe(true);
    cookie = "n'importe quoi";
    expect(await isMasque()).toBe(true);
  });
});
