import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import type { EleccionRef, TipoVoto } from "./types";
import {
  admiteDimensionPartido,
  circunscripcionDe,
  CODIGO_CANDIDATO,
  dimensionPorDefecto,
  esCorporacionDeLista,
  esVotoPorCompetidor,
  esVotoValido,
  idCandidato,
  nivelContieneCircunscripciones,
  PATRON_ID_CANDIDATO,
  territorioDeCircunscripcion,
  tipoVoto,
} from "./votos";

const SENADO: EleccionRef = { tipificacion: "CONGRESO", corporacion: "SENADO", periodo: "2022" };
const PRESIDENCIA: EleccionRef = { tipificacion: "PRESIDENCIA", corporacion: "PRIMERA VUELTA", periodo: "2026" };

function eleccion(tipificacion: string, corporacion: string): EleccionRef {
  return { tipificacion, corporacion, periodo: "2023" };
}

const CAMARA = eleccion("CONGRESO", "CAMARA");
const ALCALDE = eleccion("TERRITORIALES", "ALCALDE");
const JAL = eleccion("TERRITORIALES", "JAL");

describe("tipoVoto", () => {
  it("clasifica los códigos especiales de candidato", () => {
    expect(tipoVoto(CODIGO_CANDIDATO.LISTA)).toBe("LISTA");
    expect(tipoVoto(CODIGO_CANDIDATO.BLANCO)).toBe("BLANCO");
    expect(tipoVoto(CODIGO_CANDIDATO.NULO)).toBe("NULO");
    expect(tipoVoto(CODIGO_CANDIDATO.NO_MARCADO)).toBe("NO_MARCADO");
  });

  it("trata cualquier otro código como candidato", () => {
    expect(tipoVoto("00001")).toBe("CANDIDATO");
    expect(tipoVoto("00995")).toBe("CANDIDATO");
  });
});

describe("esVotoPorCompetidor y esVotoValido", () => {
  const casos: [TipoVoto, boolean, boolean][] = [
    ["CANDIDATO", true, true],
    ["LISTA", true, true],
    ["BLANCO", false, true],
    ["NULO", false, false],
    ["NO_MARCADO", false, false],
  ];

  it.each(casos)("%s → competidor %s, válido %s", (tipo, competidor, valido) => {
    expect(esVotoPorCompetidor(tipo)).toBe(competidor);
    expect(esVotoValido(tipo)).toBe(valido);
  });
});

describe("dimensión por elección", () => {
  it("Presidencia no admite la dimensión partido; Congreso y Territoriales sí", () => {
    expect(admiteDimensionPartido(SENADO)).toBe(true);
    expect(admiteDimensionPartido(ALCALDE)).toBe(true);
    expect(admiteDimensionPartido(PRESIDENCIA)).toBe(false);
  });

  it("usa candidato por defecto en Presidencia y partido en el resto", () => {
    expect(dimensionPorDefecto(SENADO)).toBe("partido");
    expect(dimensionPorDefecto(eleccion("TERRITORIALES", "GOBERNADOR"))).toBe("partido");
    expect(dimensionPorDefecto(PRESIDENCIA)).toBe("candidato");
  });
});

describe("regla de circunscripción por corporación", () => {
  const casos: [corporacion: string, circunscripcion: string, deLista: boolean][] = [
    ["PRIMERA VUELTA", "nacional", false],
    ["SEGUNDA VUELTA", "nacional", false],
    ["SENADO", "nacional", true],
    ["CAMARA", "departamento", true],
    ["ASAMBLEA", "departamento", true],
    ["GOBERNADOR", "departamento", false],
    ["ALCALDE", "municipio", false],
    ["CONCEJO", "municipio", true],
    ["JAL", "municipio", true],
  ];

  it.each(casos)("%s → %s, de lista: %s", (corporacion, circunscripcion, deLista) => {
    expect(circunscripcionDe({ corporacion })).toBe(circunscripcion);
    expect(esCorporacionDeLista({ corporacion })).toBe(deLista);
  });

  it("coincide con ojo_aguila.circunscripcion() de la migración SQL", () => {
    const migracion = readFileSync(new URL("../../database/migrations/001_ojo_aguila.sql", import.meta.url), "utf8");
    const inicio = migracion.indexOf("FUNCTION ojo_aguila.circunscripcion(");
    const funcion = migracion.slice(inicio, migracion.indexOf("$$;", inicio));
    const sql = new Map<string, string>();
    for (const [, lista, circunscripcion] of funcion.matchAll(/WHEN corporacion IN \(([^)]*)\) THEN '(\w+)'/g)) {
      for (const [, corporacion] of lista.matchAll(/'([^']+)'/g)) sql.set(corporacion, circunscripcion);
    }

    expect(sql.size).toBeGreaterThan(0);
    for (const [corporacion, circunscripcion] of casos) {
      expect(sql.get(corporacion) ?? "nacional").toBe(circunscripcion);
    }
    for (const [corporacion, circunscripcion] of sql) {
      expect(circunscripcionDe({ corporacion })).toBe(circunscripcion);
    }
    expect(funcion).toMatch(/ELSE 'nacional'/);
  });

  it("trata una corporación desconocida como nacional y de lista", () => {
    for (const corporacion of ["CONSULTA", "camara", "", "constructor", "toString"]) {
      expect(circunscripcionDe({ corporacion })).toBe("nacional");
      expect(esCorporacionDeLista({ corporacion })).toBe(true);
    }
  });
});

