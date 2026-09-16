import { describe, expect, it } from "vitest";
import { destinoSeguro } from "@/lib/destino";

const ORIGEN_APP = "https://ojo-aguila.example";

/** Vectores de redirección abierta: absolutos, de protocolo relativo y los que la normalización convierte en "//host". */
const VECTORES_REDIRECCION_ABIERTA = [
  "https://evil.example",
  "//evil.example/ruta",
  "/\\evil.example",
  "/\t/evil.example",
  "/.//evil.example",
  "/..//evil.example/x",
  "/%2e//evil.example",
  "/%2E%2E//evil.example",
  "/./\\evil.example",
  "/.\\/evil.example",
  "/login/..//evil.example",
  "/.\t//evil.example",
  "/.///evil.example",
  "/a/../..//evil.example",
  "/\\/evil.example",
];

describe("destinoSeguro", () => {
  it("conserva rutas internas con su query", () => {
    expect(destinoSeguro("/")).toBe("/");
    expect(destinoSeguro("/?t=CONGRESO&c=SENADO&a=2022&g=05")).toBe("/?t=CONGRESO&c=SENADO&a=2022&g=05");
    expect(destinoSeguro("/a/b?x=1")).toBe("/a/b?x=1");
  });

  it("normaliza segmentos relativos sin salir de la app", () => {
    expect(destinoSeguro("/a/./b/../c")).toBe("/a/c");
    expect(destinoSeguro("/%2F%2Fevil.example")).toBe("/%2F%2Fevil.example");
  });

  it("descarta valores ausentes o que no son rutas", () => {
    expect(destinoSeguro(null)).toBe("/");
    expect(destinoSeguro(undefined)).toBe("/");
    expect(destinoSeguro("")).toBe("/");
    expect(destinoSeguro("dashboard")).toBe("/");
    expect(destinoSeguro(["/a"])).toBe("/");
  });

  it.each(VECTORES_REDIRECCION_ABIERTA)("evita la redirección abierta con %j", (vector) => {
    const destino = destinoSeguro(vector);
    expect(destino).toBe("/");
    expect(new URL(destino, ORIGEN_APP).origin).toBe(ORIGEN_APP);
  });

  it("no vuelve a la pantalla de login", () => {
    expect(destinoSeguro("/login")).toBe("/");
    expect(destinoSeguro("/login?expirada=1")).toBe("/");
    expect(destinoSeguro("/login/")).toBe("/");
    expect(destinoSeguro("/a/../login")).toBe("/");
  });
});
