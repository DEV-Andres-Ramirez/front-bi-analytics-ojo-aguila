import { describe, expect, it } from "vitest";
import {
  codigoPadre,
  esCodigoGeoValido,
  getNivel,
  NIVELES,
  nivelDeCodigo,
  nivelHijo,
  rutaDeCodigo,
} from "./niveles";
import type { NivelId } from "./types";

describe("NIVELES", () => {
  it("define la jerarquía de lo general a lo específico con longitudes crecientes", () => {
    expect(NIVELES.map((n) => n.id)).toEqual(["nacional", "departamento", "municipio", "zona", "puesto", "mesa"]);
    expect(NIVELES.map((n) => n.longitud)).toEqual([0, 2, 5, 7, 9, 12]);
  });

  it("mantiene deshabilitado el nivel mesa", () => {
    expect(getNivel("mesa").habilitado).toBe(false);
    expect(NIVELES.filter((n) => !n.habilitado).map((n) => n.id)).toEqual(["mesa"]);
  });
});

describe("esCodigoGeoValido", () => {
  it("acepta Colombia y los prefijos divipole de niveles habilitados", () => {
    for (const codigo of ["", "05", "05001", "0500101", "050010101"]) {
      expect(esCodigoGeoValido(codigo)).toBe(true);
    }
  });

  it("acepta puestos que terminan en dos caracteres alfanuméricos", () => {
    for (const codigo of ["0100199A1", "0100199AB", "0100199PO"]) {
      expect(esCodigoGeoValido(codigo)).toBe(true);
    }
  });

  it("rechaza longitudes intermedias, mesas, letras y espacios", () => {
    for (const codigo of ["0", "050", "0500", "050010", "05001010", "050010101001", "ab", " 05", "05\n"]) {
      expect(esCodigoGeoValido(codigo)).toBe(false);
    }
  });

  it("solo admite letras al final del código de puesto y en mayúsculas", () => {
    for (const codigo of ["0A", "0100A", "01001A9", "010019A91", "0100199a1", "0100199A-", "0100199A1 "]) {
      expect(esCodigoGeoValido(codigo)).toBe(false);
    }
  });
});

describe("getNivel", () => {
  it("retorna la definición del nivel", () => {
    expect(getNivel("municipio")).toMatchObject({ longitud: 5, etiqueta: "Municipio", etiquetaPlural: "Municipios" });
  });

  it("lanza con un nivel desconocido", () => {
    expect(() => getNivel("vereda" as NivelId)).toThrow("Nivel desconocido");
  });
});

describe("nivelDeCodigo", () => {
  it("deduce el nivel por la longitud del código", () => {
    expect(nivelDeCodigo("").id).toBe("nacional");
    expect(nivelDeCodigo("05").id).toBe("departamento");
    expect(nivelDeCodigo("05001").id).toBe("municipio");
    expect(nivelDeCodigo("0500101").id).toBe("zona");
    expect(nivelDeCodigo("050010101").id).toBe("puesto");
    expect(nivelDeCodigo("0100199A1").id).toBe("puesto");
  });

  it("lanza con longitudes sin nivel o de niveles deshabilitados", () => {
    expect(() => nivelDeCodigo("050")).toThrow("Código geográfico inválido");
    expect(() => nivelDeCodigo("050010101001")).toThrow("Código geográfico inválido");
  });
});

describe("nivelHijo", () => {
  it("retorna el siguiente nivel habilitado", () => {
    expect(nivelHijo("nacional")?.id).toBe("departamento");
    expect(nivelHijo("municipio")?.id).toBe("zona");
    expect(nivelHijo("zona")?.id).toBe("puesto");
  });

  it("trata el puesto como hoja mientras mesa esté deshabilitado", () => {
    expect(nivelHijo("puesto")).toBeNull();
  });
});

describe("codigoPadre", () => {
  it("recorta al nivel inmediatamente superior", () => {
    expect(codigoPadre("05")).toBe("");
    expect(codigoPadre("05001")).toBe("05");
    expect(codigoPadre("0500101")).toBe("05001");
    expect(codigoPadre("050010101")).toBe("0500101");
    expect(codigoPadre("0100199A1")).toBe("0100199");
  });

  it("retorna null para Colombia y códigos sin nivel", () => {
    expect(codigoPadre("")).toBeNull();
    expect(codigoPadre("050")).toBeNull();
  });
});

describe("rutaDeCodigo", () => {
  it("lista los códigos desde Colombia hasta la unidad", () => {
    expect(rutaDeCodigo("0100101")).toEqual(["", "01", "01001", "0100101"]);
    expect(rutaDeCodigo("050010101")).toEqual(["", "05", "05001", "0500101", "050010101"]);
    expect(rutaDeCodigo("0100199A1")).toEqual(["", "01", "01001", "0100199", "0100199A1"]);
  });

  it("para Colombia contiene solo la raíz", () => {
    expect(rutaDeCodigo("")).toEqual([""]);
  });
});