describe("territorioDeCircunscripcion", () => {
  it("es nacional para corporaciones nacionales en cualquier ámbito", () => {
    for (const codigo of ["", "05", "05001", "0500101", "050010101"]) {
      expect(territorioDeCircunscripcion(SENADO, codigo)).toBe("");
    }
  });

  it("usa el departamento del ámbito en circunscripción departamental", () => {
    expect(territorioDeCircunscripcion(CAMARA, "")).toBe("");
    expect(territorioDeCircunscripcion(CAMARA, "05")).toBe("05");
    expect(territorioDeCircunscripcion(CAMARA, "050010101")).toBe("05");
  });

  it("usa el municipio del ámbito en circunscripción municipal y nacional por encima de él", () => {
    expect(territorioDeCircunscripcion(ALCALDE, "")).toBe("");
    expect(territorioDeCircunscripcion(ALCALDE, "05")).toBe("");
    expect(territorioDeCircunscripcion(ALCALDE, "05001")).toBe("05001");
    expect(territorioDeCircunscripcion(JAL, "0100199A1")).toBe("01001");
  });
});

describe("nivelContieneCircunscripciones", () => {
  it("es cierto en niveles iguales o más amplios que la circunscripción", () => {
    expect(nivelContieneCircunscripciones(CAMARA, "departamento")).toBe(true);
    expect(nivelContieneCircunscripciones(CAMARA, "municipio")).toBe(false);
    expect(nivelContieneCircunscripciones(ALCALDE, "departamento")).toBe(true);
    expect(nivelContieneCircunscripciones(ALCALDE, "municipio")).toBe(true);
    expect(nivelContieneCircunscripciones(ALCALDE, "zona")).toBe(false);
    expect(nivelContieneCircunscripciones(ALCALDE, "puesto")).toBe(false);
  });

  it("nunca filtra unidades hijas en corporaciones nacionales", () => {
    for (const nivel of ["departamento", "municipio", "zona", "puesto"] as const) {
      expect(nivelContieneCircunscripciones(SENADO, nivel)).toBe(false);
      expect(nivelContieneCircunscripciones(PRESIDENCIA, nivel)).toBe(false);
    }
  });
});

describe("idCandidato y claves", () => {
  it("combina partido, candidato y clave", () => {
    expect(idCandidato("00001", "00012", "05")).toBe("00001-00012-05");
    expect(idCandidato("00001", "00012", "05001:3fa2c9")).toBe("00001-00012-05001:3fa2c9");
  });

  it("acepta ids con clave única, departamental, municipal y de JAL", () => {
    for (const id of ["00001-00012-00", "00001-00012-05", "00001-00012-05001", "00001-00012-05001:3fa2c9"]) {
      expect(PATRON_ID_CANDIDATO.test(id)).toBe(true);
    }
  });

  it("rechaza claves con otro formato y entradas peligrosas", () => {
    for (const id of [
      "00001-00012",
      "00001-00012-5",
      "00001-00012-050",
      "00001-00012-050011",
      "00001-00012-05:3fa2c9",
      "00001-00012-05001:",
      "00001-00012-05001:3FA2C9",
      "00001-00012-05001:3fa2c",
      "00001-00012-05001:3fa2c9a",
      "00001-00012-05001:3fa2cg",
      "00001-00012-05001;3fa2c9",
      "00001-00012-05001:3fa2c9\n",
      "00001-00012-05' OR 1=1",
      "00001-00012-05001:3fa2c9' OR '1'='1",
      " 00001-00012-00",
    ]) {
      expect(PATRON_ID_CANDIDATO.test(id)).toBe(false);
    }
  });

});
