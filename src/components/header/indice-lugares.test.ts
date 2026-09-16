import { describe, expect, it } from "vitest";
import { buscarLugares, indexarLugares } from "./indice-lugares";

const lugares = indexarLugares([
  ["01", "Antioquia"],
  ["01001", "Medellín"],
  ["0100199", "Zona 99"],
  ["010019910", "San Antonio de Prado"],
  ["0100199A4", "Centro de Desarrollo Social (CDS)"],
  ["07", "Boyacá"],
  ["07001", "Tunja"],
  ["0700100", "Zona 00"],
  ["070010001", "Puesto Cabecera Municipal"],
  ["01002", "Abejorral"],
  ["0100200", "Zona 00"],
  ["010020001", "Puesto Cabecera Municipal"],
]);

const codigos = (consulta: string) => buscarLugares(lugares, consulta).map((lugar) => lugar.codigo);

describe("buscarLugares", () => {
  it("encuentra puestos con código alfanumérico, sin importar mayúsculas", () => {
    expect(codigos("0100199a4")).toEqual(["0100199A4"]);
    expect(codigos("0100199A")).toEqual(["0100199A4"]);
  });

  it("busca por prefijo de código numérico", () => {
    expect(codigos("07001")).toEqual(["07001", "070010001"]);
  });

  it("con varios términos también busca en el municipio y el departamento", () => {
    expect(codigos("cabecera tunja")).toEqual(["070010001"]);
    expect(codigos("cabecera antioquia")).toEqual(["010020001"]);
  });

  it("prioriza las coincidencias en el nombre sobre las del contexto", () => {
    expect(codigos("san antonio")[0]).toBe("010019910");
  });

  it("con un solo término no busca en el contexto", () => {
    expect(codigos("antioquia")).toEqual(["01"]);
  });
});
